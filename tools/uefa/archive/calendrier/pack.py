# Met les matchs recoupés (croise.json) dans la forme qu'attendent les blocs 1 et 2 de la page,
# saison close par saison close : calendrier (CAL, KO, QUAL), affiches françaises (AFF),
# semaine européenne (SEM) et diviseurs (clubs engagés, vnd-saisons.json).
import json, sys
from collections import defaultdict, Counter
C = json.load(open(sys.argv[1])); V = json.load(open(sys.argv[2]))
MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
def lib(ds):
    """« 8–10 sept. » : étendue des vrais soirs du tour (un match déplacé n'étire pas le tour)"""
    L = soirs(ds)
    a, b = L[0], L[-1]; ma, mb = int(a[5:7]) - 1, int(b[5:7]) - 1; da, db = int(a[8:]), int(b[8:])
    if a == b: return a, f'{da} {MN[ma]}'
    if ma == mb: return a, f'{da}–{db} {MN[mb]}'
    return a, f'{da} {MN[ma]}–{db} {MN[mb]}'
def soirs(ds):
    """les soirs qui portent le tour : au moins 30 % du soir le plus chargé (et deux matchs)"""
    n = Counter(ds); s = max(2, .3 * max(n.values()))
    return sorted(d for d in n if n[d] >= s) or sorted(n)
def premier(ds): return soirs(ds)[0]
KOL = {8: 'PO', 9: '8es', 10: '1/4', 11: '1/2', 12: 'F'}
out = {}
for y, M in sorted(C.items()):
    P = {'CAL': {}, 'KO': {}, 'QUAL': {}, 'AFF': {}, 'SEM': [], 'div': {}, 'grp': int(y) < 2024}
    # manches : dans chaque confrontation (tour, paire de clubs), l'aller est le premier match joué
    legs = {}
    tie = defaultdict(list)
    for i, m in enumerate(M):
        d, h, k, e, nd, cd, ne, ce, gd, ge = m[:10]
        if isinstance(e, str) or e >= 8: tie[(k, e, frozenset([nd + cd, ne + ce]))].append(i)
    for L in tie.values():
        L.sort(key=lambda i: M[i][0] + (M[i][1] or ''))
        for n, i in enumerate(L): legs[i] = min(n, 1)
    for k in (0, 1, 2):
        mk = [(i, m) for i, m in enumerate(M) if m[2] == k]
        js = sorted({m[3] for _, m in mk if isinstance(m[3], int) and m[3] < 8})
        P['CAL'][k] = [list(lib([m[0] for _, m in mk if m[3] == j])) for j in js]
        P['KO'][k] = []
        for e in sorted({m[3] for _, m in mk if isinstance(m[3], int) and m[3] >= 8}):
            A = [m[0] for i, m in mk if m[3] == e and legs[i] == 0]; R = [m[0] for i, m in mk if m[3] == e and legs[i] == 1]
            P['KO'][k].append([KOL[e], premier(A), premier(R) if R else None, e])
        P['QUAL'][k] = []
        for q, lab in enumerate(['Q1', 'Q2', 'Q3', 'Bar.']):
            A = [m[0] for i, m in mk if m[3] == f'q{q}' and legs[i] == 0]; R = [m[0] for i, m in mk if m[3] == f'q{q}' and legs[i] == 1]
            P['QUAL'][k].append([lab, premier(A), premier(R)] if A and R else None)
    for i, m in enumerate(M):
        d, h, k, e, nd, cd, ne, ce, gd, ge = m[:10]
        P['SEM'].append([d, h, k, e, nd, cd, ne, ce, gd, ge])
        if 'FRA' in (cd, ce) and e != 'qp':
            key = f'{k}:{e}' if isinstance(e, str) else f'{k}:{e}'
            P['AFF'].setdefault(key, []).append([legs[i] if isinstance(e, str) else d, h, nd, cd, ne, ce, gd, ge])
    P['SEM'].sort(key=lambda m: (m[0], m[1] or '', m[2]))
    for v in P['AFF'].values(): v.sort(key=lambda m: (str(m[0]), m[1] or ''))
    P['div'] = {c: len(L) for c, L in V[y].items()}
    out[y] = P
    print(y, {k: len(v) for k, v in P['CAL'].items()}, {k: [x[0] for x in v] for k, v in P['KO'].items()},
          {k: [x and x[0] for x in v] for k, v in P['QUAL'].items()}, len(P['SEM']), sorted(P['AFF']))
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, separators=(',', ':'))
