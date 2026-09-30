# -*- coding: utf-8 -*-
"""Decomposition en quatre postes d'une saison archivee, pour les 55 associations.

    python3 tools/uefa/archive/lire-archive.py <dossier> <annee de depart> [prefixe]

    python3 .../lire-archive.py "GT for Claude" 2021 "2021 "
    python3 .../lire-archive.py "GT for Claude" 2025

<annee de depart> : 2025 = saison 2025/26.
[prefixe] : ce qui precede « AV Spiele.html » dans le nom du fichier enregistre.

Entrees : les deux pages d'archive de la source, enregistrees a la main depuis
le navigateur (repertoire prive, interdit aux robots — voir SOURCES.md) :
    « AV Pkt je Nat.html »  effectif, coefficient, et par club : bonus, total
    « AV Spiele.html »      tous les matchs de la saison, tour par tour

Sortie : decomp-<annee>.json, { code : [entree, qualifs, groupes, finale] },
en points de coefficient (deja divises par l'effectif engage).

Pourquoi les deux pages
-----------------------
« Pkt je Nat » donne un decoupage a trois : qualifications, Hauptrunde, bonus.
Le bloc 2b en veut quatre : il faut separer la phase de groupes de la phase
finale, et isoler le bonus d'entree du reste des bonus. Seule la liste des
matchs sait quel tour chaque club a joue.

Les deux baremes
----------------
Jusqu'a 2023/24 : phase de groupes, bonus d'entree de 4 points en C1, et aucun
bonus de classement — tout bonus qui n'est pas le bonus d'entree est un bonus
de tour, donc de la phase finale. Rien a deviner.
A partir de 2024/25 : phase de ligue, bonus d'entree de 6 points en C1, et un
bonus de classement de fin de phase de ligue qu'il faut separer des bonus de
tour. Les bonus de tour se deduisent des tours effectivement joues (1,5 en C1,
1 en C3, 0,5 en C4, a partir des huitiemes) ; le reste est le classement.

Controle : la somme des quatre postes doit retrouver, au millieme, le
coefficient de saison publie par la source, pour chaque association.
"""
import json, os, re, sys
from collections import defaultdict
from bs4 import BeautifulSoup

DOSSIER = sys.argv[1]
ANNEE   = int(sys.argv[2])
PREF    = sys.argv[3] if len(sys.argv) > 3 else ''

txt = lambda el: el.get_text(' ', strip=True).replace('\xa0', ' ').strip()
nb  = lambda s: float(str(s).replace(',', '.')) if re.match(r'^-?[\d.,]+$', str(s or '').strip()) else 0.0

# ---------- 1. effectifs, coefficients, bonus par club ----------
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
        nations[cur]['clubs'].append({'nom': cells[1], 'bonus': nb(cells[8]), 'at': nb(cells[11])})
    for c, n in nations.items():
        n['eng'] = int(max((x['at'] for x in n['clubs']), default=0))
    return nations

