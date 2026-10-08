# -*- coding: utf-8 -*-
"""Liste des matchs de chaque club, dans l'ordre où il les a joués, pour les
saisons archivées (bloc 6b : une case de gaufre = un match, avec son survol).

    python3 tools/uefa/archive/matchs-archive.py <dossier des pages d'archive>

Mêmes pages que vnd-archive.py et journees-archive.py (« AV Spiele »), même
lecture des tours et même découpage des journées de groupes ou de ligue.
Ordre : tour par tour (Q1 … barrages, J1 … Jn, barrages KO … finale), et dans
un tour aller-retour, l'aller puis le retour, comme sur la page.

Sortie : archive/matchs-saisons.json
  { "2021": { "n": 6, "noms": [[club, nation], …],
              "c": { "FRA": { club: [[étape, compétition, adversaire, buts pour, buts contre, domicile], …] } } } }
  étape = même colonne que journees-saisons.json ; compétition 0 C1, 1 C3, 2 C4 ;
  adversaire = indice dans « noms » ; domicile 1 si le club reçoit.
Contrôle : le bilan V/N/D de chaque club retrouve vnd-saisons.json.
"""
import html, json, os, re, sys
from collections import defaultdict

DOSSIER = sys.argv[1]
ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, 'matchs-saisons.json')
FICHIERS = {2021: '2021 AV Spiele.html', 2022: '2022 AV Spiele.html', 2023: '2023 AV Spiele.html',
            2024: '2024 AV Spiele.html', 2025: 'AV Spiele.html'}

def lignes(chemin):
    s = open(chemin, encoding='utf-8', errors='replace').read()
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S):
        yield [html.unescape(re.sub(r'<[^>]+>', '', c)).replace('\xa0', ' ').strip()
               for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, flags=re.S)]

def etape(h):
    if 'Ligaphase' in h or 'Gruppe' in h: return ('g', None)
    if 'KO Playoff' in h: return ('k', 0)
    if h == '1/8 Finale': return ('k', 1)
    if h == '1/4 Finale': return ('k', 2)
    if h == '1/2 Finale': return ('k', 3)
    if h == 'Finale': return ('k', 4)
    if 'Entscheidung' in h: return ('q', 3)
    if 'Vorrunde' in h or re.search(r'\b1\. Quali', h): return ('q', 0)
    if re.search(r'\b2\. Quali|Quali 2\b', h): return ('q', 1)
    if re.search(r'\b3\. Quali|Quali 3\b', h): return ('q', 2)
    sys.exit(f'en-tête de tour inconnu : {h!r}')

def saison(chemin, an):
    ligue = an >= 2024
    nJ = 8 if ligue else 6
    noms, idx = [], {}
    def nid(t, p):
        if (t, p) not in idx: idx[(t, p)] = len(noms); noms.append([t, p])
        return idx[(t, p)]
    par = defaultdict(list)                     # (nation, club) -> [(étape, rang, match)]
    rang = [0]
    k, et, bloc = None, None, []
    def note(col, m):
        (t1, p1, t2, p2, a, b) = m
        rang[0] += 1
        par[(p1, t1)].append((col, rang[0], [col, k, nid(t2, p2), a, b, 1]))
        par[(p2, t2)].append((col, rang[0], [col, k, nid(t1, p1), b, a, 0]))
    def vider():
        if not bloc: return
        n = 18 if ligue else 2
        jours = 6 if (ligue and len(bloc) == 108) else nJ
        if len(bloc) != n * jours: sys.exit(f'{an} : section de {len(bloc)} matchs, attendu {n * jours}')
        for j in range(jours):
            chunk = bloc[j * n:(j + 1) * n]
            vus = [m[0] for m in chunk] + [m[2] for m in chunk]
            if len(set(vus)) != len(vus): sys.exit(f'{an} : journée {j + 1} — découpage faux')
            for m in chunk: note(4 + j, m)
        bloc.clear()
    for c in lignes(chemin):
        if len(c) == 1 and c[0]:
            h = c[0]
            if h.startswith('Spiele der'): continue
            if h.startswith('Champions League'): vider(); k = 0; continue
            if h.startswith('Europa League'): vider(); k = 1; continue
            if h.startswith('Europa Conference') or h.startswith('Conference'): vider(); k = 2; continue
            vider(); et = etape(h); continue
        if et is None or len(c) < 8 or c[0] == 'Team': continue
        if not (re.match(r'^[A-Z]{3}$', c[1]) and re.match(r'^[A-Z]{3}$', c[3])): continue
        if not (c[5].isdigit() and c[7].isdigit()): continue
        m = (c[0], c[1], c[2], c[3], int(c[5]), int(c[7]))
        if et[0] == 'g': bloc.append(m)
        elif et[0] == 'q': note(et[1], m)
        else: note(4 + nJ + et[1], m)
    vider()
    out = defaultdict(dict)
    for (p, t), L in par.items():
        out[p][t] = [m for _, _, m in sorted(L, key=lambda z: (z[0], z[1]))]
    return {'n': nJ, 'noms': noms, 'c': {p: out[p] for p in sorted(out)}}

VND = json.load(open(os.path.join(ICI, 'vnd-saisons.json'), encoding='utf-8'))
res, ecarts = {}, 0
for an, f in FICHIERS.items():
    S = saison(os.path.join(DOSSIER, f), an)
    res[str(an)] = S
    # contrôle : bilan total de chaque club = vnd-saisons.json
    V = VND[str(an)]
    nb = 0
    for p, clubs in V.items():
        for r in clubs:
            L = S['c'].get(p, {}).get(r[0], [])
            t = [0, 0, 0]
            for m in L: t[0 if m[3] > m[4] else 1 if m[3] == m[4] else 2] += 1
            ref = [r[2][i] + r[3][i] + r[4][i] for i in range(3)]
            nb += len(L)
            if t != ref: ecarts += 1; print('  ÉCART', an, p, r[0], t, ref)
    print(f'{an}/{(an + 1) % 100:02d} : {len(S["noms"])} clubs, {nb} matchs-club')
if ecarts: sys.exit(f'{ecarts} écarts avec vnd-saisons.json')
json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('→', OUT, os.path.getsize(OUT), 'octets')
