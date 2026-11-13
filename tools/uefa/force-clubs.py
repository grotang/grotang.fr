# -*- coding: utf-8 -*-
"""FORCE DES CLUBS — robot hebdomadaire (chantier C03, 12/11/2026).

    python3 tools/uefa/force-clubs.py            (après node tools/build.mjs)

Ce que fait le script, dans l'ordre :
  1. relit sur Wikipédia (API REST, page rendue) les grilles de résultats des
     10 championnats des 10 premières nations, saison en cours + 3 précédentes ;
  2. tient l'archive tools/uefa/archive/championnats.json : chaque résultat y
     garde la date de la semaine où il est apparu (les grilles n'ont pas de
     dates). Saisons passées : 15 janvier ; premier passage sur la saison en
     cours : milieu de la période déjà jouée ;
  3. prend les matchs européens : saisons closes dans public/…/saisons.json,
     saison en cours dans la page construite (bloc SEM) ;
  4. calcule la force de chaque club (moindres carrés pondérés, voir
     « Claude outputs/elo/force-clubs-modele-v1.pdf ») ;
  5. écrit tools/uefa/force-clubs.json, que build.mjs injecte dans la page
     (bloc FORCE) et que la projection utilise.

Réglages décidés avec GT le 08/11/2026 ; échelle calée par le backtest du
12/11/2026 (apprentissage 2024/25, validation 2025/26 et 2026/27).
Python standard uniquement (aucune dépendance à installer).

Réglages du 13/11/2026 (GT) : poids européens par tour, règle des promus,
noms de clubs renommés (ALIAS_LIGUE), sortie des clubs de 1re division
(`championnats`) et de l'indice pour la page /football-force-des-clubs/.

Garde-fous — DÉGRADÉ PLUTÔT QUE BLOQUÉ (GT, 12/11/2026) :
  - une ligue illisible, ou qui perd des résultats : on garde ses résultats déjà
    archivés, les autres ligues sont mises à jour ;
  - un club engagé sans force (nom inconnu) : il prend la force de sa nation
    (la page sait le faire) ;
  - une ligue sans résultat neuf depuis 4 semaines en pleine saison : alerte ;
  - dans ces cas le fichier est QUAND MÊME écrit, avec la liste « alertes » ;
    le workflow publie puis échoue exprès, pour que GitHub envoie son e-mail ;
  - seul vrai blocage : plus de la moitié des ligues illisibles (la structure de
    Wikipédia a changé partout). Rien n'est écrit, le site garde l'existant.
"""
import datetime as dt, difflib, html.parser, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
ARCHIVE = os.path.join(ICI, 'archive', 'championnats.json')
SORTIE = os.path.join(ICI, 'force-clubs.json')
NOMS = os.path.join(ICI, 'force-noms.json')
HISTO = os.path.join(ICI, 'archive', 'force-historique.json')   # indice de chaque club, semaine par semaine (page, colonne « Sem. »)
SAISONS_EU = os.environ.get('FORCE_SAISONS', os.path.join(RACINE, 'public', 'football-coefficient-uefa', 'saisons.json'))
PAGE = os.environ.get('FORCE_PAGE', os.path.join(RACINE, 'public', 'football-coefficient-uefa', 'index.html'))
AUJ = dt.date.fromisoformat(os.environ['FORCE_DATE']) if os.environ.get('FORCE_DATE') else dt.date.today()

# ---- réglages (GT, 08/11/2026) ------------------------------------------------
DEMI_VIE, FENETRE, PLAFOND, LAMBDA, BONUS_TAB = 365.0, 3 * 365, 3, 4.0, 0.5
ECHELLE = 1.157     # 1 but d'écart de force = 1,157 unité du moteur de projection (backtest du 12/11/2026)
# INDICE (GT, 12/11/2026) : 100 = le club moyen de la phase de ligue de la saison (moyenne des 108 clubs
# des trois coupes, force propre ou, à défaut, celle de sa nation) ; 40 points = 1 but d'écart sur terrain
# neutre. Ce qui est GELÉ, c'est la LISTE des 108 clubs, pas une valeur en buts : le modèle ne mesure que
# des écarts, son zéro est arbitraire et se déplace d'un bloc quand on change sa structure (+0,95 but pour
# tous les clubs le 13/11 en ajoutant les clubs des autres nations). Rapporté aux mêmes 108 clubs, l'indice
# d'un club ne bouge que si sa force bouge par rapport à eux. Calculé à chaque passage (BASE ci-dessous).
POINTS_PAR_BUT = 40
# CLUBS DES AUTRES NATIONS (GT, 13/11/2026) : hors des 10 nations, un club a sa propre force s'il a joué
# au moins SEUIL_HORS10 matchs européens dans la fenêtre (3 ans), sinon il prend celle de sa nation.
# Backtest (Claude outputs/elo/2026.11.13 test clubs hors 10 nations seuil.txt) : seuil 25 -> log-loss
# 0,9488 contre 0,9525, au prix d'un léger recul sur les duels entre clubs des 10 nations (0,9132 contre 0,9107).
SEUIL_HORS10 = 25
LIGUES = {'ENG': 'Premier League', 'ITA': 'Serie A', 'ESP': 'La Liga', 'GER': 'Bundesliga', 'FRA': 'Ligue 1',
          'POR': 'Primeira Liga', 'BEL': 'Belgian Pro League', 'NED': 'Eredivisie', 'TUR': 'Süper Lig', 'GRE': 'Super League Greece'}
