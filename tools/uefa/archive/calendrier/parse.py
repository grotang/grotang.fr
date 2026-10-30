# Relevé des matchs des saisons closes sur Wikipédia (wikitexte brut) → date, heure, score.
import re, json, os, sys, datetime
from collections import defaultdict
ICI = os.path.dirname(os.path.abspath(__file__))
fn = lambda t: os.path.join(ICI, 'raw', re.sub(r'[^A-Za-z0-9]+', '_', t) + '.txt')
def lire(t, n=0):
    p = fn(t)
    if not os.path.exists(p): return None
    s = open(p, encoding='utf-8').read()
    m = re.match(r'#REDIRECT\s*\[\[([^\]|#]+)', s, re.I)
    if m and n < 3: return lire(m.group(1).strip(), n + 1)
    return None if s.startswith('__MISSING__') else s

def boites(s):
    """[(position, texte du modèle)] pour chaque Football box"""
    out = []
    for m in re.finditer(r'\{\{\s*(?:#invoke:\s*)?Football ?box(?:[ _]collapsible)?\s*(?:\|\s*main)?', s, re.I):
        i, prof = m.start(), 0
        j = i
        while j < len(s) - 1:
            if s[j:j+2] == '{{': prof += 1; j += 2; continue
            if s[j:j+2] == '}}':
                prof -= 1; j += 2
                if prof == 0: break
                continue
            j += 1
        out.append((i, s[i:j]))
    return out

def champs(b):
    """paramètres de premier niveau du modèle"""
    prof, lien, cur, parts = 0, 0, '', []
    i = 2
    while i < len(b) - 2:
        c2 = b[i:i+2]
        if c2 == '{{': prof += 1; cur += c2; i += 2; continue
        if c2 == '}}': prof -= 1; cur += c2; i += 2; continue
        if c2 == '[[': lien += 1; cur += c2; i += 2; continue
        if c2 == ']]': lien -= 1; cur += c2; i += 2; continue
        if b[i] == '|' and prof == 0 and lien == 0: parts.append(cur); cur = ''; i += 1; continue
        cur += b[i]; i += 1
    parts.append(cur)
    d = {}
    for p in parts[1:]:
        if '=' in p:
            k, v = p.split('=', 1); d[k.strip().lower()] = v.strip()
    return d

def equipe(v):
    pays = re.search(r'\{\{\s*(?:#invoke:\s*flag\s*\|\s*)?(?:fbaicon|fb|fbicon|flagicon)\s*\|\s*([A-Z]{3})', v)
    t = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', v, flags=re.S)
    t = re.sub(r'\{\{[^{}]*\}\}', '', t)
    t = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', t)
    t = re.sub(r"'''?|<[^>]+>", '', t).strip()
    p = pays.group(1) if pays else None
    return t, {'LAT': 'LVA', 'SLO': 'SVN'}.get(p, p)

def tour(titres, kind):
    h = ' / '.join(titres).lower()
    if kind == 'q':
        last = titres[-1].lower() if titres else ''
        for t in reversed([x.lower() for x in titres]):
            if 'preliminary' in t: return 'qp'
            if 'first qualifying' in t: return 'q0'
            if 'second qualifying' in t: return 'q1'
            if 'third qualifying' in t: return 'q2'
            if 'play-off round' in t or 'play-offs' in t or 'playoff' in t: return 'q3'
        return None
    if kind == 'ko':
        for t in reversed([x.lower() for x in titres]):
            if 'play-off' in t or 'playoff' in t: return 8
            if 'round of 16' in t: return 9
            if 'quarter' in t: return 10
            if 'semi' in t: return 11
            if t.strip() == 'final' or t.startswith('final'): return 12
        return None
    if kind == 'fin': return 12
    if kind == 'ligue':
        for t in reversed(titres):
            m = re.match(r'\s*matchday\s+(\d+)', t, re.I)
            if m: return int(m.group(1)) - 1
        return None
    return 'g'

def page(s, kind):
    heads = [(m.start(), len(m.group(1)), m.group(2).strip()) for m in re.finditer(r'^(={2,5})\s*(.*?)\s*\1\s*$', s, re.M)]
    out = []
    for pos, b in boites(s):
        pile = {}
        for hp, lv, txt in heads:
            if hp > pos: break
            pile[lv] = txt
            for l2 in list(pile):
                if l2 > lv: del pile[l2]
        titres = [pile[l] for l in sorted(pile)]
        d = champs(b)
        sd = re.search(r'Start date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})', d.get('date', ''))
        if not sd: continue
        date = f'{sd.group(1)}-{int(sd.group(2)):02d}-{int(sd.group(3)):02d}'
        hm = re.search(r'(\d{1,2}):(\d{2})', d.get('time', ''))
        heure = f'{int(hm.group(1)):02d}:{hm.group(2)}' if hm else None
        n1, p1 = equipe(d.get('team1', '')); n2, p2 = equipe(d.get('team2', ''))
        sc = re.search(r'(\d+)\s*[–\-−‒—]\s*(\d+)', re.sub(r'\{\{[^{}]*\}\}', '', d.get('score', '')))
        et = tour(titres, kind)
        out.append({'date': date, 'heure': heure, 'dom': n1, 'pd': p1, 'ext': n2, 'pe': p2,
                    'b': [int(sc.group(1)), int(sc.group(2))] if sc else None, 'et': et, 'titres': titres[-2:]})
    return out

COMPS = lambda y: ['Champions League', 'Europa League', 'Europa Conference League' if y < 2024 else 'Conference League']
res = {}
for y in range(2021, 2026):
    L = f'{y}–{(y + 1) % 100:02d}'
    tous = []
    for k, c in enumerate(COMPS(y)):
        pages = [('q', f'{L} UEFA {c} qualifying phase and play-off round')]
        if 'Conference' in c:
            pages = [('q', f'{L} UEFA {c} qualifying (first and second round matches)'),
                     ('q', f'{L} UEFA {c} qualifying (third and play-off round matches)')]
        for kind, t in pages + [
                        ('g' if y < 2024 else 'ligue', f'{L} UEFA {c} ' + ('group stage' if y < 2024 else 'league phase')),
                        ('ko', f'{L} UEFA {c} knockout phase'), ('fin', f'{y + 1} UEFA {c} final')]:
            s = lire(t)
            if s is None: print('  ABSENTE', t); continue
            P = page(s, kind)
            for x in P: x['k'] = k; x['kind'] = kind
            sans = sum(1 for x in P if x['et'] is None)
            print(f'{L} C{[1,3,4][k]} {kind:5} : {len(P):3} boîtes, {sum(1 for x in P if x["b"]):3} scores, {sans} sans tour')
            tous += P
    res[str(y)] = tous
json.dump(res, open(os.path.join(ICI, 'wiki-saisons.json'), 'w', encoding='utf-8'), ensure_ascii=False)
