/* PAGE CACHÉE : où finiront les clubs français en phase de ligue ?
 *   /football-clubs-francais-phase-de-ligue/ (registre : CACHEES.clubsFR)
 *
 * Hors menu, hors sitemap, noindex ; un seul lien y mène, dans le bloc 2 de la
 * page UEFA (décision de GT, 05/11/2026). Pourquoi si discret : le modèle est
 * « à la nation », pas « au club ». La force d'un club est celle de sa nation
 * (± son rang dans le contingent), et seul compte le V/N/D : perdre 9-1 ou 1-0,
 * c'est pareil pour lui. Ça donne une tendance, pas un pronostic à afficher.
 *
 * Les chiffres viennent de la projection du robot (projette.mjs → PRJ.clubsFR
 * dans page.html : 7 clubs × 36 rangs) ; le bilan et les points, du relevé de
 * la source (D.eff). La page est fabriquée à chaque build : elle suit la
 * projection sans rien faire tourner de plus. Après la dernière journée de la
 * phase de ligue (27/01/2027), elle montre le classement final et ne va pas
 * plus loin : rien sur la phase finale tant que le modèle n'est pas au club.
 */
import { nav, navCSS, FAVICON, FONTS, TOKENS, THEME_BOOT, THEME_JS, ANALYTICS } from '../chrome.mjs';
import { CACHEES, DOMAINE } from '../site.mjs';

const bloc = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b); return i < 0 || j < 0 ? null : src.slice(i + a.length, j); };
const NOM = { 'Paris Saint-Germain': 'Paris SG', 'RC Lens': 'Lens', 'Lille OSC': 'Lille', 'Olympique Lyonnais': 'Lyon', 'Stade Rennais': 'Rennes',
  'Olympique de Marseille': 'Marseille', 'AS Monaco': 'Monaco', 'Stade brestois': 'Brest', 'OGC Nice': 'Nice', 'RC Strasbourg': 'Strasbourg' };
const KN = ['Ligue des Champions', 'Ligue Europa', 'Ligue Conférence'], KV = ['--c1', '--c3', '--c4'], KS = ['C1', 'C3', 'C4'];
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pc = v => (v >= 0.995 ? '> 99' : v < 0.005 && v > 0 ? '< 1' : v === 0 ? '0' : Math.round(v * 100)) + ' %';
const virg = (v, d) => v.toFixed(d).replace('.', ',');

