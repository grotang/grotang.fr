/* Lecture des comptes des administrations publiques chez Eurostat.
 *
 * Une seule fonction, `construire(get)`, sans dépendance : elle reçoit de quoi
 * lire une requête de l'API Eurostat (`get(requête) → JSON`) et rend les
 * données de la page /economie/ avec la liste des contrôles passés.
 *
 * Elle ne sait pas d'où vient `get` : sur le runner GitHub c'est `fetch`, et la
 * toute première fois elle a tourné telle quelle dans un navigateur, faute
 * d'accès réseau ailleurs. Même code, mêmes contrôles, même sortie.
 *
 * Pourquoi Eurostat plutôt que l'Insee : ce sont les MÊMES comptes (l'Insee les
 * transmet, Eurostat les publie), mais Eurostat les sert par une API stable,
 * au million d'euros, avec les 80 postes de la nomenclature COFOG, les trois
 * sous-secteurs et les autres pays dans le même format. L'Insee ne les donne
 * qu'en fichiers à télécharger, au format qui change d'une campagne à l'autre.
 *
 * Champ : les administrations publiques au sens de la comptabilité nationale
 * (S13) = État et organismes centraux (S1311) + collectivités locales (S1313)
 * + administrations de sécurité sociale (S1314). Les montants de S13 sont
 * consolidés : un transfert de l'État vers une collectivité n'y compte qu'une
 * fois. Ceux des sous-secteurs ne le sont pas : leur somme dépasse S13. */

export const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/';
export const DEBUT = 1995;
export const SECTEURS = ['S13', 'S1311', 'S1313', 'S1314'];

/* Recettes et dépenses par nature (gov_10a_main). Les deux identités
   TR = Σ recettes et TE = Σ dépenses tiennent exactement chez Eurostat :
   elles sont contrôlées plus bas. */
export const REC = ['P11_P12_P131', 'D2REC', 'D39REC', 'D4REC', 'D5REC', 'D61REC', 'D7REC', 'D91REC', 'D92_D99REC'];
export const DEP = ['P2', 'D1PAY', 'D29PAY', 'D3PAY', 'D4PAY', 'D5PAY', 'D62_D632PAY', 'D7PAY', 'D8', 'D9PAY', 'OP5ANP'];
const NA_MAIN = ['TE', 'TR', 'B9', ...REC, 'D9REC', ...DEP, 'D41PAY', 'D11PAY', 'D12PAY', 'D62PAY', 'D632PAY', 'P51G', 'D76PAY', 'D73PAY', 'D73REC'];

/* Détail des impôts et cotisations (gov_10a_taxag), pour ouvrir les grandes
   masses de recettes : TVA, impôts sur le revenu (IR + CSG + CRDS : la CSG est
   un impôt sur le revenu en comptabilité nationale), impôt sur les sociétés…
   Champ S13_S212 (administrations + institutions européennes) : c'est celui
   qui recoupe l'agrégat S13 de gov_10a_main, parce que les droits de douane
   que la France perçoit pour l'Union y sont comptés (456,3 contre 456,1 Md€
   d'impôts sur la production en 2024 ; 453,7 sans l'UE). */
const SECT_TAX = 'S13_S212';
const NA_TAX = ['D2', 'D21', 'D211', 'D214A', 'D29', 'D29A', 'D29C', 'D5', 'D51A_C1', 'D51B_C2', 'D59', 'D91',
  'D61', 'D611', 'D612', 'D613', 'D613CE', 'D613CS', 'D613CN', 'D995'];

/* Comparaison européenne : les voisins de taille comparable et les deux agrégats. */
/* Dépenses par fonction ET par nature (gov_10a_exp), pour l'ensemble des
   administrations : ce que paie concrètement chaque sous-poste (salaires,
   achats, prestations, investissement…). Leur somme est exactement le total
   de la fonction : contrôlé plus bas. */
export const NATF_DEBUT = 2015;
export const NAT_F = ['D1', 'P2', 'D62', 'D632', 'D3', 'D7', 'D9', 'OP5ANP', 'D4', 'D29_D5_D8'];