# ---------- 2. les matchs, tour par tour ----------
# Trois phases, et rien d'autre : ce que la source appelle Quali (y compris les
# « Entscheidungsspiele », c'est-a-dire les barrages d'acces, et la « Vorrunde »
# des petites nations), la phase de groupes ou de ligue, et tout ce qui suit a
# partir du KO Playoff.
def phase(t):
    if 'Ligaphase' in t or 'Gruppenphase' in t: return 'ligue'
    if re.search(r'KO Playoff|1/8 Finale|1/4 Finale|1/2 Finale|^Finale$', t): return 'finale'
    if re.search(r'Quali|Vorrunde|Entscheidung', t): return 'qualif'
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
    ligueC1 = defaultdict(set)                        # pays -> clubs en phase de groupes de C1
    atteint = defaultdict(lambda: defaultdict(set))   # (pays, tour KO) -> clubs, par competition
    k, ph, tour, n = None, None, None, 0
    inconnus, annules = [], []
    for tr in tab.select('tr'):
        cells = [txt(c) for c in tr.select('td, th')]
        if len(cells) == 1:
            t = cells[0]
            kk = competition(t)
            if kk is not None: k = kk; continue
            p = phase(t)
            if p: ph, tour = p, t
            elif t and 'Spiele der Saison' not in t: inconnus.append(t)
            continue
        if len(cells) < 8 or ph is None or cells[0] == 'Team': continue
        a, pa, b, pb = cells[0], cells[1], cells[2], cells[3]
        # Bye : la source inscrit l'adversaire « Freilos », pays « Leer ».
        if not (re.match(r'^[A-Z]{3}$', pa or '') and re.match(r'^[A-Z]{3}$', pb or '')): continue
        try: ba, bb = int(cells[5]), int(cells[7])
        except ValueError: continue
        # Rencontre jamais disputee : la source la laisse a 0:0 et l'annote
        # (Leipzig - Spartak, huitiemes de C3 2021/22, exclusion de la Russie).
        # Un forfait, lui, porte un score attribue (0:3) et compte normalement.
        if ba == 0 and bb == 0 and 'ausgeschlossen' in ' '.join(cells[12:]):
            annules.append((tour, a, b)); continue
        n += 1
        v, nul = (1.0, 0.5) if ph == 'qualif' else (2.0, 1.0)
        for club, pays, mien, sien in ((a, pa, ba, bb), (b, pb, bb, ba)):
            pts[pays][ph] += v if mien > sien else (nul if mien == sien else 0.0)
            if ph == 'ligue' and k == 0: ligueC1[pays].add(club)
            if tour in TOURS_KO: atteint[(pays, tour)][k].add(club)
    if inconnus: print('  en-tetes non classes :', inconnus)
    if annules:  print('  rencontres non disputees, ecartees :', annules)
    return pts, ligueC1, atteint, n

def main():
    nations = lire_nations(os.path.join(DOSSIER, PREF + 'AV Pkt je Nat.html'))
    pts, ligueC1, atteint, nMatchs = lire_matchs(os.path.join(DOSSIER, PREF + 'AV Spiele.html'))
    NOUVEAU = ANNEE >= 2024                    # phase de ligue et bonus de classement
    ENTREE  = 6.0 if NOUVEAU else 4.0          # bonus de participation en C1
    print(f'{ANNEE}/{str(ANNEE + 1)[2:]} : {len(nations)} associations, {nMatchs} matchs, '
          f'format {"ligue" if NOUVEAU else "groupes"}')

    out, ecarts = {}, []
    for c, n in nations.items():
        eng = n['eng']
        if not eng: continue
        bonusTot = sum(x['bonus'] for x in n['clubs'])
        bEntree  = ENTREE * len(ligueC1.get(c, ()))
        if NOUVEAU:
            bTour  = sum(KOBON[k] * len(s) for t in TOURS_KO for k, s in atteint.get((c, t), {}).items())
            bReste = bonusTot - bEntree - bTour        # bonus de classement : tombe avec la ligue
            serie  = [bEntree, pts[c]['qualif'], pts[c]['ligue'] + bReste, pts[c]['finale'] + bTour]
        else:
            serie  = [bEntree, pts[c]['qualif'], pts[c]['ligue'], pts[c]['finale'] + bonusTot - bEntree]
        coef = sum(serie) / eng
        out[c] = [round(v / eng, 4) for v in serie]
        if abs(coef - n['coef']) > 0.0015:
            ecarts.append((c, round(coef, 3), n['coef'], eng))

    if ecarts:
        print(f'  ECARTS sur {len(ecarts)} : {ecarts[:10]}')
        sys.exit(1)
    print(f'  CONTROLE OK : les quatre postes retrouvent le coefficient publie, {len(out)} associations')
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'decomp-{ANNEE}.json')
    json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False)
    print('  ->', dest)

main()