export function buildClubsFR(src) {
  const D = JSON.parse(bloc(src, '/*DATA_START*/', '/*DATA_END*/').replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
  const P = JSON.parse(bloc(src, '/*PRJ_START*/', '/*PRJ_END*/').replace(/^const PRJ\s*=\s*/, '').replace(/;\s*$/, ''));
  const eff = Object.fromEntries(((D.eff || {}).FRA || []).map(r => [r[0], r]));
  const somme = (a, i, j) => a.slice(i, j).reduce((x, y) => x + y, 0);
  const clubs = (P.clubsFR || []).map(c => ({ ...c, e: eff[c.n], t8: somme(c.p, 0, 8), ba: somme(c.p, 8, 24), el: somme(c.p, 24, 36) }));

  const carte = c => {
    const e = c.e || [], V = e[7] ?? 0, N = e[8] ?? 0, Dd = e[9] ?? 0, pts = 3 * V + N, mx = Math.max(...c.p), mode = c.p.indexOf(mx);
    const bande = c.p.map((v, i) => `<i style="--a:${(mx ? v / mx : 0).toFixed(3)}"${i === 7 || i === 23 ? ' class="cut"' : ''} title="${i + 1}${i ? 'e' : 'er'} : ${virg(v * 100, 1)} %"></i>`).join('');
    return `<div class="club"><div class="id"><b>${esc(NOM[c.n] || c.n)}</b><span>${V}V ${N}N ${Dd}D · <b>${pts} pt${pts > 1 ? 's' : ''}</b></span><span class="att">≈ ${virg(c.pts, 1)} pts attendus</span></div>
<div class="tri" aria-hidden="true"><div class="t8" style="flex:${c.t8.toFixed(5)}"></div><div class="ba" style="flex:${c.ba.toFixed(5)}"></div><div class="el" style="flex:${c.el.toFixed(5)}"></div></div>
<div class="trilab"><span class="t8"><b>${pc(c.t8)}</b> Top 8 · 8es directs</span><span><b>${pc(c.ba)}</b> barrages</span><span class="el"><b>${pc(c.el)}</b> éliminé</span></div>
<div class="bande" style="--k:var(${KV[c.k]})" role="img" aria-label="Probabilité de chaque rang final, du 1er au 36e">${bande}</div>
<div class="bandelab"><span>1er</span><span style="left:${(8 / 36 * 100).toFixed(2)}%">8e</span><span style="left:${(24 / 36 * 100).toFixed(2)}%">24e</span><span class="d">36e</span></div>
<div class="mode">Rang le plus probable : <b>${mode + 1}<sup>${mode ? 'e' : 'er'}</sup></b> (${virg(mx * 100, 1)} %)</div></div>`;
  };
  const sect = k => { const L = clubs.filter(c => c.k === k).sort((a, b) => b.pts - a.pts);
    return L.length ? `<section><h2><span class="kb" style="background:var(${KV[k]})">${KS[k]}</span>${KN[k]}</h2><div class="grille">${L.map(carte).join('')}</div></section>` : ''; };
  const corps = clubs.length ? [0, 1, 2].map(sect).join('')
    : '<section><p>Le calcul n\'est pas encore disponible : il arrive au prochain passage du robot.</p></section>';
  const u = CACHEES.clubsFR;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Où finiront les clubs français ? — grotang.fr</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${DOMAINE}${u}">
${FAVICON}
${FONTS}
${THEME_BOOT}
<style>${TOKENS}
${navCSS}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1100px;margin:0 auto;padding:24px clamp(14px,3vw,28px) 60px}
h1{font:700 clamp(26px,4vw,38px)/1.15 Newsreader,Georgia,serif;letter-spacing:-.01em;margin:6px 0 8px}
.lede{color:var(--ink-2);margin:0 0 6px;max-width:72ch}
.maj{font:12px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink-3);margin-bottom:22px}
section{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:clamp(14px,2.2vw,22px);margin-bottom:16px}
h2{font:600 20px Newsreader,Georgia,serif;margin:0 0 14px;display:flex;align-items:center;gap:10px}
.kb{font:700 11px Carlito,sans-serif;color:#fff;border-radius:999px;padding:2px 9px;letter-spacing:.04em}
:root[data-theme="dark"] .kb{color:#0B0F14}
.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.club{border:1px solid var(--rule-soft);border-radius:6px;padding:12px 14px;background:var(--surface-2)}
.id{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:10px}.id>b{font-size:17px}
.id span{font-size:13px;color:var(--ink-2)}.id .att{margin-left:auto;color:var(--ink-3);font-size:12px}
.tri{display:flex;height:12px;border-radius:3px;overflow:hidden;gap:2px}.tri .t8{background:var(--good)}.tri .ba{background:#8B95A3}.tri .el{background:var(--bad)}
.trilab{display:flex;justify-content:space-between;font-size:12px;color:var(--ink-2);margin:5px 0 12px;gap:6px}
.trilab b{font:700 13px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink)}.trilab .t8 b{color:var(--good)}.trilab .el b{color:var(--bad)}
.bande{display:grid;grid-template-columns:repeat(36,1fr);gap:1px;height:22px}
.bande i{background:color-mix(in srgb,var(--k) calc(var(--a) * 100%),var(--surface));border-radius:1px}
.bande i.cut{box-shadow:2px 0 0 0 var(--ink-3)}
.bandelab{position:relative;height:16px;font:10px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink-3)}
.bandelab span{position:absolute;top:2px}.bandelab .d{right:0}
.mode{font-size:12.5px;color:var(--ink-2)}
.note{font-size:12.5px;color:var(--ink-3);max-width:96ch;line-height:1.55}
.note a{color:var(--fr)}
</style>
</head>
<body>
${nav('uefa')}
<main>
<h1>Où finiront les clubs français ?</h1>
<p class="lede">Pour chaque club français, la probabilité de finir la phase de ligue dans le top 8 (huitièmes directs), en barrages (9e–24e) ou éliminé — et rang par rang, de 1 à 36.</p>
<div class="maj">${(P.n || 0).toLocaleString('fr-FR')} saisons simulées · source arrêtée au ${esc(P.maj || D.meta.lastUpdated)} · mise à jour après chaque soir de match</div>
${corps}
<p class="note">Une tendance, pas un pronostic. Le modèle donne à chaque club la force de sa nation (au coefficient à cinq ans), un peu plus ou un peu moins selon son rang dans le contingent, et ne retient que les victoires, nuls et défaites : un 9-1 et un 1-0 pèsent pareil. Les égalités de points sont départagées par cette force, pas par la différence de buts comme dans le vrai classement. Méthode complète : <a href="/football-coefficient-uefa/#projection">la projection du coefficient UEFA</a>.</p>
</main>
${THEME_JS}
${ANALYTICS}
</body>
</html>
`;
  return { html, url: u, n: clubs.length };
}
