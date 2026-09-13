/* Lecture des pages de 5-jahres-wertung.de → bloc de données de la page UEFA.
 *
 * Ce module ne fait que transformer du HTML en objet. Il n'ouvre aucune connexion
 * et n'écrit aucun fichier : c'est ce qui permet de le faire tourner à l'identique
 * dans un navigateur (pour le mettre au point contre les pages réelles) et dans
 * Node sur un runner GitHub (pour la production).
 *
 * Aucune API DOM au-delà de querySelectorAll / textContent / getAttribute, pour
 * que le comportement soit le même sous DOMParser natif et sous linkedom.
 */

export const PAGES = {
  jw:    '5JW.php',        // classement 5 ans
  pkt:   'PktNat.php',     // détail club par club
  sptgQ: '5JWSptgQ.php',   // phase qualificative, tour par tour
  sptgG: '5JWSptgG.php',   // phase de ligue, journée par journée
};
export const BASE = 'https://www.5-jahres-wertung.de/APD/Online/';

/* ---------- petits utilitaires ---------- */

const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();

/* Le site écrit tantôt « 0.571 » tantôt « 0,000 » ; le point comme la virgule
   sont décimaux, il n'y a jamais de séparateur de milliers. */
export function num(s) {
  if (s == null) return null;
  const t = String(s).replace(/ /g, ' ').trim();
  if (t === '' || t === '-') return null;
  const v = parseFloat(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

const tablesOf = doc => [...doc.querySelectorAll('table')];
const rowsOf = tb => [...tb.querySelectorAll('tr')];
const cellsOf = tr => [...tr.querySelectorAll('td, th')];
const textsOf = tr => cellsOf(tr).map(txt);
const span = c => parseInt(c.getAttribute('colspan') || '1', 10) || 1;

class SourceError extends Error {}
const fail = m => { throw new SourceError(m); };
/* Écarts tolérés : le site n'est pas toujours cohérent entre ses propres pages. */
export const warnings = [];
const warn = m => { warnings.push(m); };
export { SourceError };

/* ---------- 1 · classement 5 ans (5JW.php) ---------- */
/* Colonnes : 0-2 rangs, 3 code, 4 icône, 5 quota, 6 nom, 7-11 les cinq saisons,
   12 total, 13 points d'équipe, 14 retard, 15 clubs actifs, 16-18 actifs par
   compétition, 19-24 les trois listes d'accès (points puis rang, alternés). */
function parseRanking(doc) {
  const tb = tablesOf(doc).find(t => rowsOf(t).length > 50)
    || fail('5JW : tableau du classement introuvable');
  const out = [];
  for (const tr of rowsOf(tb)) {
    const c = textsOf(tr);
    if (c.length < 25 || !/^[A-Z]{3}$/.test(c[3])) continue;
    const y = c.slice(7, 12).map(num);
    if (y.some(v => v == null)) fail(`5JW : coefficients illisibles pour ${c[3]}`);
    out.push({
      r: num(c[0]), c: c[3], de: c[6], y,
      t: num(c[12]), tp: num(c[13]), g: num(c[14]),
      a: [num(c[16]), num(c[17]), num(c[18]), num(c[15])],   // le 4e est le nombre TOTAL d'engagés ; l'effectif encore en lice vient de PktNat
      p: [num(c[20]), num(c[19]), num(c[22]), num(c[21]), num(c[24]), num(c[23])],
    });
  }
  if (out.length !== 55) fail(`5JW : ${out.length} nations lues au lieu de 55`);
  return out;
}

/* ---------- 2 · légende des statuts (PktNat.php) ---------- */
/* La page publie elle-même la table qui dit que le statut 55 vaut « EL Gruppenphase
   aus CL Entsch. L. ». On la lit plutôt que de coder les tranches en dur : si le
   site change sa nomenclature, on s'en aperçoit au lieu de mal classer les clubs. */
export function parseStatusLegend(doc) {
  const tb = tablesOf(doc).find(t => txt(t).includes('Europa Conference League'))
    || fail('PktNat : légende des statuts introuvable');
  const map = new Map();
  const cells = rowsOf(tb).flatMap(textsOf);
  for (let i = 0; i < cells.length - 1; i++) {
    const m = /^Status (\d+)$/.exec(cells[i]);
    if (!m) continue;
    const label = cells[i + 1];
    const k = /^ECL\b/.test(label) ? 2 : /^EL\b/.test(label) ? 1 : /^CL\b/.test(label) ? 0
      : /ausgeschieden|ausgeschlossen/.test(label) ? -1 : null;
    if (k != null) map.set(+m[1], k);
  }
  if (map.size < 30) fail(`PktNat : légende des statuts trop courte (${map.size} entrées)`);
  for (const s of [19, 39, 55, 89, 98]) if (!map.has(s)) fail(`PktNat : statut ${s} absent de la légende`);
  return map;
}

/* Compétition d'un club : celle où il joue MAINTENANT. Un club reversé garde son
   statut de départ dans SB — c'est le cas Lyon, entré en C1, reversé en C3. Une
   fois éliminé (98/99) c'est le statut de départ qui redevient la bonne réponse. */
const bandOf = (legend, sa, sb) => {
  const a = legend.get(sa);
  if (a != null && a >= 0) return a;
  const b = legend.get(sb);
  if (b != null && b >= 0) return b;
  return null;
};

/* ---------- 3 · détail club par club (PktNat.php) ---------- */
/* Un bloc par nation : une ligne titre « 5) Frankreich 7 von 7 Teams aktiv… »,
   l'en-tête, les clubs, puis une ligne « Summe » qui donne bonus, points d'équipe
   et coefficient de saison — trois valeurs qu'on recoupera avec le classement. */
function parseClubs(doc, legend) {
  const tb = tablesOf(doc).find(t => rowsOf(t).length > 300)
    || fail('PktNat : tableau des clubs introuvable');
  const blocks = [];
  let cur = null;
  for (const tr of rowsOf(tb)) {
    const c = textsOf(tr);
    const head = c.length === 1 && /^(\d+)\)\s+(.+?)\s+(\d+)\s+von\s+(\d+)\s+Teams aktiv/.exec(c[0]);
    if (head) { cur = { rank: +head[1], de: head[2], active: +head[3], total: +head[4], teams: [] }; blocks.push(cur); continue; }
    if (!cur) continue;
    if (c.length === 12 && c[0] !== 'Mannschaft') {
      const [name, sa, sb, sq, uq, nq, sh, uh, nh, bonus, pkt, npkt] = c;
      cur.teams.push({
        name, sa: num(sa), sb: num(sb), k: bandOf(legend, num(sa), num(sb)),
        qW: num(sq), qD: num(uq), qL: num(nq), mW: num(sh), mD: num(uh), mL: num(nh),
        bonus: num(bonus), points: num(pkt), nationPoints: num(npkt),
      });
    } else if (c.length === 10 && /^Summe/.test(c[0])) {
      const v = c.slice(1).map(num);
      cur.sum = { qW: v[0], qD: v[1], qL: v[2], mW: v[3], mD: v[4], mL: v[5], bonus: v[6], points: v[7], nationPoints: v[8] };
    }
  }
  if (blocks.length !== 55) fail(`PktNat : ${blocks.length} blocs nation au lieu de 55`);
  for (const b of blocks) if (!b.sum) fail(`PktNat : ligne « Summe » manquante pour ${b.de}`);
  return blocks;
}

/* ---------- 4 · séries par étape (5JWSptg*.php) ---------- */
/* Onze colonnes fixes, puis huit blocs de sept cellules
   [T-Pkt, N-Pkt, Ges, Dif, TP, Rang, séparateur]. On garde Ges (total 5 ans à
   cette étape), N-Pkt (ce que l'étape a rapporté) et Rang, dans cet ordre —
   c'est exactement ce que la page attend. */
function parseSteps(doc, what) {
  const tb = tablesOf(doc).find(t => rowsOf(t).length > 50) || fail(`${what} : tableau introuvable`);
  const rows = rowsOf(tb);
  const header = cellsOf(rows[0]);
  const firstBlock = header.findIndex(c => span(c) >= 6);
  if (firstBlock < 0) fail(`${what} : blocs par étape introuvables dans l'en-tête`);
  const pre = header.slice(0, firstBlock).reduce((a, c) => a + span(c), 0);
  const step = span(header[firstBlock]);
  const nBlocks = header.filter(c => span(c) >= 6).length;
  if (nBlocks !== 8) fail(`${what} : ${nBlocks} étapes au lieu de 8`);

  const out = {};
  for (const tr of rows) {
    const c = textsOf(tr);
    if (c.length < pre + step * 8 || !/^[A-Z]{3}$/.test(c[4])) continue;
    out[c[4]] = Array.from({ length: 8 }, (_, b) => {
      const g = c.slice(pre + b * step, pre + (b + 1) * step);
      return [num(g[2]), num(g[1]) ?? 0, num(g[5])];
    });
  }
  const n = Object.keys(out).length;
  if (n !== 55) fail(`${what} : ${n} nations lues au lieu de 55`);
  return out;
}

/* ---------- 5 · métadonnées ---------- */
function parseMeta(pktDoc, jwDoc) {
  const pkt = txt(pktDoc.body || pktDoc), jw = txt(jwDoc.body || jwDoc);
  const season = (/Saison\s+(\d{4}\/\d{4})/.exec(pkt) || [])[1]
    || (/Saison\s+(\d{4}\/\d{4})/.exec(jw) || [])[1]
    || fail('Saison introuvable dans les sources');
  const stand = (/Stand\s*:?\s*(\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2})/.exec(pkt) || [])[1]
    || fail('Date de mise à jour de la source introuvable');
  const y0 = +season.slice(0, 4);
  return {
    season,
    lastUpdated: stand.replace(/\s*-\s*/, ' - '),
    /* Les deux ci-dessous sont écrits en toutes lettres dans le bandeau de 5JW ;
       on les lit plutôt que de les recalculer, pour suivre la source si elle
       change de règle. */
    nextMatchday: (/N(?:ä|ae)chster Spieltag\s*:?\s*(\d{2}\/\d{2}\/\d{4})/.exec(jw) || [])[1] || null,
    allocationSeason: (/Europapokal-Pl(?:ä|ae)tze der Saison\s+(\d{4}\/\d{4})/.exec(jw) || [])[1]
      || `${y0 + 2}/${y0 + 3}`,
  };
}

