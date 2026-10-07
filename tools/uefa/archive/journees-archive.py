# -*- coding: utf-8 -*-
"""Bilan V/N/D par nation, étape par étape (journée par journée en phase de
ligue ou de groupes), pour les saisons archivées (bloc 6a).

    python3 tools/uefa/archive/journees-archive.py <dossier des pages d'archive>

Mêmes pages que vnd-archive.py (« AV Spiele », tous les matchs). Étapes :
  Q1 Q2 Q3 Bar. | J1 … J8 (ligue, depuis 2024/25) ou J1 … J6 (groupes) | Barr. KO, 8es, 1/4, 1/2, F
Le tour préliminaire de C1 (« Vorrunde ») est rangé avec le 1er tour.

La page ne date pas les matchs de phase de groupes ou de ligue : ils y sont
rangés journée après journée. On découpe donc la liste en blocs égaux (18 matchs
par journée en phase de ligue, 2 par groupe en phase de groupes) et on CONTRÔLE
que chaque club apparaît exactement une fois par journée — sinon on s'arrête.

Sortie : archive/journees-saisons.json
  { "2021": { "n": 6, "FRA": [[V,N,D] × (4 + n + 5)] } }   n = journées de groupes ou de ligue
"""
import html, json, os, re, sys
from collections import defaultdict

DOSSIER = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'journees-saisons.json')
FICHIERS = {2021: '2021 AV Spiele.html', 2022: '2022 AV Spiele.html', 2023: '2023 AV Spiele.html',
            2024: '2024 AV Spiele.html', 2025: 'AV Spiele.html'}

def lignes(chemin):
    s = open(chemin, encoding='utf-8', errors='replace').read()
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S):
        yield [html.unescape(re.sub(r'<[^>]+>', '', c)).replace('\xa0', ' ').strip()
               for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, flags=re.S)]

def etape(h):
    """('q', 0..3) qualifs · ('g', None) groupes/ligue · ('k', 0..4) phase finale"""
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
    res = defaultdict(lambda: [[0, 0, 0] for _ in range(4 + nJ + 5)])
    sec, et, bloc = None, None, []          # bloc : matchs d'une section de groupes / ligue
    def note(col, m):
        (t1, p1, t2, p2, a, b) = m
        for p, g, o in ((p1, a, b), (p2, b, a)):
            res[p][col][0 if g > o else 1 if g == o else 2] += 1
    def vider():
        if not bloc: return
        par = 18 if ligue else 2
        jours = nJ if ligue else 6
        # en phase de ligue, la C4 n'a que 6 journées : 108 matchs
        if ligue and len(bloc) == 108: jours = 6
        if len(bloc) != par * jours: sys.exit(f'{an} : section de {len(bloc)} matchs, attendu {par * jours}')
        for j in range(jours):
            chunk = bloc[j * par:(j + 1) * par]
            vus = [m[0] for m in chunk] + [m[2] for m in chunk]
            if len(set(vus)) != len(vus): sys.exit(f'{an} : journée {j + 1} — un club joue deux fois, découpage faux')
            for m in chunk: note(4 + j, m)
        bloc.clear()
    for c in lignes(chemin):
        if len(c) == 1 and c[0]:
            h = c[0]
            if h.startswith('Spiele der') or h.startswith('Champions League') or h.startswith('Europa'): vider(); continue
            vider(); et = etape(h); continue
        if et is None or len(c) < 8 or c[0] == 'Team': continue
        if not (re.match(r'^[A-Z]{3}$', c[1]) and re.match(r'^[A-Z]{3}$', c[3])): continue
        if not (c[5].isdigit() and c[7].isdigit()): continue
        m = (c[0], c[1], c[2], c[3], int(c[5]), int(c[7]))
        if et[0] == 'g': bloc.append(m)
        elif et[0] == 'q': note(et[1], m)
        else: note(4 + nJ + et[1], m)
    vider()
    out = {'n': nJ}; out.update({p: v for p, v in sorted(res.items())})
    tv = sum(x[0] for p in res for x in res[p]); td = sum(x[2] for p in res for x in res[p])
    if tv != td: sys.exit(f'{an} : victoires {tv} ≠ défaites {td}')
    return out, tv

res = {}
for an, f in FICHIERS.items():
    res[str(an)], tv = saison(os.path.join(DOSSIER, f), an)
    print(f'{an}/{(an + 1) % 100:02d} : {res[str(an)]["n"]} journées, {len(res[str(an)]) - 1} nations, {tv} victoires = défaites — découpage OK')
json.dump(res, open(OUT, 'w'), separators=(',', ':'))
print('→', OUT, os.path.getsize(OUT), 'octets')