AUTRES_TITRES = {'Belgian Pro League': ['Belgian First Division A']}
DIX = list(LIGUES)
# finales européennes nulles décidées aux tirs au but (le vainqueur n'est pas dans les données)
FINALES_TAB = {('2026-05-30', 'Paris Saint-Germain FC')}
UA = {'User-Agent': 'grotang.fr-force-clubs/1.0 (+https://grotang.fr)'}

def poids_age(jours): return 0.0 if jours > FENETRE or jours < 0 else 0.5 ** (jours / DEMI_VIE)
# poids d'un match européen (GT, 12/11/2026 ; backtest neutre : log-loss 0,9526 contre 0,9524) :
# qualifications ×1,5 ; phase de groupes / de ligue ×3 ; barrages KO ×3, 8es ×4, quarts ×5, demies ×6, finale ×8
def poids_europe(etape): return 1.5 if isinstance(etape, str) else 3.0 if etape < 8 else {8: 3.0, 9: 4.0, 10: 5.0, 11: 6.0}.get(etape, 8.0)
def canon(x): return re.sub(r'\s+', ' ', x.replace('.', '')).strip()
# Un club dont Wikipédia change le nom d'une saison à l'autre deviendrait deux clubs (et un faux
# promu). Ancien nom -> nom retenu ; appliqué aux grilles lues ET à l'archive. Vérifié le 13/11/2026 :
# un seul cas sur les 10 ligues et 4 saisons. Le script signale tout nouveau cas (alerte « renommé ? »).
ALIAS_LIGUE = {'Gençlerbirliği SK': 'Gençlerbirliği'}
def nom_ligue(x): x = canon(x); return ALIAS_LIGUE.get(x, x)
def stop(msg): print('ÉCHEC :', msg); sys.exit(1)
ALERTES = []
def alerte(msg): print('ALERTE :', msg); ALERTES.append(msg)

# ---- 1. lecture des grilles Wikipédia -------------------------------------------
class Grilles(html.parser.HTMLParser):
    """Tableaux « Home \\ Away » d'une page : [(équipe ligne, équipe colonne, score)]."""
    def __init__(self):
        super().__init__(); self.tables = []; self.pile = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'table': self.pile.append({'lignes': [], 'texte': []})
        elif not self.pile: return
        t = self.pile[-1]
        if tag == 'tr': t['lignes'].append([])
        elif tag in ('td', 'th') and t['lignes']: t['lignes'][-1].append({'texte': '', 'titre': None})
        elif tag == 'a' and t['lignes'] and t['lignes'][-1] and a.get('title') and t['lignes'][-1][-1]['titre'] is None:
            t['lignes'][-1][-1]['titre'] = a['title']
    def handle_endtag(self, tag):
        if tag == 'table' and self.pile:
            t = self.pile.pop(); self.tables.append(t)
    def handle_data(self, data):
        if not self.pile: return
        t = self.pile[-1]; t['texte'].append(data)
        if t['lignes'] and t['lignes'][-1]: t['lignes'][-1][-1]['texte'] += data

def page(titre):
    u = 'https://en.wikipedia.org/api/rest_v1/page/html/' + urllib.parse.quote(titre.replace(' ', '_'))
    for essai in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r: return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(5 * (essai + 1))
        except Exception: time.sleep(5 * (essai + 1))
    return None

