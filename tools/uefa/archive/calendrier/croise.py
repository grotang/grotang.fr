# Recoupe les matchs relevés sur Wikipédia (wiki-saisons.json) avec l'archive du site
# (matchs-saisons.json : compétition, tour, adversaire, score, domicile ; sans date).
import json, sys, re, unicodedata, difflib
from collections import defaultdict, Counter
W = json.load(open(sys.argv[1])); A = json.load(open(sys.argv[2]))
def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\b(fc|fk|sk|ac|as|sc|cf|afc|nk|hnk|ks|bk|if|kf|pfc|cd|sv|tsg|vfb|vfl|rsc|krc|kaa|ssc|ogc|club|de|calcio|1893|1907|1899)\b', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()
def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b: return 0
    if a in b or b in a: return .9
    return difflib.SequenceMatcher(None, a, b).ratio()
out = {}; bilan = {}
for y in sorted(W):
    a = A[y]; nJ = a['n']; noms = a['noms']
    def et(e):
        if e <= 3: return 'q%d' % e
        if e < 4 + nJ: return e - 4
        return 8 + (e - 4 - nJ)
    # archive vue du club qui reçoit
    pool = defaultdict(list)
    for nat, cl in a['c'].items():
        for club, L in cl.items():
            for e, k, o, gf, ga, dom in L:
                if dom: pool[(k, et(e), nat, noms[o][1], gf, ga)].append([club, noms[o][0], False])
    res = []; nok = nko = 0; manque = []
    for x in W[y]:
        if x['b'] is None: manque.append(('sans score', x['dom'], x['ext'], x['date'])); continue
        e = x['et']
        cands = []
        if e == 'g':
            keys = [(x['k'], j, x['pd'], x['pe'], *x['b']) for j in range(nJ)]
        else:
            keys = [(x['k'], 'q0' if e == 'qp' else e, x['pd'], x['pe'], *x['b'])]
        for kk in keys:
            for c in pool.get(kk, []):
                if not c[2]: cands.append((sim(x['dom'], c[0]) + sim(x['ext'], c[1]), kk, c))
        if not cands:   # même rencontre, score différent : on garde celui de Wikipédia (vérifié sur l'API UEFA)
            for kk in [(k[0], 'q0' if e == 'qp' else k[1], k[2], k[3]) for k in keys]:
                for kp, L in pool.items():
                    if kp[:4] == kk:
                        for c in L:
                            if not c[2] and sim(x['dom'], c[0]) + sim(x['ext'], c[1]) > 1.2:
                                cands.append((sim(x['dom'], c[0]) + sim(x['ext'], c[1]), kp, c))
            if cands: manque.append(('score différent', x['dom'], x['ext'], x['b'], max(cands, key=lambda t: t[0])[1][4:]))
        if not cands:   # finale sur terrain neutre (« domicile » arbitraire) ou compétition notée autrement dans l'archive
            alt = [(kk[0], kk[1], kk[3], kk[2], kk[5], kk[4]) for kk in keys if kk[1] == 12] + [(k2, *kk[1:]) for kk in keys for k2 in (0, 1, 2) if k2 != kk[0]]
            for kk in alt:
                for c in pool.get(kk, []):
                    if not c[2] and sim(x['dom'], c[1]) + sim(x['ext'], c[0]) + sim(x['dom'], c[0]) + sim(x['ext'], c[1]) > 1.2:
                        sw = kk[2] != x['pd']
                        cands.append((2, kk, [c[1], c[0], False] if sw else c, c))
            if cands:
                s, kk, cc, orig = cands[0]; orig[2] = True; nok += 1; manque.append(('recoupé autrement', x['dom'], x['ext'], kk))
                res.append([x['date'], x['heure'], x['k'], 'qp' if e == 'qp' else kk[1], cc[0], x['pd'], cc[1], x['pe'], x['b'][0], x['b'][1], x['dom'], x['ext']])
                continue
        if not cands:
            nko += 1; manque.append(('absent archive', x['k'], e, x['dom'], x['pd'], x['ext'], x['pe'], x['b'], x['date'])); continue
        s, kk, c = max(cands, key=lambda t: t[0])
        if s < .6: manque.append(('nom douteux', round(s, 2), x['dom'], c[0], x['ext'], c[1]))
        c[2] = True; nok += 1
        res.append([x['date'], x['heure'], x['k'], 'qp' if e == 'qp' else kk[1], c[0], x['pd'], c[1], x['pe'], x['b'][0], x['b'][1], x['dom'], x['ext']])
    reste = [(k, c) for k, L in pool.items() for c in L if not c[2]]
    bilan[y] = dict(ok=nok, ko=nko, reste_archive=len(reste))
    print(y, bilan[y]); [print('   ', m) for m in manque[:12]]; [print('    archive seule', r) for r in reste[:8]]
    out[y] = res
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False)
