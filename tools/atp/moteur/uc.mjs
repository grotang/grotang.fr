/* United Cup : points par victoire en simple messieurs, selon le tour et le
 * classement de l'adversaire (barème de la page Wikipédia de l'édition). Le
 * classement n'est donné que pour le n° 1 de chaque équipe ; pour le n° 2, on
 * suppose la tranche 101–250 (signalé). */
const TR = [10, 20, 30, 50, 100, 250, Infinity];
const PTS = { G: [55, 45, 40, 35, 25, 20, 15], QF: [80, 65, 55, 40, 35, 25, 20], SF: [130, 105, 90, 60, 40, 35, 25], F: [180, 140, 120, 90, 60, 40, 35] };
/* Classement ATP de chaque joueur à la date du tournoi : l'infobox de son
   article Wikipédia (« currentsinglesranking ») dans la version du jour. */
export async function rangsA(noms, date) {
  const out = {};
  for (const n of noms) {
    const u = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvlimit=1&rvdir=older&rvprop=content&rvslots=main&rvstart=' + date + 'T00:00:00Z&titles=' + encodeURIComponent(n);
    const j = await (await fetch(u, { headers: { 'User-Agent': 'grotang.fr-robot/1.0 (https://grotang.fr/)' } })).json();
    const c = j.query.pages[0].revisions?.[0]?.slots?.main?.content || '';
    const m = /currentsinglesranking\s*=\s*No\.\s*(\d+)/i.exec(c); if (m) out[n] = +m[1];
    await new Promise(o => setTimeout(o, 200));
  }
  return out;
}
export function lireUnitedCup(t, rangsDate = {}) {
  const rang = {}, atp = new Set(), devines = new Set();
  const e = t.slice(t.indexOf('== Entries =='), t.indexOf('==Group stage=='));
  for (const ligne of e.split(/\n\|-\n/)) {
    const c = ligne.replace(/\{\{[^{}]*\}\}/g, m => m.replace(/\|\|/g, "|\u0000|")).split(/\|\|/).map(x => x.trim());
    const sn = c.map(x => /\{\{sortname\|([^|}]+)\|([^|}]+)/.exec(x)).map(m => m ? m[1] + ' ' + m[2] : null);
    if (c.length < 9) continue;
    const n1 = sn[2], r1 = +((/(\d+)\s*(?:\{\{sup\|PR[^}]*\}\})?\s*$/.exec(c[3]) || [])[1]), n2 = sn[6];
    if (n1) { atp.add(n1); if (r1) rang[n1] = r1; }
    if (n2) atp.add(n2);
  }
  const res = {};
  const re = /\{\{TennisMatch3\s*\|T1P1=\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*((?:\|[^|T}]*)*)\|T2P1=\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*((?:\|[^|}]*)*)\}\}/g;
  let m;
  while ((m = re.exec(t))) {
    const a = m[1].replace(/\s*\([^)]*\)$/, ''), b = m[3].replace(/\s*\([^)]*\)$/, '');
    if (!atp.has(a) || !atp.has(b)) continue;
    const sa = m[2].split('|').map(x => parseFloat(x)).filter(x => !isNaN(x)), sb = m[4].split('|').map(x => parseFloat(x)).filter(x => !isNaN(x));
    let wa = 0, wb = 0; for (let i = 0; i < Math.min(sa.length, sb.length); i++) { if (Math.floor(sa[i]) > Math.floor(sb[i])) wa++; else if (Math.floor(sb[i]) > Math.floor(sa[i])) wb++; }
    if (wa === wb) continue;
    const [g, p] = wa > wb ? [a, b] : [b, a];
    const pos = m.index, tour = pos > t.indexOf('=== Final ===') ? 'F' : pos > t.indexOf('=== Semifinals ===') ? 'SF' : pos > t.indexOf('=== Quarterfinals ===') ? 'QF' : 'G';
    const r = rang[p] || rangsDate[p] || (devines.add(p), 150);
    const k = TR.findIndex(x => r <= x); if (process.env.UCDBG) console.log(tour, g, 'bat', p, 'rang', r, '(entrées:', rang[p] ?? '-', ')', PTS[tour][k]);
    res[g] = Math.min(500, (res[g] || 0) + PTS[tour][k]);
  }
  return { points: res, devines: [...devines], atp: [...atp] };
}
