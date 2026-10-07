# -*- coding: utf-8 -*-
"""Bilan V/N/D club par club des saisons archivées (bloc 6b).

    python3 tools/uefa/archive/vnd-archive.py <dossier des pages d'archive>

Lit « AAAA AV Spiele.html » (2021 → 2024) et « AV Spiele.html » (2025) : tous
les matchs de la saison, tour par tour, enregistrés à la main (répertoire privé
de la source, interdit aux robots — voir SOURCES.md).

Un match = une victoire, un nul ou une défaite pour chacun des deux clubs, au
score après prolongation : les tirs au but ne comptent pas (règle du
coefficient). Les exemptions (« Freilos ») n'ont pas de score : ignorées.

Trois phases : qualifications (y compris barrages d'accès), phase de groupes ou
de ligue, phase finale (barrages KO compris). La compétition retenue pour un
club est celle de son dernier match de la saison (reversé de C1 en C3 : C3).

Sortie : archive/vnd-saisons.json
  { "2021": { "FRA": [[nom, compétition, [V,N,D] qualifs, [V,N,D] ligue, [V,N,D] finale], ...] } }
Contrôle : sur toute la saison, victoires = défaites, et nuls en nombre pair.
"""
import html, json, os, re, sys

DOSSIER = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vnd-saisons.json')
FICHIERS = {2021: '2021 AV Spiele.html', 2022: '2022 AV Spiele.html', 2023: '2023 AV Spiele.html',
            2024: '2024 AV Spiele.html', 2025: 'AV Spiele.html'}

def lignes(chemin):
    s = open(chemin, encoding='utf-8', errors='replace').read()
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S):
        yield [html.unescape(re.sub(r'<[^>]+>', '', c)).replace('\xa0', ' ').strip()
               for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, flags=re.S)]

def phase(h):
    if 'Ligaphase' in h or 'Gruppe' in h: return 1
    if re.search(r'Quali|Entscheidung|Vorrunde', h): return 0
    return 2

def saison(chemin):
    comp, ph, clubs, tot = 0, None, {}, [0, 0, 0]
    for c in lignes(chemin):
        if len(c) == 1 and c[0]:
            h = c[0]
            if h.startswith('Spiele der'): continue
            if h.startswith('Champions League'): comp = 0; continue
            if h.startswith('Europa League'): comp = 1; continue
            if h.startswith('Europa Conference'): comp = 2; continue
            ph = phase(h); continue
        if ph is None or len(c) < 8 or c[0] == 'Team': continue
        if not (re.match(r'^[A-Z]{3}$', c[1]) and re.match(r'^[A-Z]{3}$', c[3])): continue
        if not (c[5].isdigit() and c[7].isdigit()): continue
        a, b = int(c[5]), int(c[7])
        for nom, pays, g, o in ((c[0], c[1], a, b), (c[2], c[3], b, a)):
            r = 0 if g > o else 1 if g == o else 2
            e = clubs.setdefault((pays, nom), [comp, [0, 0, 0], [0, 0, 0], [0, 0, 0]])
            e[0] = comp; e[1 + ph][r] += 1; tot[r] += 1
    if tot[0] != tot[2] or tot[1] % 2: sys.exit(f'{chemin} : contrôle en échec {tot}')
    out = {}
    for (pays, nom), e in clubs.items(): out.setdefault(pays, []).append([nom, e[0], e[1], e[2], e[3]])
    for p in out: out[p].sort(key=lambda x: -sum(map(sum, x[2:])))
    return out, tot

res = {}
for an, f in FICHIERS.items():
    res[str(an)], tot = saison(os.path.join(DOSSIER, f))
    print(f'{an}/{(an + 1) % 100:02d} : {sum(tot) // 2} matchs, {len(res[str(an)])} nations, '
          f'{sum(len(v) for v in res[str(an)].values())} clubs — contrôle V = D OK')
json.dump(res, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('→', OUT, os.path.getsize(OUT), 'octets')
