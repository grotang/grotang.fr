# -*- coding: utf-8 -*-
"""Extrait, des pages Wikipedia des qualifications, une ligne par club et par tour.

    python3 tools/uefa/parse-wiki.py <dossier des .html>

Pourquoi ce fichier existe
--------------------------
La source du site publie l'effectif engage et l'effectif encore en lice, jamais
la date de sortie de chaque club. La courbe de survie (bloc 7b) ne pouvait donc
pas montrer les marches tour par tour. Les tableaux de confrontations de
Wikipedia, eux, donnent exactement ca : deux equipes, leur pays par le drapeau,
et le vainqueur en gras.

Ce script ne va sur aucun reseau : il lit trois fichiers enregistres a la main
depuis le navigateur. Il ne recopie ni texte ni mise en forme — il releve des
faits sportifs (qui a joue, qui a gagne), qui n'appartiennent a personne.

Sortie : tools/uefa/wiki/qualifs-2026-27.json
"""
import copy, json, os, re, sys
from bs4 import BeautifulSoup

DOSSIER = sys.argv[1] if len(sys.argv) > 1 else '.'
SORTIE  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wiki', 'qualifs-2026-27.json')

COMPET = {'Champions': 0, 'Europa': 1, 'Conference': 2}
TOURS  = {'First qualifying round': 'Q1', 'Second qualifying round': 'Q2',
          'Third qualifying round': 'Q3', 'Play-off round': 'PO'}
ORDRE  = ['Q1', 'Q2', 'Q3', 'PO']

def equipe(cell):
    """(nom, pays, gagnant). Le gras marque le qualifie, le drapeau donne le pays.

    Le nom se lit sur la cellule PRIVEE de son drapeau, jamais sur le premier
    lien : dans la colonne « Team 2 » le drapeau precede le nom, et le premier
    lien est celui de la federation. Un parseur qui prenait ce lien rendait un
    nom vide et perdait la moitie des confrontations en silence."""
    img = cell.find('img', alt=True)
    pays = img['alt'].strip() if img else None
    c = copy.copy(cell)
    for f in c.select('span.flagicon, sup'): f.decompose()
    nom = re.sub(r'\s*\[[^\]]*\]\s*', ' ', c.get_text(' ', strip=True)).strip()
    return nom, pays, cell.find('strong') is not None

def lire(chemin, k):
    soup = BeautifulSoup(open(chemin, encoding='utf-8').read(), 'html.parser')
    lignes, tour = [], None
    for el in soup.find_all(['h2', 'h3', 'table']):
        if el.name in ('h2', 'h3'):
            t = el.get_text(' ', strip=True)
            if t in TOURS: tour = TOURS[t]
            continue
        if tour is None: continue
        entete = [c.get_text(' ', strip=True) for c in el.select('tr')[0].select('th,td')] if el.select('tr') else []
        if len(entete) < 3 or not entete[0].startswith('Team 1') or not entete[1].startswith('Agg'): continue
        voie = None
        for tr in el.select('tr')[1:]:
            cs = tr.select('td')
            # une ligne d'un seul bloc annonce la voie (Champions Path / League Path)
            if len(cs) == 1:
                t = cs[0].get_text(' ', strip=True)
                if 'Path' in t: voie = t
                continue
            if len(cs) < 3: continue
            bye = 'Bye' in cs[1].get_text(' ', strip=True)
            for c in (cs[0], cs[2]):
                nom, pays, gagne = equipe(c)
                # « N/A » en face d'un « Bye » : le club passe le tour sans jouer.
                # Il n'y a qu'un participant sur la ligne, et il est qualifie.
                if not nom or not pays or nom == 'N/A': continue
                lignes.append({'k': k, 'tour': tour, 'voie': voie, 'club': nom, 'pays': pays, 'gagne': gagne, 'bye': bye})
    return lignes

def main():
    tout = []
    for f in sorted(os.listdir(DOSSIER)):
        if not f.endswith('.html'): continue
        k = next((v for mot, v in COMPET.items() if mot in f), None)
        if k is None: print('ignore (competition inconnue) :', f); continue
        l = lire(os.path.join(DOSSIER, f), k)
        print(f'{f[:44]:44s} k={k}  {len(l)} participations')
        tout += l
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    json.dump(tout, open(SORTIE, 'w', encoding='utf-8'), ensure_ascii=False)
    print('->', SORTIE, len(tout), 'lignes')
    # controle immediat : chaque confrontation a un gagnant et un seul
    from collections import Counter
    c = Counter((x['k'], x['tour']) for x in tout)
    g = Counter((x['k'], x['tour']) for x in tout if x['gagne'])
    # Un tour est coherent si participants = 2 x qualifies - byes : un bye n'a
    # qu'un participant sur sa ligne, et ce participant est qualifie.
    b = Counter((x['k'], x['tour']) for x in tout if x.get('bye'))
    for cle in sorted(c):
        ok = c[cle] + b[cle] == 2 * g[cle]
        print(f'  k={cle[0]} {cle[1]} : {c[cle]:3d} participations, {g[cle]:3d} qualifies, {b[cle]} bye', 'OK' if ok else '<<< ECART')

main()
