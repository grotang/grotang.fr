# -*- coding: utf-8 -*-
"""Matchs de qualification de la saison en cours, club par club, dans l'ordre
(bloc 6b : une case de gaufre = un match, avec son survol).

    python3 tools/uefa/matchs-cour.py <dossier des pages Wikipédia>

Lit les trois pages Wikipédia des qualifications enregistrées à la main (les
mêmes que parse-wiki.py) : pour chaque confrontation, l'aller (équipe 1 à
domicile) puis le retour (équipe 2 à domicile), scores après prolongation, les
tirs au but ne comptant pas (nul). Les noms Wikipédia sont ramenés aux noms de
la source par wiki/noms-2026-27.json (écrit par sankey-clubs.py).
La phase de ligue n'a pas de liste de matchs publique : seul l'été est détaillé.

Sortie : wiki/matchs-2026-27.json, même forme qu'une saison de
archive/matchs-saisons.json.
Contrôle : le bilan V/N/D de chaque club retrouve celui de la source (D.eff).
"""
import copy, json, os, re, sys
from bs4 import BeautifulSoup

DOSSIER = sys.argv[1] if len(sys.argv) > 1 else '.'
ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, 'wiki', 'matchs-2026-27.json')
COMPET = {'Champions': 0, 'Europa': 1, 'Conference': 2}
TOURS = {'First qualifying round': 0, 'Second qualifying round': 1, 'Third qualifying round': 2, 'Play-off round': 3}
ALIAS = {'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Georgia (country)': 'Georgia'}

def equipe(cell):
    img = cell.find('img', alt=True)
    pays = img['alt'].strip() if img else None
    c = copy.copy(cell)
    for f in c.select('span.flagicon, sup'): f.decompose()
    return re.sub(r'\s*\[[^\]]*\]\s*', ' ', c.get_text(' ', strip=True)).strip(), pays

def score(t):
    m = re.match(r'\s*(\d+)\s*[–-]\s*(\d+)', t)
    return (int(m.group(1)), int(m.group(2))) if m else None

code = {n['n']: n['c'] for n in json.load(open(os.path.join(ICI, 'nations.json'), encoding='utf-8'))}
carte = json.load(open(os.path.join(ICI, 'wiki', 'noms-2026-27.json'), encoding='utf-8'))
noms, idx, par = [], {}, {}
def nid(t, p):
    if (t, p) not in idx: idx[(t, p)] = len(noms); noms.append([t, p])
    return idx[(t, p)]
rang = 0
matchs = []
for f in sorted(os.listdir(DOSSIER)):
    if not f.endswith('.html') or 'qualifying' not in f: continue
    k = next((v for mot, v in COMPET.items() if mot in f), None)
    if k is None: continue
    soup = BeautifulSoup(open(os.path.join(DOSSIER, f), encoding='utf-8').read(), 'html.parser')
    tour = None
    for el in soup.find_all(['h2', 'h3', 'table']):
        if el.name in ('h2', 'h3'):
            t = el.get_text(' ', strip=True)
            if t in TOURS: tour = TOURS[t]
            continue
        if tour is None or not el.select('tr'): continue
        ent = [c.get_text(' ', strip=True) for c in el.select('tr')[0].select('th,td')]
        if len(ent) < 5 or not ent[0].startswith('Team 1') or not ent[1].startswith('Agg'): continue
        for tr in el.select('tr')[1:]:
            cs = tr.select('td')
            if len(cs) < 5: continue
            (n1, p1), (n2, p2) = equipe(cs[0]), equipe(cs[2])
            a, r = score(cs[3].get_text(' ', strip=True)), score(cs[4].get_text(' ', strip=True))
            if not (n1 and n2 and p1 and p2 and a and r): continue
            c1, c2 = code[ALIAS.get(p1, p1)], code[ALIAS.get(p2, p2)]
            s1, s2 = carte.get(c1, {}).get(n1, n1), carte.get(c2, {}).get(n2, n2)
            for (g1, g2), dom in ((a, 1), (r, 0)):
                rang += 1
                matchs.append((c1, s1, (tour, rang, [tour, k, nid(s2, c2), g1, g2, dom])))
                matchs.append((c2, s2, (tour, rang, [tour, k, nid(s1, c1), g2, g1, 1 - dom])))
out = {}
for c, s, m in matchs: out.setdefault(c, {}).setdefault(s, []).append(m)
for c in out:
    for s in out[c]: out[c][s] = [m for _, _, m in sorted(out[c][s], key=lambda z: (z[0], z[1]))]

# contrôle contre le bilan de qualification de la source
page = open(os.path.join(ICI, 'page.html'), encoding='utf-8').read()
D = json.loads(re.search(r'/\*DATA_START\*/const D = (.*?);/\*DATA_END\*/', page, re.S).group(1))
ecarts = 0
for c, rows in D['eff'].items():
    for r in rows:
        if len(r) < 10: continue
        t = [0, 0, 0]
        for m in out.get(c, {}).get(r[0], []): t[0 if m[3] > m[4] else 1 if m[3] == m[4] else 2] += 1
        if t != [r[4], r[5], r[6]]: ecarts += 1; print('  ÉCART', c, r[0], t, r[4:7])
inconnus = [(c, s) for c in out for s in out[c] if s not in {r[0] for r in D['eff'].get(c, [])}]
for x in inconnus: print('  INCONNU', x)
json.dump({'n': 8, 'noms': noms, 'c': {c: out[c] for c in sorted(out)}}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{sum(len(v) for c in out for v in out[c].values())} matchs-club · {ecarts} écarts · {len(inconnus)} inconnus → {OUT}')
if ecarts or inconnus: sys.exit(1)