/* ---------- assemblage ---------- */

/** @param {(html:string)=>Document} parse  @param {{jw,pkt,sptgQ,sptgG}} html */
export function extract(parse, html, { names = {}, clubAliases = {}, topN = 8 } = {}) {
  const jw = parse(html.jw), pkt = parse(html.pkt);
  const legend = parseStatusLegend(pkt);
  const ranking = parseRanking(jw);
  const blocks = parseClubs(pkt, legend);
  const q = parseSteps(parse(html.sptgQ), 'SptgQ');
  const m = parseSteps(parse(html.sptgG), 'SptgG');
  const meta = parseMeta(pkt, jw);

  /* Les deux tableaux se recoupent par le nom allemand de la nation, présent des
     deux côtés — pas par la position dans la page : PktNat ordonne ses blocs
     autrement que le classement 5 ans, et s'y fier appariait le Portugal avec
     les chiffres d'une autre nation. On exige ensuite que points d'équipe et
     coefficient de saison coïncident : deux lectures indépendantes qui doivent
     tomber d'accord, sinon on s'arrête. */
  const byName = new Map(blocks.map(b => [b.de, b]));
  if (byName.size !== blocks.length) fail('PktNat : noms de nation en double');
  const nations = ranking.map(n => {
    const b = byName.get(n.de) || fail(`Aucun bloc club pour ${n.de} (${n.c})`);
    const near = (a, x) => Math.abs((a ?? 0) - (x ?? 0)) < 5e-3;
    if (!near(b.sum.points, n.tp)) fail(`${n.c} : points d'équipe divergents (${b.sum.points} vs ${n.tp})`);
    if (!near(b.sum.nationPoints, n.y[4])) fail(`${n.c} : coefficient de saison divergent (${b.sum.nationPoints} vs ${n.y[4]})`);

    const k = [0, 0, 0];
    for (const t of b.teams) if (t.k != null) k[t.k] += t.points || 0;
    /* Clubs encore en lice : c'est PktNat qui le dit (« 4 von 5 Teams aktiv »).
       La colonne GT du classement compte les engagés du départ, éliminés compris. */
    return { r: n.r, c: n.c, n: names[n.c] || n.de, t: n.t, y: n.y, tp: n.tp,
             a: [n.a[0], n.a[1], n.a[2], b.active], g: n.g, p: n.p, k: k.map(v => +v.toFixed(3)), b: b.sum.bonus,
             _block: b };
  });

  /* Contrôles d'ensemble : la somme des cinq colonnes doit faire le total, et le
     coefficient de saison doit valoir les points d'équipe divisés par le nombre
     de clubs engagés. Le diviseur se déduit du rapport — jamais d'un comptage de
     clubs, qui se trompe dès qu'une nation a des équipes déjà éliminées. */
  for (const n of nations) {
    const sum = +n.y.reduce((a, v) => a + v, 0).toFixed(3);
    if (Math.abs(sum - n.t) > 6e-3) fail(`${n.c} : total 5 ans ${n.t} ≠ somme des saisons ${sum}`);
    if (n.y[4] > 0) {
      const div = Math.round(n.tp / n.y[4]);
      if (div < 1 || Math.abs(n.tp / div - n.y[4]) > 5e-3) fail(`${n.c} : diviseur incohérent (${n.tp}/${n.y[4]})`);
      n.divisor = div;
    }
    const ksum = +n.k.reduce((a, v) => a + v, 0).toFixed(3);
    if (Math.abs(ksum - n.tp) > 6e-3) fail(`${n.c} : points par compétition ${ksum} ≠ points d'équipe ${n.tp}`);

    /* Le barème lui-même, vérifié ligne à ligne : une victoire de qualification
       vaut 1, un nul 0,5 ; en phase principale 2 et 1 ; le reste est du bonus.
       Si l'UEFA ou la source change de barème, on l'apprend ici et on ne publie
       pas — plutôt qu'en découvrant des chiffres faux sur la page. */
    for (const t of n._block.teams) {
      const calc = (t.qW || 0) + 0.5 * (t.qD || 0) + 2 * (t.mW || 0) + (t.mD || 0) + (t.bonus || 0);
      if (Math.abs(calc - (t.points || 0)) > 5e-3)
        fail(`${n.c} / ${t.name} : barème incohérent (calculé ${calc}, publié ${t.points})`);
    }
    if (n.b % 6 !== 0) warn(`${n.c} : bonus d'entrée ${n.b} n'est pas un multiple de 6`);
  }

  for (const n of nations) {
    if (!q[n.c] || !m[n.c]) fail(`${n.c} : série par étape absente`);
  }

  const top = nations.slice(0, topN).map(n => n.c);
  const clean = s => clubAliases[s] || s;
  const clubs = nations.filter(n => top.includes(n.c)).flatMap(n =>
    n._block.teams.map(t => ({ n: clean(t.name), cc: n.c, k: t.k, p: t.points })));

  const frBlock = (nations.find(n => n.c === 'FRA') || fail('France absente')) ._block;
  const fra = {
    teams: frBlock.teams.map(t => ({
      name: clean(t.name), k: t.k, qW: t.qW, qD: t.qD, qL: t.qL,
      mW: t.mW, mD: t.mD, mL: t.mL, bonus: t.bonus, points: t.points, nationPoints: t.nationPoints,
    })),
    totals: frBlock.sum,
  };

  const series = {};
  for (const n of nations) series[n.c] = { q: q[n.c], m: m[n.c] };

  for (const n of nations) delete n._block;
  return { meta, nations, series, clubs, fra };
}
