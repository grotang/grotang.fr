# -*- coding: utf-8 -*-
"""Decomposition en quatre postes d'une saison archivee, pour les 55 associations.

    python3 tools/uefa/archive/lire-archive.py <dossier> <annee de depart>

Entrees : les deux pages d'archive de la source, enregistrees a la main depuis
le navigateur (repertoire prive, interdit aux robots — voir SOURCES.md) :
    « AV Pkt je Nat.html »  effectif, coefficient, et par club : Q/H gagnes,
                            nuls, perdus, bonus, total
    « AV Spiele.html »      tous les matchs de la saison, tour par tour

Pourquoi les deux
-----------------
« Pkt je Nat » donne un decoupage a trois : qualifications, Hauptrunde, bonus.
Le bloc 2b en veut quatre : il faut separer la phase de ligue de la phase
finale, et isoler le bonus d'entree du reste des bonus. Seule la liste des
matchs sait quel tour chaque club a joue.

Controle : la somme des quatre postes doit retrouver, au millieme, le
coefficient de saison publie par la source pour chacune des 55 associations.
"""
import json, os, re, sys
from collections import defaultdict
from bs4 import BeautifulSoup

DOSSIER = sys.argv[1]
ANNEE   = int(sys.argv[2])          # 2025 = saison 2025/26

txt = lambda el: el.get_text(' ', strip=True).replace('\xa0', ' ').strip()
nb  = lambda s: float(str(s).replace(',', '.')) if re.match(r'^-?[\d.,]+$', str(s or '').strip()) else 0.0

# ---------- 1. effectifs, coefficients, bilans par club ----------
def lire_nations(chemin):
    soup = BeautifulSoup(open(chemin, encoding='utf-8', errors='replace').read(), 'html.parser')
    tab = max(soup.select('table'), key=lambda t: len(t.select('tr')))
    nations, cur = {}, None
    for tr in tab.select('tr'):
        cells = [txt(c) for c in tr.select('td, th')]
        if len(cells) == 1:
            m = re.match(r'^(.+?)\s*\(([A-Z]{3})\)\s*\|\s*Teampunkte Gesamt:\s*([\d.,]+)\s*\|\s*Nationenpunkte:\s*([\d.,]+)', cells[0])
            if m:
                cur = m.group(2)
                nations[cur] = {'nom': m.group(1), 'coef': nb(m.group(4)), 'clubs': []}
            continue
        if not cur or len(cells) < 12 or cells[0] == 'Nr': continue
        nations[cur]['clubs'].append({
            'nom': cells[1], 'SQ': nb(cells[2]), 'UQ': nb(cells[3]),
            'SH': nb(cells[5]), 'UH': nb(cells[6]),
            'bonus': nb(cells[8]), 'pkt': nb(cells[9]), 'at': nb(cells[11])})
    for c, n in nations.items():
        n['eng'] = int(max((x['at'] for x in n['clubs']), default=0))
    return nations

# ---------- 2. les matchs, tour par tour ----------
# Trois phases, et rien d'autre : ce que la source appelle Quali (y compris les
# « Entscheidungsspiele », c'est-a-dire les barrages d'acces), la Ligaphase, et
# tout ce qui suit a partir du KO Playoff.
def phase(t):
    if 'Ligaphase' in t: return 'ligue'
    if re.search(r'KO Playoff|1/8 Finale|1/4 Finale|1/2 Finale|^Finale$', t): return 'finale'
    if re.search(r'Quali|Qualifikation|Entscheidung', t): return 'qualif'
    return None

# L'en-tete de competition n'est pas toujours nu : « Champions League Saison
# 2025 / 2026 » pour la premiere, « Europa League » pour la deuxieme. On teste
# donc la Conference AVANT l'Europa, faute de quoi « Europa Conference League »
# tomberait dans la seconde.
def competition(t):
    if re.search(r'Conference League', t): return 2
    if re.search(r'^Champions League', t):  return 0
    if re.search(r'^Europa League', t):     return 1
    return None
TOURS_KO = ['1/8 Finale', '1/4 Finale', '1/2 Finale', 'Finale']
KOBON = [1.5, 1.0, 0.5]

def lire_matchs(chemin):
    soup = BeautifulSoup(open(chemin, encoding='utf-8', errors='replace').read(), 'html.parser')
    tab = max(soup.select('table'), key=lambda t: len(t.select('tr')))
    pts = defaultdict(lambda: defaultdict(float))     # pays -> phase -> points de match
    ligueC1 = defaultdict(set)                        # pays -> clubs en phase de ligue de C1
    atteint = defaultdict(lambda: defaultdict(set))   # (pays, tour KO) -> clubs, par competition
    k, ph, tour, n = None, None, None, 0
    for tr in tab.select('tr'):
        cells = [txt(c) for c in tr.select('td, th')]
        if len(cells) == 1:
            t = cells[0]
            kk = competition(t)
            if kk is not None: k = kk; continue
            p = phase(t)
            if p: ph, tour = p, t
            continue
        if len(cells) < 8 or ph is None or cells[0] in ('Team',) or not re.match(r'^[A-Z]{3}$', cells[1] or ''): continue
        a, pa, b, pb = cells[0], cells[1], cells[2], cells[3]
        try: ba, bb = int(cells[5]), int(cells[7])
        except ValueError: continue
        n += 1
        v, nul = (1.0, 0.5) if ph == 'qualif' else (2.0, 1.0)
        for club, pays, mien, sien in ((a, pa, ba, bb), (b, pb, bb, ba)):
            pts[pays][ph] += v if mien > sien else (nul if mien == sien else 0.0)
            if ph == 'ligue' and k == 0: ligueC1[pays].add(club)
            if tour in TOURS_KO: atteint[(pays, tour)][k].add(club)
    return pts, ligueC1, atteint, n

def main():
    nations = lire_nations(os.path.join(DOSSIER, 'AV Pkt je Nat.html'))
    pts, ligueC1, atteint, nMatchs = lire_matchs(os.path.join(DOSSIER, 'AV Spiele.html'))
    print(f'{len(nations)} associations · {nMatchs} matchs lus')

    ENTREE = 6.0 if ANNEE >= 2024 else 4.0     # bonus de participation a la phase de ligue de C1
    out, ecarts = {}, []
    for c, n in nations.items():
        eng = n['eng']
        if not eng: continue
        bonusTot = sum(x['bonus'] for x in n['clubs'])
        bEntree  = ENTREE * len(ligueC1.get(c, ()))
        # Bonus de tour : 1,5 / 1 / 0,5 par tour de phase finale atteint, selon la competition.
        bTour = sum(KOBON[k] * len(s) for t in TOURS_KO for k, s in atteint.get((c, t), {}).items())
        # Le reste est le bonus de classement de fin de phase de ligue : il tombe
        # a la fin de la ligue, il est donc compte avec elle.
        bClassement = bonusTot - bEntree - bTour
        serie = [bEntree, pts[c]['qualif'], pts[c]['ligue'] + bClassement, pts[c]['finale'] + bTour]
        coef = sum(serie) / eng
        out[c] = [round(v / eng, 4) for v in serie]
        if abs(coef - n['coef']) > 0.0015:
            ecarts.append((c, round(coef, 3), n['coef'], round(bClassement, 3)))

    print(f'\n{len(out)} associations decomposees')
    if ecarts:
        print(f'ECARTS sur {len(ecarts)} :')
        for e in ecarts[:12]: print('  ', e)
        sys.exit(1)
    print('CONTROLE OK : les quatre postes retrouvent le coefficient publie, partout.')
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'decomp-{ANNEE}.json')
    json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False)
    print('->', dest)

main()
