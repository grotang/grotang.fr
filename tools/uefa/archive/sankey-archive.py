# -*- coding: utf-8 -*-
"""Parcours de la saison complète, club par club, pour les saisons archivées
(bloc 7c) : qualifications, phase de groupes ou de ligue, puis chaque tour à
élimination directe jusqu'au vainqueur.

    python3 tools/uefa/archive/sankey-archive.py <dossier des pages d'archive>

Lit, pour chaque saison 2021 → 2025, « AAAA AV Spiele.html » (tous les matchs,
tour par tour) et « AAAA AV Pkt je Nat.html » (tous les clubs engagés), les
deux pages d'archive enregistrées à la main (voir SOURCES.md). Pour 2025 les
fichiers n'ont pas de préfixe.

Aucun vainqueur n'est calculé : l'état d'un club à un tour est la compétition
dans laquelle il a JOUÉ ce tour, et son arrivée est la compétition de sa phase
de groupes ou de ligue — ou éliminé s'il n'y figure pas. Les exemptés
(« Freilos ») comptent comme ayant joué leur tour. Le tour préliminaire de C1
(« Vorrunde ») est rangé avec le 1er tour.

Sortie : archive/sankey-saisons.json, { saison : { code : [[11 états, nom]] } }
États : q1, q2, q3, barrages, phase de groupes/ligue, barrages KO, 8es, quarts,
demies, finale, vainqueur. 0 = C1, 1 = C3, 2 = C4, -1 = pas (encore) en lice,
9 = éliminé. Un club exempté d'un tour (directement qualifié pour les 8es) est
compté présent à ce tour, dans la compétition où il le retrouve ensuite.
Le vainqueur d'une finale se lit au score, ou aux tirs au but.
Contrôles : effectif par nation = page « Pkt je Nat » ; taille de chaque phase
de groupes / de ligue (32 jusqu'en 2023/24, 36 depuis), puis 16 / 8 / 4 / 2 / 1
club par compétition en 8es, quarts, demies, finale, vainqueur.
"""
import json, os, re, sys
from collections import defaultdict
from bs4 import BeautifulSoup

DOSSIER = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sankey-saisons.json')
txt = lambda el: el.get_text(' ', strip=True).replace('\xa0', ' ').strip()

def table(chemin):
    soup = BeautifulSoup(open(chemin, encoding='utf-8', errors='replace').read(), 'html.parser')
    return max(soup.select('table'), key=lambda t: len(t.select('tr')))

def section(t):
    if re.search(r'Conference League', t): return 2
    if re.search(r'^Champions League', t): return 0
    if re.search(r'^Europa League', t): return 1
    return None

def comp_titre(t):                      # compétition écrite dans l'en-tête du tour
    if re.match(r'^UECL\b|^ECL\b', t): return 2
    if re.match(r'^EL\b', t) or 'EL Quali' in t: return 1
    if re.match(r'^CL\b', t): return 0
    return None

def tour(t):
    if 'Ligaphase' in t or 'Gruppenphase' in t: return 4
    if 'KO Playoff' in t: return 5
    if t == '1/8 Finale': return 6
    if t == '1/4 Finale': return 7
    if t == '1/2 Finale': return 8
    if t == 'Finale': return 9
    if 'Entscheidung' in t: return 3
    if 'Vorrunde' in t or re.search(r'\b1\. Quali', t): return 0
    if re.search(r'\b2\. Quali|Quali 2\b', t): return 1
    if re.search(r'\b3\. Quali|Quali 3\b', t): return 2
    return None

def lire_clubs(chemin):
    eff, cur = {}, None
    for tr in table(chemin).select('tr'):
        c = [txt(x) for x in tr.select('td, th')]
        if len(c) == 1:
            m = re.match(r'^(.+?)\s*\(([A-Z]{3})\)\s*\|', c[0]); cur = m.group(2) if m else cur; continue
        if cur and len(c) >= 12 and c[0] != 'Nr': eff.setdefault(cur, []).append(c[1])
    return eff

