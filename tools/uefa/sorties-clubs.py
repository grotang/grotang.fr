# -*- coding: utf-8 -*-
"""Tour de sortie de chaque club éliminé en qualifications, nommé comme la source.

    python3 tools/uefa/sorties-clubs.py

Le grand livre (wiki/qualifs-AAAA.json) nomme les clubs à la manière de
Wikipédia (« Lech Poznań »), la source quotidienne à la sienne (« Lech Poznan »).
On rapproche les deux à l'intérieur d'une même nation, parmi les seuls clubs
que la source dit éliminés : l'ambiguïté se réduit alors à deux ou trois noms.
Sortie : wiki/sorties-AAAA.json, { code : { nom source : tour } }, tour 0..3
pour Q1, Q2, Q3, barrages. Elle alimente l'infobulle « clubs » du bloc 7a.
"""
import json, os, re, sys, unicodedata
from collections import defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
QUAL = os.path.join(ICI, 'wiki', 'qualifs-2026-27.json')
NAT = os.path.join(ICI, 'nations.json')
EFF = os.path.join(ICI, 'fixtures', 'expected.json')     # effectif nommé par la source
OUT = os.path.join(ICI, 'wiki', 'sorties-2026-27.json')
TOURS = ['Q1', 'Q2', 'Q3', 'PO']
ALIAS = {'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Georgia (country)': 'Georgia'}
VIDE = {'fc','fk','sc','cf','ac','as','sk','nk','afc','cd','club','de','fs','ks','sv','bk','if','ff','sp','cs','kf','gks','mfk','pfc','ofk','hnk','sd','ud','rc','the','united','city','1','2'}

def jetons(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    t = set(re.findall(r'[a-z0-9]+', s)) - VIDE
    return t or set(re.findall(r'[a-z0-9]+', s))

def proche(a, b):
    A, B = jetons(a), jetons(b)
    commun = len(A & B)
    pref = sum(1 for x in A for y in B if x != y and len(x) > 3 and len(y) > 3 and (x.startswith(y[:4]) or y.startswith(x[:4])))
    return commun * 2 + pref

def main():
    L = json.load(open(QUAL, encoding='utf-8'))
    N = json.load(open(NAT, encoding='utf-8'))
    E = json.load(open(EFF, encoding='utf-8'))['eff']
    code = {n['n']: n['c'] for n in N}
    parcours = defaultdict(list)
    for x in L:
        if x.get('bye'): continue
        parcours[(x['club'], code[ALIAS.get(x['pays'], x['pays'])])].append(x)
    sorties = defaultdict(list)                     # nation -> [(nom wiki, tour)]
    for (club, c), et in parcours.items():
        et.sort(key=lambda x: TOURS.index(x['tour']))
        fin = et[-1]
        if fin['gagne']: continue
        t, k, voie = fin['tour'], fin['k'], fin.get('voie') or ''
        if (k == 0 and t == 'PO') or (k == 0 and t == 'Q3' and 'League' in voie) or (k == 1 and t == 'PO'): continue
        sorties[c].append((club, TOURS.index(t)))
    out, doutes, total = {}, [], 0
    for c, liste in sorties.items():
        morts = [r[0] for r in E.get(c, []) if r[2]]
        libres = set(morts)
        for club, t in sorted(liste, key=lambda z: -max([proche(z[0], m) for m in morts] or [0])):
            if not libres: doutes.append((c, club, 'aucun club éliminé libre')); continue
            meilleur = max(libres, key=lambda m: proche(club, m))
            score = proche(club, meilleur)
            if score == 0 and len(libres) > 1: doutes.append((c, club, sorted(libres))); continue
            out.setdefault(c, {})[meilleur] = t; libres.discard(meilleur); total += 1
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, sort_keys=True)
    print(f'{total} sorties rapprochées sur {sum(len(v) for v in sorties.values())}')
    for d in doutes: print('  DOUTE', d)

main()