def grilles_saison(lg, saison):
    for titre in [f'{saison} {lg}'] + [f'{saison} {x}' for x in AUTRES_TITRES.get(lg, [])]:
        h = page(titre)
        if h is None: continue
        p = Grilles(); p.feed(h); out = []; g = 0
        for gi, t in enumerate([t for t in p.tables if re.search(r'Home\s*\\\s*Away', ''.join(t['texte']))]):
            corps = [l for l in t['lignes'][1:] if l]
            equipes = [(c[0]['titre'] or c[0]['texte']).strip() for c in corps]
            for i, l in enumerate(corps):
                for j, c in enumerate(l[1:]):
                    m = re.match(r'^\s*(\d+)\s*[–-]\s*(\d+)\s*$', c['texte'])
                    if m and j < len(equipes) and j != i: out.append([gi, nom_ligue(equipes[i]), nom_ligue(equipes[j]), int(m[1]), int(m[2])])
        return titre, out
    return None, None

def saison_de(d): return d.year if d.month >= 7 else d.year - 1
def libelle(y): return f'{y}–{str(y + 1)[2:]}'

y_cours = saison_de(AUJ)
SAISONS = [libelle(y) for y in range(y_cours - 3, y_cours + 1)]
archive = json.load(open(ARCHIVE, encoding='utf-8')) if os.path.exists(ARCHIVE) else []
for r in archive: r[3], r[4] = ALIAS_LIGUE.get(r[3], r[3]), ALIAS_LIGUE.get(r[4], r[4])
deja = {(r[0], r[1], r[2], r[3], r[4]): r for r in archive}
neuf, total, illisibles, nouvelles = 0, {}, set(), set()
for nat, lg in LIGUES.items():
    for sa in SAISONS:
        titre, L = grilles_saison(lg, sa)
        y0 = int(sa[:4])
        avant = sum(1 for k in deja if k[0] == nat and k[1] == sa)
        if not L:
            if y0 == y_cours and AUJ < dt.date(y0, 8, 20): continue      # championnat pas encore commencé
            if avant: illisibles.add(nat); alerte(f'{lg} {sa} : page illisible, on garde les {avant} résultats archivés'); continue
            illisibles.add(nat); alerte(f'{lg} {sa} : page introuvable ou illisible, aucun résultat'); continue
        if len(L) < avant:
            illisibles.add(nat); alerte(f'{titre} : {len(L)} résultats lus, {avant} dans l\'archive — on garde l\'archive'); continue
        total[(nat, sa)] = len(L)
        if y0 < y_cours: date = dt.date(y0 + 1, 1, 15)
        elif not any(k[0] == nat and k[1] == sa for k in deja):            # premier passage sur la saison en cours
            date = dt.date(y0, 8, 1) + (AUJ - dt.date(y0, 8, 1)) / 2
        else: date = AUJ - dt.timedelta(days=3)                            # nouveau cette semaine
        for gi, h, a, bh, ba in L:
            k = (nat, sa, gi, h, a)
            if k in deja: deja[k][5], deja[k][6] = bh, ba
            else: deja[k] = [nat, sa, gi, h, a, bh, ba, date.isoformat()]; neuf += 1; nouvelles.add(k)
        time.sleep(1)
if len(illisibles) > len(LIGUES) // 2:
    stop(f'{len(illisibles)} ligues sur {len(LIGUES)} illisibles : la structure de Wikipédia a sans doute changé. Rien n\'est écrit.')
# fraîcheur : date du dernier passage où chaque ligue a gagné des résultats (gardée d'une semaine à l'autre
# dans force-clubs.json) ; en pleine saison (septembre → mai), rien de neuf depuis 4 semaines = alerte
prec = json.load(open(SORTIE, encoding='utf-8')).get('fraicheur', {}) if os.path.exists(SORTIE) else {}
fraicheur = {}
sa_c = libelle(y_cours)
for nat, lg in LIGUES.items():
    a_bouge = any(k[0] == nat and k[1] == sa_c for k in nouvelles)
    fraicheur[nat] = AUJ.isoformat() if a_bouge or nat not in prec else prec[nat]
    if AUJ.month in (9, 10, 11, 12, 1, 2, 3, 4, 5) and (AUJ - dt.date.fromisoformat(fraicheur[nat])).days > 28:
        alerte(f'{lg} : aucun résultat neuf depuis le {fraicheur[nat]}')