def lire_parcours(chemin):
    etats = defaultdict(lambda: [-1] * 4 + [9] + [-1] * 6)     # (pays, club) -> états
    vainqueurs = []
    sec, t, k = None, None, None
    for tr in table(chemin).select('tr'):
        c = [txt(x) for x in tr.select('td, th')]
        if len(c) == 1:
            h = c[0]; s = section(h)
            if s is not None: sec = s; t = None; continue
            t = tour(h)
            if t is None: continue
            k = sec if t >= 4 else (comp_titre(h) if comp_titre(h) is not None else sec)
            continue
        if t is None or len(c) < 8 or c[0] == 'Team': continue
        if t == 9 and re.match(r'^[A-Z]{3}$', c[1] or '') and re.match(r'^[A-Z]{3}$', c[3] or ''):
            n = lambda i: int(c[i]) if i < len(c) and re.match(r'^\d+$', c[i] or '') else None
            a_, b_ = n(5), n(7)
            if a_ == b_: a_, b_ = n(9), n(11)
            if a_ is not None and b_ is not None and a_ != b_:
                vainqueurs.append(((c[1], c[0]) if a_ > b_ else (c[3], c[2]), k))
        for club, pays in ((c[0], c[1]), (c[2], c[3])):
            if not re.match(r'^[A-Z]{3}$', pays or ''): continue
            e = etats[(pays, club)]
            if t >= 4: e[t] = k
            elif e[t] == -1 or k < e[t]: e[t] = k
    for (pays, club), k in vainqueurs: etats[(pays, club)][10] = k
    return etats, len(vainqueurs)

def main():
    out, bilan = {}, []
    for an in [2021, 2022, 2023, 2024, 2025]:
        pre = '' if an == 2025 else f'{an} '
        eff = lire_clubs(os.path.join(DOSSIER, pre + 'AV Pkt je Nat.html'))
        par, nv = lire_parcours(os.path.join(DOSSIER, pre + 'AV Spiele.html'))
        res, ecarts = {}, []
        for c, noms in eff.items():
            L = []
            for n in noms:
                e = list(par.get((c, n), [-1] * 4 + [9] + [-1] * 6))
                if e[4] == 9 and max(e[:4]) < 0: ecarts.append((c, n, 'aucun match'))
                # exempté d'un tour à élimination directe : présent, dans la compétition où on le retrouve
                for j in range(8, 4, -1):
                    if e[j] == -1 and e[j + 1] >= 0: e[j] = e[j + 1]
                if e[4] in (0, 1, 2) and e[5] == -1 and e[6] >= 0: e[5] = e[6]
                # éliminé : « 9 » à partir du tour qui suit son dernier tour joué
                der = max(j for j in range(11) if e[j] in (0, 1, 2)) if any(v in (0, 1, 2) for v in e) else -1
                if der < 10:
                    for j in range(der + 1, 11): e[j] = 9
                L.append(e + [n])
            res[c] = L
        # des clubs qui jouent sans figurer dans l'effectif ?
        connus = {(c, n) for c, v in eff.items() for n in v}
        intrus = [k for k in par if k not in connus]
        ligue = [sum(1 for v in res.values() for r in v if r[4] == k) for k in range(3)]
        attendu = 36 if an >= 2024 else 32
        if any(x != attendu for x in ligue): ecarts.append(('phases', ligue))
        for j, att in ((6, 16), (7, 8), (8, 4), (9, 2), (10, 1)):
            nb = [sum(1 for v in res.values() for r in v if r[j] == k) for k in range(3)]
            if nb != [att] * 3: ecarts.append((['', '', '', '', '', '', '8es', 'quarts', 'demies', 'finale', 'vainqueur'][j], nb))
        if nv != 3: ecarts.append(('finales lues', nv))
        if intrus: ecarts.append(('intrus', intrus[:5], len(intrus)))
        out[str(an)] = res
        n = sum(len(v) for v in res.values())
        gagnants = [r[11] for v in res.values() for r in v if r[10] in (0, 1, 2)]
        bilan.append(f'{an}/{str(an+1)[2:]} : {n} clubs · phases {ligue} · éliminés en été {sum(1 for v in res.values() for r in v if r[4]==9)} · vainqueurs {gagnants}' + (f' · ÉCARTS {ecarts}' if ecarts else ''))
    print('\n'.join(bilan))
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('->', OUT)

main()
