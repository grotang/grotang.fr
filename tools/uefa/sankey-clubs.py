# -*- coding: utf-8 -*-
"""Parcours d'été de chaque club engagé, tour par tour : dans quelle compétition
il a joué le 1er tour (Q1), le 2e (Q2), le 3e (Q3), les barrages, et où il est
arrivé (phase de ligue d'une compétition, ou éliminé). Alimente le bloc 7c
(Sankey des bascules).

    python3 tools/uefa/sankey-clubs.py

Sources : le grand livre des qualifications (wiki/qualifs-AAAA.json) pour les
clubs passés par l'été, l'effectif de la source (fixtures/expected.json, champ
eff) pour les clubs entrés directement en phase de ligue et pour les noms.
Sortie : wiki/sankey-AAAA.json (et wiki/noms-AAAA.json, nom Wikipédia -> nom source), { code : [[11 états, nom source]] } — les
mêmes onze colonnes que les saisons archivées (q1, q2, q3, barrages, phase de
ligue, barrages KO, 8es, quarts, demies, finale, vainqueur). La phase finale
n'étant pas jouée, ses six états valent -1 (à venir) ou 9 (éliminé en été).
Pour les quatre tours : 0 = C1, 1 = C3, 2 = C4, -1 = pas (encore) en lice,
9 = déjà éliminé. Pour la phase de ligue : 0, 1, 2, ou 9 = éliminé en été.
Un exempté (« bye ») compte comme ayant joué et passé son tour.
Contrôle : le nombre de clubs par nation retrouve l'effectif de la source.
"""
import json, os, re, sys, unicodedata
from collections import defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
QUAL = os.path.join(ICI, 'wiki', 'qualifs-2026-27.json')
NAT = os.path.join(ICI, 'nations.json')
EFF = os.path.join(ICI, 'fixtures', 'expected.json')
OUT = os.path.join(ICI, 'wiki', 'sankey-2026-27.json')
NOMS = os.path.join(ICI, 'wiki', 'noms-2026-27.json')   # Wikipédia -> source, par nation (bloc 6b)
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
        par[(x['club'], code[ALIAS.get(x['pays'], x['pays'])])].append(x)
    parcours = defaultdict(list)                       # nation -> [(nom wiki, entrée, été, arrivée)]
    for (club, c), et in par.items():
        et.sort(key=lambda x: TOURS.index(x['tour']))
        e, fin = et[0]['k'], et[-1]
        t, k, voie = fin['tour'], fin['k'], fin.get('voie') or ''
        if fin['gagne']: a = k
        elif (k == 0 and t == 'PO') or (k == 0 and t == 'Q3' and 'League' in voie): a = 1   # reversé en C3 sans autre match
        elif k == 1 and t == 'PO': a = 2                                                      # reversé en C4 sans autre match
        else: a = 9
        etat = [-1, -1, -1, -1]
        for x in et: etat[TOURS.index(x['tour'])] = x['k']
        der = max(TOURS.index(x['tour']) for x in et)
        if a == 9:
            for j in range(der + 1, 4): etat[j] = 9
        parcours[c].append((club, etat + [a] + [9 if a == 9 else -1] * 6))
    out, ecarts, doutes, carte = {}, [], [], defaultdict(dict)
    for c, rows in E.items():
        libres = {r[0]: r for r in rows}
        res = []
        todo = []
        for club, et in parcours.get(c, []):
            if EGAL.get(club) in libres: res.append(et + [EGAL[club]]); carte[c][club] = EGAL[club]; del libres[EGAL[club]]
            else: todo.append((club, et))
        for club, et in sorted(todo, key=lambda z: -max([proche(z[0], n) for n in libres] or [0])):
            if not libres: doutes.append((c, club)); continue
            n = max(libres, key=lambda x: proche(club, x))
            if proche(club, n) == 0 and len(libres) > 1: doutes.append((c, club, sorted(libres))); continue
            res.append(et + [n]); carte[c][club] = n; del libres[n]
        for n, r in libres.items():                    # entrés directement en phase de ligue
            res.append([-1, -1, -1, -1, r[1]] + [-1] * 6 + [n])
        out[c] = res
        if len(res) != len(rows): ecarts.append((c, len(res), len(rows)))
        statut = {r[0]: r[2] for r in rows}            # contrôle : éliminé ici <=> éliminé à la source
        for r in res:
            if (r[4] == 9) != bool(statut[r[11]]): ecarts.append((c, r[11], 'statut'))
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    json.dump(carte, open(NOMS, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    tout = [r for v in out.values() for r in v]
    ligue = [sum(1 for r in tout if r[4] == k) for k in range(3)]
    if ligue != [36, 36, 36]: ecarts.append(('phases de ligue', ligue))
    print(f'{len(tout)} clubs · {sum(1 for r in tout if r[4] == 9)} éliminés · ligue {ligue} · {len(doutes)} doutes · écarts {ecarts}')
    for d in doutes: print('  DOUTE', d)
    if ecarts or doutes: sys.exit(1)

main()