export const UE_GEO = ['FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'EA20', 'EU27_2020'];

export async function construire(get) {
  const req = (ds, p) => ds + '?' + Object.entries(p)
    .flatMap(([k, v]) => [].concat(v).map(x => k + '=' + encodeURIComponent(x))).join('&');

  /* JSON-stat 2.0 : un tableau plat, indexé par le produit des dimensions. */
  function lit(d) {
    if (!d || d.error || !d.id) throw new Error('Eurostat : réponse inattendue ' + JSON.stringify(d && d.error || d).slice(0, 200));
    const ids = d.id, idx = ids.map(k => d.dimension[k].category.index), st = [];
    let s = 1; for (let i = ids.length - 1; i >= 0; i--) { st[i] = s; s *= d.size[i]; }
    const seul = ids.map((k, i) => Object.keys(idx[i]).length === 1 ? Object.keys(idx[i])[0] : null);
    return {
      maj: d.updated,
      cats: k => Object.keys(d.dimension[k].category.index),
      v(c) {
        let o = 0;
        for (let i = 0; i < ids.length; i++) {
          const p = idx[i][c[ids[i]] ?? seul[i]];
          if (p === undefined) return null;
          o += p * st[i];
        }
        const x = d.value[o];
        return x === undefined || x === null ? null : x;
      },
    };
  }
  const charge = async (ds, p) => lit(await get(req(ds, p)));

  const [M, X, T, G, P, D, U, H, XN] = await Promise.all([
    charge('gov_10a_main', { geo: 'FR', unit: 'MIO_EUR', sector: SECTEURS, na_item: NA_MAIN, sinceTimePeriod: DEBUT }),
    charge('gov_10a_exp', { geo: 'FR', unit: 'MIO_EUR', sector: SECTEURS, na_item: 'TE', sinceTimePeriod: DEBUT }),
    charge('gov_10a_taxag', { geo: 'FR', unit: 'MIO_EUR', sector: SECT_TAX, na_item: NA_TAX, sinceTimePeriod: DEBUT }),
    charge('nama_10_gdp', { geo: 'FR', unit: 'CP_MEUR', na_item: 'B1GQ', sinceTimePeriod: DEBUT }),
    charge('nama_10_pe', { geo: 'FR', unit: 'THS_PER', na_item: 'POP_NC', sinceTimePeriod: DEBUT }),
    charge('gov_10dd_edpt1', { geo: 'FR', unit: 'MIO_EUR', sector: 'S13', na_item: 'GD', sinceTimePeriod: DEBUT }),
    charge('gov_10a_exp', { geo: UE_GEO, unit: 'PC_GDP', sector: 'S13', na_item: 'TE', sinceTimePeriod: 2015 }),
    charge('gov_10a_main', { geo: UE_GEO, unit: 'PC_GDP', sector: 'S13', na_item: ['TE', 'TR', 'B9'], sinceTimePeriod: DEBUT }),
    charge('gov_10a_exp', { geo: 'FR', unit: 'MIO_EUR', sector: 'S13', na_item: NAT_F, sinceTimePeriod: DEBUT }),
  ]);

  /* Deux « dernières années ».
     `der` : celle des grands agrégats (recettes, dépenses par nature, solde),
     publiés en avril et révisés en octobre.
     `derF` : celle de la ventilation par fonction (COFOG), qui arrive environ
     un an plus tard (février de l'année n+2). Tant qu'elle manque, la page
     montre l'année `der` par nature, et l'année `derF` par fonction. */
  const anM = M.cats('time').map(Number), anX = X.cats('time').map(Number);
  const der = Math.max(...anM.filter(y => M.v({ sector: 'S13', na_item: 'TE', time: String(y) }) !== null
    && M.v({ sector: 'S13', na_item: 'TR', time: String(y) }) !== null));
  const derF = Math.max(...anX.filter(y => y <= der && X.v({ sector: 'S13', cofog99: 'TOTAL', time: String(y) }) !== null));
  /* `derT` : celle du détail des impôts, publié avec le même retard que la COFOG. */
  const derT = Math.max(...T.cats('time').map(Number).filter(y => y <= der && T.v({ na_item: 'D2', time: String(y) }) !== null));
  const an = []; for (let y = DEBUT; y <= der; y++) an.push(y);
  const ent = x => x === null ? null : Math.round(x);
  const serie = (S, c) => an.map(y => ent(S.v({ ...c, time: String(y) })));

  const agg = {};
  for (const s of SECTEURS) { agg[s] = {}; for (const n of NA_MAIN) { const z = serie(M, { sector: s, na_item: n }); if (z.some(v => v !== null)) agg[s][n] = z; } }

  const codes = X.cats('cofog99');
  const cofog = {};
  for (const s of SECTEURS) { cofog[s] = {}; for (const c of codes) { const z = serie(X, { sector: s, cofog99: c }); if (z.some(v => v !== null)) cofog[s][c] = z; } }
  /* natf[code][nature] : séries de l'ensemble des administrations ; les natures
     toujours nulles pour un poste ne sont pas écrites. */
  /* Dix ans suffisent pour expliquer ce que recouvre chaque poste : on ne garde
     que 2015 → dernière année (le fichier reste léger, la page aussi). */
  const natf = { debut: NATF_DEBUT, c: {} };
  const anN = an.filter(y => y >= NATF_DEBUT);
  for (const c of codes) { const o = {}; for (const n of NAT_F) { const z = anN.map(y => ent(XN.v({ cofog99: c, na_item: n, time: String(y) }))); if (z.some(v => v)) o[n] = z; } if (Object.keys(o).length) natf.c[c] = o; }

  const imp = {};
  for (const n of NA_TAX) { const z = serie(T, { na_item: n }); if (z.some(v => v !== null)) imp[n] = z; }

  const pib = serie(G, {}), pop = serie(P, {}), dette = serie(D, {});

  /* Europe : dernière année où TOUS les pays retenus ont publié leur COFOG. */
  const anU = U.cats('time').map(Number).sort((a, b) => b - a)
    .find(y => UE_GEO.every(g => U.v({ geo: g, cofog99: 'TOTAL', time: String(y) }) !== null));
  const ue = { an: anU, geo: UE_GEO, cofog: {} };
  for (const g of UE_GEO) { ue.cofog[g] = {}; for (const c of U.cats('cofog99')) { const v = U.v({ geo: g, cofog99: c, time: String(anU) }); if (v !== null) ue.cofog[g][c] = v; } }
  const anH = H.cats('time').map(Number).filter(y => y >= DEBUT && y <= der);
  const hist = { an: anH, TE: {}, TR: {}, B9: {} };
  for (const k of ['TE', 'TR', 'B9']) for (const g of UE_GEO) hist[k][g] = anH.map(y => H.v({ geo: g, na_item: k, time: String(y) }));

  /* ---------- contrôles ----------
     Une page fausse est pire qu'une page en retard : un seul contrôle en échec
     et rien n'est écrit. Tolérances : l'arrondi au million, rien de plus. */
  const ctrl = [];
  const ok = (cond, msg) => ctrl.push({ ok: !!cond, msg });
  const brut = (S, c, y) => S.v({ ...c, time: String(y) }) ?? 0;
  const iDer = an.length - 1;
  for (const y of an) for (const s of SECTEURS) {
    const te = brut(M, { sector: s, na_item: 'TE' }, y), tr = brut(M, { sector: s, na_item: 'TR' }, y);
    if (!te || !tr) { if (s === 'S13') ok(false, `${y} : total des dépenses ou des recettes absent`); continue; }
    const sR = REC.reduce((a, n) => a + brut(M, { sector: s, na_item: n }, y), 0);
    const sE = DEP.reduce((a, n) => a + brut(M, { sector: s, na_item: n }, y), 0);
    const b9 = brut(M, { sector: s, na_item: 'B9' }, y);
    if (Math.abs(sR - tr) > 2) ok(false, `${y} ${s} : recettes ${tr} ≠ somme des composantes ${sR.toFixed(1)}`);
    if (Math.abs(sE - te) > 2) ok(false, `${y} ${s} : dépenses ${te} ≠ somme des natures ${sE.toFixed(1)}`);
    if (Math.abs(tr - te - b9) > 2) ok(false, `${y} ${s} : solde ${b9} ≠ recettes − dépenses ${(tr - te).toFixed(1)}`);
  }
  ok(true, `${an.length} années × ${SECTEURS.length} secteurs : recettes = Σ composantes, dépenses = Σ natures, solde = recettes − dépenses`);

  /* COFOG, à l'année `derF`.
     Le total par fonction peut s'écarter un peu du total des dépenses : Eurostat
     ne republie pas le tableau COFOG à chaque révision des agrégats. Constaté le
     25/10/2026 sur 2024 : 1 671,8 contre 1 672,7 Md€ (−0,05 %), et jusqu'à
     0,2 % par sous-secteur. Au-delà de 0,5 %, ce n'est plus un décalage de
     millésime : on s'arrête. À l'intérieur du tableau COFOG, en revanche, les
     sommes doivent tomber juste (arrondi au million). */
  for (const s of SECTEURS) {
    const tot = brut(X, { sector: s, cofog99: 'TOTAL' }, derF), te = brut(M, { sector: s, na_item: 'TE' }, derF);
    ok(Math.abs(tot - te) <= te * 0.005, `${derF} ${s} : total par fonction ${tot} ≈ dépenses ${te} (écart ${((tot / te - 1) * 100).toFixed(2)} %)`);
    const n1 = codes.filter(c => /^GF\d\d$/.test(c));
    const s1 = n1.reduce((a, c) => a + brut(X, { sector: s, cofog99: c }, derF), 0);
    ok(Math.abs(s1 - tot) <= 10, `${derF} ${s} : Σ 10 fonctions ${s1.toFixed(0)} = total ${tot}`);
    for (const c of n1) {
      const v = brut(X, { sector: s, cofog99: c }, derF);
      const s2 = codes.filter(k => k.length === 6 && k.startsWith(c)).reduce((a, k) => a + brut(X, { sector: s, cofog99: k }, derF), 0);
      if (Math.abs(s2 - v) > 10) ok(false, `${derF} ${s} ${c} : Σ sous-fonctions ${s2.toFixed(0)} ≠ ${v}`);
    }
  }
  ok(true, `${derF} : chaque fonction = Σ de ses sous-fonctions, dans les 4 secteurs`);
  /* Chaque poste, chaque année : Σ des natures = total du poste. */
  let nKo = 0;
  for (const y of an.filter(y => y <= derF)) for (const c of codes) {
    const tot = brut(X, { sector: 'S13', cofog99: c }, y);
    const sn = NAT_F.reduce((a, n) => a + brut(XN, { cofog99: c, na_item: n }, y), 0);
    if (Math.abs(sn - tot) > Math.max(3, Math.abs(tot) * 0.002)) { nKo++; if (nKo <= 5) ok(false, `${y} ${c} : Σ natures ${sn.toFixed(0)} ≠ total ${tot}`); }
  }
  if (!nKo) ok(true, `1995 → ${derF} : chaque poste = Σ de ses natures (salaires, achats, prestations…), ${codes.length} postes`);
  /* Détail fiscal contre agrégat : deux présentations d'Eurostat, à moins de 1 %. */
  for (const [t, m] of [['D2', 'D2REC'], ['D5', 'D5REC'], ['D61', 'D61REC'], ['D91', 'D91REC']]) {
    const a = brut(T, { na_item: t }, derT), b = brut(M, { sector: 'S13', na_item: m }, derT);
    ok(Math.abs(a - b) <= b * 0.01, `${derT} : ${t} détail ${a} ≈ agrégat ${b} (${((a / b - 1) * 100).toFixed(2)} %)`);
  }
  /* PIB : celui de nama_10_gdp doit être celui qu'Eurostat a utilisé pour ses
     propres ratios (même millésime), à l'arrondi du dixième de point près. */
  const pcTE = brut(M, { sector: 'S13', na_item: 'TE' }, der) / pib[iDer] * 100;
  const pcH = hist.TE.FR[anH.indexOf(der)];
  ok(pcH !== null && pcH !== undefined && Math.abs(pcTE - pcH) <= 0.06, `${der} : dépenses ${pcTE.toFixed(2)} % du PIB recalculé = ${pcH} % publié`);
  ok(pib[iDer] && pop[iDer] && dette[iDer], `${der} : PIB, population et dette présents`);
  ok(anU && anU >= derF - 1, `comparaison européenne : ${anU}`);

  return {
    data: {
      source: { maj: M.maj, majCofog: X.maj, majImpots: T.maj },
      an, der, derF, derT, pib, pop, dette, agg, cofog, natf, imp, ue, hist,
    },
    ctrl,
  };
}
