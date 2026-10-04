# -*- coding: utf-8 -*-
"""Parcours d'été de chaque club engagé : compétition d'entrée, compétition où
il a fini l'été, et où il est arrivé (phase de ligue d'une compétition, ou
éliminé). Alimente le bloc 7c (Sankey des bascules).

    python3 tools/uefa/sankey-clubs.py

Sources : le grand livre des qualifications (wiki/qualifs-AAAA.json) pour les
clubs passés par l'été, l'effectif de la source (fixtures/expected.json, champ
eff) pour les clubs entrés directement en phase de ligue et pour les noms.
Sortie : wiki/sankey-AAAA.json, { code : [[entrée, été, arrivée, nom source]] }
avec 0 = C1, 1 = C3, 2 = C4, 3 = éliminé.
Contrôle : le nombre de clubs par nation retrouve l'effectif de la source.
"""
import json, os, re, sys, unicodedata
from collections import defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
QUAL = os.path.join(ICI, 'wiki', 'qualifs-2026-27.json')
NAT = os.path.join(ICI, 'nations.json')
EFF = os.path.join(ICI, 'fixtures', 'expected.json')
OUT = os.path.join(ICI, 'wiki', 'sankey-2026-27.json')
TOURS = ['Q1', 'Q2', 'Q3', 'PO']
ALIAS = {'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Georgia (country)': 'Georgia'}
# Noms que le rapprochement par mots ne peut pas deviner (traduction, ville
# commune à deux clubs). Wikipédia -> source.
EGAL = {'Red Star Belgrade': 'Crvena Zvezda', 'Dynamo Kyiv': 'Dinamo Kiev', 'Partizan': 'Partizan Belgrade'}
VIDE = {'fc','fk','sc','cf','ac','as','sk','nk','afc','cd','club','de','fs','ks','sv','bk','if','ff','sp','cs','kf','gks','mfk','pfc','ofk','hnk','sd','ud','rc','the','united','city','1','2'}

def jetons(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    t = set(re.findall(r'[a-z0-9]+', s)) - VIDE
    return t or set(re.findall(r'[a-z0-9]+', s))

def proche(a, b):
    A, B = jetons(a), jetons(b)
    pref = sum(1 for x in A for y in B if x != y and len(x) > 3 and len(y) > 3 and (x.startswith(y[:4]) or y.startswith(x[:4])))
    return len(A & B) * 2 + pref

def main():
    L = json.load(open(QUAL, encoding='utf-8'))
    code = {n['n']: n['c'] for n in json.load(open(NAT, encoding='utf-8'))}
    E = json.load(open(EFF, encoding='utf-8'))['eff']
    par = defaultdict(list)
    for x in L:
        if x.get('bye'): continue
        par[(x['club'], code[ALIAS.get(x['pays'], x['pays'])])].append(x)
    parcours = defaultdict(list)                       # nation -> [(nom wiki, entrée, été, arrivée)]
    for (club, c), et in par.items():
        et.sort(key=lambda x: TOURS.index(x['tour']))
        e, fin = et[0]['k'], et[-1]
        t, k, voie = fin['tour'], fin['k'], fin.get('voie') or ''
        if fin['gagne']: m, a = k, k
        elif (k == 0 and t == 'PO') or (k == 0 and t == 'Q3' and 'League' in voie): m, a = 1, 1   # reversé en C3 sans autre match
        elif k == 1 and t == 'PO': m, a = 2, 2                                                      # reversé en C4 sans autre match
        else: m, a = k, 3
        parcours[c].append((club, e, m, a))
    out, ecarts, doutes = {}, [], []
    for c, rows in E.items():
        libres = {r[0]: r for r in rows}
        res = []
        todo = []
        for club, e, m, a in parcours.get(c, []):
            if EGAL.get(club) in libres: res.append([e, m, a, EGAL[club]]); del libres[EGAL[club]]
            else: todo.append((club, e, m, a))
        for club, e, m, a in sorted(todo, key=lambda z: -max([proche(z[0], n) for n in libres] or [0])):
            if not libres: doutes.append((c, club)); continue
            n = max(libres, key=lambda x: proche(club, x))
            if proche(club, n) == 0 and len(libres) > 1: doutes.append((c, club, sorted(libres))); continue
            res.append([e, m, a, n]); del libres[n]
        for n, r in libres.items():                    # entrés directement en phase de ligue
            res.append([r[1], r[1], r[1], n])
        out[c] = res
        if len(res) != len(rows): ecarts.append((c, len(res), len(rows)))
        statut = {r[0]: r[2] for r in rows}            # contrôle : éliminé ici <=> éliminé à la source
        for r in res:
            if (r[2] == 3) != bool(statut[r[3]]): ecarts.append((c, r[3], 'statut'))
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    tout = [r for v in out.values() for r in v]
    print(f'{len(tout)} clubs · {sum(1 for r in tout if r[2] == 3)} éliminés · {len(doutes)} doutes · écarts {ecarts}')
    for d in doutes: print('  DOUTE', d)
    if ecarts or doutes: sys.exit(1)

main()
