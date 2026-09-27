# -*- coding: utf-8 -*-
"""Le grand livre des qualifications : qui sort, et a quel tour.

    python3 tools/uefa/survie.py [--ecrire]

Entree  : tools/uefa/wiki/qualifs-2026-27.json (produit par parse-wiki.py)
          tools/uefa/nations.json              (la source du site)
Sortie  : tools/uefa/wiki/survie-2026-27.json  { code: [apres Q1, Q2, Q3, barrages] }
          et, avec --ecrire, le bloc QUAL de tools/uefa/page.html

Le piege : un club sorti du Q1 de C1 n'est pas sorti d'Europe
------------------------------------------------------------
Il bascule en C3 ou en C4 et continue. Un club n'est donc elimine qu'a sa
DERNIERE apparition, toutes competitions confondues — et encore, pas toujours :
trois defaites mènent directement a une phase de ligue, sans autre match, donc
sans autre ligne dans les tableaux.

  * defaite au barrage de C1  -> phase de ligue de C3
  * defaite au Q3 de C1, voie des champions ecartee (League Path) -> phase de ligue de C3
  * defaite au barrage de C3  -> phase de ligue de C4

Ces trois cas sont la seule chose que le script sait et que les tableaux ne
disent pas. Tout le reste se deduit des donnees : si un club reapparait plus
tard, c'est qu'il jouait encore.

Le controle : pour chaque association, engages - somme des elimines doit
retrouver l'effectif encore en lice publie par la source. 53 egalites que rien
n'oblige a tomber juste si l'extraction est fausse quelque part.
"""
import json, os, sys
from collections import defaultdict

ICI = os.path.dirname(os.path.abspath(__file__))
QUAL = os.path.join(ICI, 'wiki', 'qualifs-2026-27.json')
NAT  = os.path.join(ICI, 'nations.json')
OUT  = os.path.join(ICI, 'wiki', 'survie-2026-27.json')
PAGE = os.path.join(ICI, 'page.html')
SENT = ('/*QUAL_START*/', '/*QUAL_END*/')

TOURS = ['Q1', 'Q2', 'Q3', 'PO']
ALIAS = {'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Georgia (country)': 'Georgia'}

def main():
    L = json.load(open(QUAL, encoding='utf-8'))
    N = json.load(open(NAT, encoding='utf-8'))
    code = {n['n']: n['c'] for n in N}
    BY = {n['c']: n for n in N}

    inconnus = sorted({x['pays'] for x in L if ALIAS.get(x['pays'], x['pays']) not in code})
    if inconnus: print('PAYS INCONNUS :', inconnus); sys.exit(1)

    # parcours de chaque club, dans l'ordre des tours
    parcours = defaultdict(list)
    clubs_vus = defaultdict(set)
    for x in L:
        c = code[ALIAS.get(x['pays'], x['pays'])]
        parcours[(x['club'], c)].append(x)
        clubs_vus[c].add(x['club'])

    elim = defaultdict(lambda: [0, 0, 0, 0])      # par nation, par tour
    repeches = []
    for (club, c), etapes in parcours.items():
        etapes.sort(key=lambda x: TOURS.index(x['tour']))
        fin = etapes[-1]
        if fin['gagne']: continue                  # qualifie pour une phase de ligue
        t, k, voie = fin['tour'], fin['k'], fin.get('voie') or ''
        vivant = (k == 0 and t == 'PO') or (k == 0 and t == 'Q3' and 'League' in voie) or (k == 1 and t == 'PO')
        if vivant: repeches.append((club, c, k, t)); continue
        elim[c][TOURS.index(t)] += 1

    # ---- l'effectif engage, y compris la ou la source ne le donne pas ----
    # La source deduit le diviseur du coefficient de saison ; quand une
    # association n'a marque aucun point, la division est impossible et le
    # champ manque. Le Montenegro disparaissait ainsi de la page alors qu'il
    # avait bel et bien engage quatre clubs. Le grand livre les compte.
    # Prudence : ce rattrapage ne vaut que pour une association dont TOUS les
    # clubs sont passes par les qualifications — un club entre directement en
    # phase de ligue n'apparait dans aucun tableau et serait oublie.
    survie, ecarts, rattrapes = {}, [], []
    for n in N:
        eng = n.get('divisor') or 0
        vus = len(clubs_vus.get(n['c'], ()))
        if not eng and vus and n['a'][3] == 0:
            eng = vus; rattrapes.append((n['c'], vus))
        if not eng: continue
        e = elim[n['c']]
        reste, serie = eng, []
        for i in range(4):
            reste -= e[i]; serie.append(reste)
        survie[n['c']] = {'e': eng, 's': serie}
        if reste != n['a'][3]: ecarts.append((n['c'], eng, e, reste, n['a'][3]))
    for c, v in rattrapes: print(f'RATTRAPE : {c} absent des engages cote source, {v} clubs releves dans les tableaux')

    print(f"{len(survie)} associations engagees, {sum(sum(v) for v in elim.values())} eliminations datees, {len(repeches)} repechages directs en phase de ligue")
    for t in range(4):
        print(f'  {TOURS[t]} : {sum(v[t] for v in elim.values()):3d} clubs sortis d\'Europe')
    if ecarts:
        print('\nECARTS :')
        for c, eng, e, r, vrai in ecarts: print(f'  {c} : engages {eng}, elimines {e}, calcul {r}, source {vrai}')
        sys.exit(1)
    print(f'\nCONTROLE OK : les {len(survie)} associations retrouvent l\'effectif publie par la source.')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(survie, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print('->', OUT)

    if '--ecrire' in sys.argv:
        src = open(PAGE, encoding='utf-8').read()
        a, b = src.index(SENT[0]), src.index(SENT[1])
        src = src[:a] + SENT[0] + 'const QUALS = ' + json.dumps(survie, ensure_ascii=False, separators=(',', ':')) + ';' + src[b:]
        open(PAGE + '.tmp', 'wb').write(src.encode('utf-8')); os.replace(PAGE + '.tmp', PAGE)
        print('-> bloc QUAL de page.html mis a jour')

main()