garde = libelle(y_cours - 3)
archive = sorted([r for r in deja.values() if r[1] >= garde], key=lambda r: (r[0], r[1], r[7], r[3]))
print(f'championnats : {len(archive)} résultats, dont {neuf} nouveaux')

# ---- 2. matchs européens --------------------------------------------------------
S = json.load(open(SAISONS_EU, encoding='utf-8'))
EU = [m for k in sorted(S) for m in S[k]['SEM']]
src = open(PAGE, encoding='utf-8').read()
mm = re.search(r'/\*SEM_START\*/const SEM = (\[.*?\]);/\*SEM_END\*/', src, re.S)
if not mm: stop('bloc SEM introuvable dans la page construite')
SEM = json.loads(mm.group(1)); EU += SEM
EU = [m for m in EU if m[8] is not None and (AUJ - dt.date.fromisoformat(m[0])).days <= FENETRE + 400]

# noms européens -> noms Wikipédia (fichier tenu à jour ; nouveaux clubs : rapprochement automatique)
noms = json.load(open(NOMS, encoding='utf-8')) if os.path.exists(NOMS) else {}
par_nat = {}
for r in archive: par_nat.setdefault(r[0], set()).update([r[3], r[4]])
def norme(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\b(fc|cf|ac|sc|as|ss|ssc|afc|vfb|vfl|tsg|sv|sl|sk|fk|kv|krc|rsc|rc|ogc|aj|og|ud|cd|rcd|bv|club|de|del|la|le|d|ev|calcio|hotspur|united|city|football)\b', '', s)
    return re.sub(r'[^a-z0-9]', '', s)
nouveaux_noms = []
nb_eu = {}                                      # matchs européens de chaque club hors des 10 nations, dans la fenêtre
for m in EU:
    if 0 <= (AUJ - dt.date.fromisoformat(m[0])).days <= FENETRE:
        for n, c in ((m[4], m[5]), (m[6], m[7])):
            if c not in DIX: nb_eu[n] = nb_eu.get(n, 0) + 1
def nom(n, nat):
    if nat not in DIX: return ('EU:' + n) if nb_eu.get(n, 0) >= SEUIL_HORS10 else 'NAT:' + nat
    if n in noms: return noms[n]
    cands = par_nat.get(nat, set()); nn = norme(n)
    if not cands: return n
    sc, w = max((difflib.SequenceMatcher(None, nn, norme(w)).ratio() + (0.3 if nn and (nn in norme(w) or norme(w) in nn) else 0), w) for w in cands)
    if sc >= 0.9: noms[n] = w; nouveaux_noms.append(f'{n} -> {w} ({sc:.2f})'); return w
    return n                                    # pas trouvé : le club n'aura que ses matchs européens
sai = lambda d: int(d[:4]) if d[5:7] >= '06' else int(d[:4]) - 1
ordre = lambda et: (-11 if et == 'qp' else int(et[1:]) - 10) if isinstance(et, str) else et
plus_loin, duels, bonus = {}, {}, {}
for m in EU:
    for c in (m[4], m[6]): plus_loin.setdefault((sai(m[0]), m[2], c), []).append(ordre(m[3]))
for i, m in enumerate(EU):
    if isinstance(m[3], int) and m[3] < 8: continue
    duels.setdefault((sai(m[0]), m[2], str(m[3]), frozenset((m[4], m[6]))), []).append(i)
for k, L in duels.items():
    agg = {}
    for i in L: m = EU[i]; agg[m[4]] = agg.get(m[4], 0) + m[8]; agg[m[6]] = agg.get(m[6], 0) + m[9]
    if len(agg) != 2 or len(set(agg.values())) != 1: continue
    der = max(L, key=lambda i: EU[i][0]); m = EU[der]
    if m[3] == 12: g = next((c for c in (m[4], m[6]) if (m[0], c) in FINALES_TAB), None)
    else: g = next((c for c in agg if any(o > ordre(m[3]) for o in plus_loin.get((k[0], k[1], c), []))), None)
    if g: bonus[der] = BONUS_TAB if g == m[4] else -BONUS_TAB

# ---- 3. les matchs, pondérés ----------------------------------------------------
M = []
for nat, sa, gi, h, a, bh, ba, d in archive:
    w = poids_age((AUJ - dt.date.fromisoformat(d)).days)
    if w > 0: M.append((h, a, max(-PLAFOND, min(PLAFOND, bh - ba)), w, 1, nat, nat))
for i, m in enumerate(EU):
    w = poids_age((AUJ - dt.date.fromisoformat(m[0])).days)
    if w > 0:
        M.append((nom(m[4], m[5]), nom(m[6], m[7]), max(-PLAFOND, min(PLAFOND, m[8] - m[9])) + bonus.get(i, 0),
                  poids_europe(m[3]) * w, 0 if m[3] == 12 else 1, m[5], m[7]))

# ---- 4. résolution : moindres carrés pondérés + retenue ---------------------------
nat_de = {}
for h, a, gd, w, dom, nh, na in M: nat_de.setdefault(h, nh); nat_de.setdefault(a, na)
eq = sorted(nat_de); idx = {e: i for i, e in enumerate(eq)}
LIG = DIX + sorted({nat_de[e] for e in eq if e.startswith('EU:')})    # niveau de ligue : les 10 + les nations qui ont des clubs « EU: »
li = {n: len(eq) + k for k, n in enumerate(LIG)}; H = len(eq) + len(LIG); P = H + 1
A = [[0.0] * P for _ in range(P)]; b = [0.0] * P
for h, a, gd, w, dom, nh, na in M:
    x = {}
    for e, s in ((h, 1), (a, -1)):
        x[idx[e]] = x.get(idx[e], 0) + s
        if nat_de[e] in li: x[li[nat_de[e]]] = x.get(li[nat_de[e]], 0) + s
    if dom: x[H] = 1
    for i, vi in x.items():
        b[i] += w * vi * gd
        for j, vj in x.items(): A[i][j] += w * vi * vj
for i in range(len(eq)): A[i][i] += LAMBDA
for i in range(len(eq), H): A[i][i] += 0.01
def resout(A, b):
    """élimination de Gauss (la matrice est symétrique définie positive) ; A et b sont recopiés"""
    A = [l[:] for l in A]; b = b[:]
    for c in range(P):
        piv = A[c][c]
        for r in range(c + 1, P):
            f = A[r][c] / piv
            if f:
                Ar, Ac = A[r], A[c]
                for j in range(c, P): Ar[j] -= f * Ac[j]
                b[r] -= f * b[c]
    beta = [0.0] * P
    for c in range(P - 1, -1, -1):
        beta[c] = (b[c] - sum(A[c][j] * beta[j] for j in range(c + 1, P))) / A[c][c]
    return beta
beta = resout(A, b)
# RÈGLE DES PROMUS (GT, 08/11 puis 13/11/2026). La retenue (LAMBDA) ramène un club qui a peu de
# matchs vers le niveau moyen de sa ligue. Pour un PROMU DE LA SAISON EN COURS, le point de départ
# devient le niveau moyen des promus de sa ligue : un promu n'est pas un club moyen de 1re division.
#   - promu de la saison = club présent en 1re division cette saison et absent la saison d'avant
#     (un club monté l'an dernier, comme le Paris FC en 2025-26, n'est plus un promu) ;
#   - niveau des promus = moyenne de l'écart à la ligue des clubs montés lors des saisons passées
#     de l'archive (calculée une première fois sans la règle) ;
#   - ses vrais matchs l'en écartent ensuite, comme pour tout club (le point de départ pèse 4 matchs).
sais = {}
for nat, sa, gi, h, a, bh, ba, d in archive:
    for e in (h, a): sais.setdefault(nat, {}).setdefault(e, set()).add(int(sa[:4]))
promus, anciens_promus = {}, {}
for nat, cl in sais.items():
    s0 = min(min(v) for v in cl.values())
    for e, v in cl.items():
        if e not in idx: continue
        for y in v:
            if y > s0 and y - 1 not in v:              # monté cette saison-là
                if y == y_cours: promus[e] = nat
                else: anciens_promus.setdefault(nat, []).append(e)
for nat, cl in sais.items():                            # renommé ? (même nom normalisé, saisons disjointes)
    for e in [e for e, v in cl.items() if y_cours in v and y_cours - 1 not in v]:
        for o in [o for o, v in cl.items() if y_cours - 1 in v and y_cours not in v]:
            if norme(e) == norme(o): alerte(f'{LIGUES[nat]} : « {e} » et « {o} » sont peut-être le même club renommé (ALIAS_LIGUE)')
niveau_promus = {c: sum(beta[idx[e]] for e in v) / len(v) for c, v in anciens_promus.items() if v}
b2 = b[:]
for e, n in promus.items():
    if n in niveau_promus: b2[idx[e]] += LAMBDA * niveau_promus[n]
beta = resout(A, b2)
force = {e: beta[idx[e]] + (beta[li[nat_de[e]]] if nat_de[e] in li else 0) for e in eq}

# ---- 5. sortie : clubs engagés cette saison (noms de la source) + nations ---------
clubs, manque = {}, []
for m in SEM:
    for n, c in ((m[4], m[5]), (m[6], m[7])):
        k = nom(n, c)
        if c in DIX:
            if k in force: clubs[n] = round(force[k], 4)
            else: manque.append(n)
        elif k.startswith('EU:') and k in force: clubs[n] = round(force[k], 4)
if manque: alerte('clubs sans force propre (ils prennent celle de leur nation) : ' + ', '.join(sorted(set(manque))))
nations = {e[4:]: round(v, 4) for e, v in force.items() if e.startswith('NAT:')}
for c in DIX:
    v = [force[k] for k in force if nat_de.get(k) == c]; nations[c] = round(sum(v) / len(v), 4)
for c in LIG:                                   # nation dont tous les clubs passés par l'Europe ont une force propre
    if c not in nations: nations[c] = round(beta[li[c]], 4)
# clubs des autres nations à force propre : [nom de la source, nation, force, matchs européens sur 3 ans]
hors10 = sorted([[e[3:], nat_de[e], round(force[e], 4), nb_eu.get(e[3:], 0)] for e in force if e.startswith('EU:')], key=lambda x: -x[2])
# les clubs de 1re division de la saison (la dernière saison lue de chaque ligue), pour la page
# /football-force-des-clubs/ : [nom Wikipédia, nation, force en buts], du plus fort au plus faible
derniere = {}
for nat, sa, gi, h, a, bh, ba, d in archive: derniere[nat] = max(derniere.get(nat, ''), sa)
champ = {(nat, e) for nat, sa, gi, h, a, bh, ba, d in archive if sa == derniere[nat] for e in (h, a)}
championnats = sorted([[e, nat, round(force[e], 4)] for nat, e in champ if e in force], key=lambda x: -x[2])
# base de l'indice : les clubs de la phase de ligue de la saison en cours (étapes 0 à 7 du calendrier SEM)
phase_ligue = {(n, c) for m in SEM if isinstance(m[3], int) and m[3] < 8 and sai(m[0]) == y_cours for n, c in ((m[4], m[5]), (m[6], m[7]))}
fl = [force.get(nom(n, c), nations.get(c)) for n, c in phase_ligue]
fl = [v for v in fl if v is not None]
if len(phase_ligue) < 100: alerte(f'phase de ligue : {len(phase_ligue)} clubs trouvés (108 attendus) pour la base de l\'indice')
BASE_INDICE = round(sum(fl) / len(fl), 4) if fl else 0.0
indice = lambda v: round(100 + POINTS_PAR_BUT * (v - BASE_INDICE), 1)
json.dump({'date': AUJ.isoformat(), 'alertes': ALERTES, 'fraicheur': fraicheur, 'echelle': ECHELLE, 'avantage_terrain': round(beta[H], 3),
           'base_indice': BASE_INDICE, 'points_par_but': POINTS_PAR_BUT,
           'clubs': dict(sorted(clubs.items())), 'nations': dict(sorted(nations.items())),
           'championnats': championnats, 'promus': sorted(promus), 'seuil_hors10': SEUIL_HORS10, 'hors10': hors10},
          open(SORTIE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(archive, open(ARCHIVE, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
# historique : une entrée par semaine (le lundi), réécrite si le robot repasse dans la semaine
histo = json.load(open(HISTO, encoding='utf-8')) if os.path.exists(HISTO) else {}
histo[(AUJ - dt.timedelta(days=AUJ.weekday())).isoformat()] = {**{e: indice(v) for e, nat, v in championnats}, **{'EU:' + e: indice(v) for e, nat, v, k in hors10}}
histo = dict(sorted(histo.items())[-60:])
json.dump(histo, open(HISTO, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
json.dump(dict(sorted(noms.items())), open(NOMS, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{len(M)} matchs, {len(eq)} équipes, avantage du terrain {beta[H]:.2f} but')
print('top 5 (indice) :', ', '.join(f'{n} {indice(v)}' for n, nat, v in championnats[:5]), f'· {len(championnats)} clubs, {len(promus)} promus, {len(hors10)} clubs d\'autres nations')
if nouveaux_noms: print('noms rapprochés automatiquement :', '; '.join(nouveaux_noms))
