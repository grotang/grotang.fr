/* PAGE « Qui va gagner les coupes d'Europe ? » — projection club par club (C29, 14/11/2026)
 *   /football-clubs-projection-uefa/ (registre : CLUBS_PRJ, ligne sous « Coefficient UEFA » dans le menu)
 *
 * Pour chaque club des trois compétitions, la chance d'atteindre le top 24, les 8es, les
 * quarts, les demies, la finale, et de gagner ; et pour la France, le nombre de clubs en
 * quarts, de finalistes, de coupes. Tout vient de la projection du robot (projette.mjs →
 * PRJ.clubsKO, PRJ.clubs, PRJ.france dans page.html) : la page suit la projection sans rien
 * faire tourner de plus. Forme validée par GT le 14/11 (maquette v2 : la course en courbes
 * lissées, survol, tableau triable phase de ligue / phase finale, bloc France).
 * Backtest au club : Claude outputs/c01/clubs_ko.py (2024/25 et 2025/26 rejouées).
 */
import { nav, navCSS, FAVICON, FONTS, TOKENS, THEME_BOOT, THEME_JS, ANALYTICS, PIED } from '../chrome.mjs';
import { CLUBS_PRJ, CACHEES, DOMAINE } from '../site.mjs';

const entre = (src, a, b) => { const i = src.indexOf(a); if (i < 0) return null; const j = src.indexOf(b, i + a.length); return j < 0 ? null : src.slice(i + a.length, j); };
const objet = (src, nom) => { const m = new RegExp(`const ${nom} = (\\{[^\\n]*?\\});`).exec(src); return m ? Function(`return (${m[1]});`)() : {}; };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function buildClubsProjection(src) {
  const D = JSON.parse(entre(src, '/*DATA_START*/', '/*DATA_END*/').replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
  const P = JSON.parse(entre(src, '/*PRJ_START*/', '/*PRJ_END*/').replace(/^const PRJ\s*=\s*/, '').replace(/;\s*$/, ''));
  const NOMCLUB = JSON.parse(entre(src, '/*NOMS_START*/const NOMCLUB = ', ';/*NOMS_END*/') || '{}');
  const FRNAME = objet(src, 'FRNAME'), COURT = objet(src, 'CLUB_COURT');
  const nom = n => { const f = NOMCLUB[n] || n; return COURT[f] || f; };
  /* couleurs des nations : les mêmes que la page UEFA (France d'abord, puis le top 8 du classement) */
  const top8 = [...(D.nations || [])].sort((a, b) => a.r - b.r).slice(0, 8).map(n => n.c);
  const slot = {}; ['FRA', ...top8.filter(c => c !== 'FRA')].forEach((c, i) => { slot[c] = '--n' + (i + 1); });
  const nat = {}, bil = {}, t8 = {};
  for (const [c, L] of Object.entries(D.eff || {})) for (const r of L) { nat[r[0] + '|' + r[1]] = c; bil[r[0] + '|' + r[1]] = [r[7] || 0, r[8] || 0, r[9] || 0]; }
  for (const c of P.clubs || []) t8[c[0] + '|' + c[2]] = c[9];
  const pret = Array.isArray(P.clubsKO) && P.clubsKO.length;
  const comp = [[], [], []];
  for (const x of P.clubsKO || []) { const cle = x[0] + '|' + x[1];
    comp[x[1]].push({ n: nom(x[0]), c: nat[cle] || (P.clubs || []).find(c => c[0] === x[0])?.[1] || '?', v: bil[cle] || [0, 0, 0], top8: t8[cle] ?? 0, p: x.slice(2, 8) }); }
  for (const L of comp) L.sort((a, b) => b.p[5] - a.p[5] || b.p[1] - a.p[1]);
  const H = Object.fromEntries(Object.entries(P.france || {}).map(([h, L]) => [h, Object.fromEntries(L.map((v, i) => [i, v]))]));
  const maj = String(P.maj || D.meta.lastUpdated || '').split(' ')[0];
  const DATA = JSON.stringify({ comp, H, nat: FRNAME, slot, maj, n: P.n || 0 });
  const u = CLUBS_PRJ.url;
  const fav = comp.map(L => L[0]).filter(Boolean);
  const pc = x => Math.round(x * 100) + ' %';
  const desc = pret ? `${fav.map(c => `${c.n} ${pc(c.p[5])}`).join(', ')}… La chance de chaque club d'atteindre les 8es, les quarts, les demies, la finale et de gagner la Ligue des champions, la Ligue Europa ou la Ligue Conférence, mise à jour après chaque soir de match.`
                    : "La chance de chaque club de gagner la Ligue des champions, la Ligue Europa ou la Ligue Conférence, tour par tour.";
  const titre = "Qui va gagner la Ligue des champions ? Les chances de chaque club, tour par tour";
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titre)} — grotang.fr</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${DOMAINE}${u}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${DOMAINE}${u}">
<meta property="og:locale" content="fr_FR">
${FAVICON}
${FONTS}
${THEME_BOOT}
<style>${TOKENS}
${navCSS}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1100px;margin:0 auto;padding:24px clamp(14px,3vw,28px) 60px}
h1{font:700 clamp(26px,4vw,38px)/1.15 Newsreader,Georgia,serif;letter-spacing:-.01em;margin:6px 0 8px}
.surtitre{font:700 11px Carlito,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
.surtitre a{color:inherit}
.lede{color:var(--ink-2);margin:0 0 6px}
.maj{font:12px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink-3);margin-bottom:6px}
.pan{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:clamp(14px,2.2vw,22px)}
.note{font-size:12.5px;color:var(--ink-3);max-width:96ch;line-height:1.55}
.note a{color:var(--fr)}

h1{margin-bottom:6px}
.lede{font-size:17px;max-width:62ch}
.hero{margin:18px 0 6px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 16px}
.hero .big{font:700 clamp(46px,7vw,64px)/1 Carlito,sans-serif;color:var(--fr);letter-spacing:-.02em}
.hero .t{font:600 clamp(17px,2vw,20px)/1.3 Carlito,sans-serif;color:var(--ink);max-width:30ch}
.pills{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 26px}
.pills span{font:13px Carlito,sans-serif;color:var(--ink-2);border:1px solid var(--rule);border-radius:999px;padding:4px 10px;background:var(--surface)}
.pills b{color:var(--ink)}
.pills i{font-style:normal;font:600 10px 'IBM Plex Mono',monospace;color:var(--ink-3);margin-left:4px}
h2{font:700 20px Carlito,sans-serif;margin:30px 0 10px}
.comp{display:flex;gap:4px;margin:0 0 14px;flex-wrap:wrap}
.comp button{font:600 13px Carlito,sans-serif;padding:6px 13px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);cursor:pointer}
.comp button.on{color:#fff;border-color:transparent}
@media (max-width:560px){.comp .lo{display:none}}@media (min-width:561px){.comp .co{display:none}}
/* course */
.ch{position:relative}
.ch svg{width:100%;height:auto;display:block;overflow:visible}
.ch .ln{fill:none;stroke-linecap:round;transition:opacity .15s,stroke-width .15s}
.ch .fond{stroke:var(--ink-3);stroke-width:1;opacity:.22}
.ch.hov .ln{opacity:.12}
.ch.hov .ln.on{opacity:1;stroke-width:3.2}
.ch .lb{font:12px Carlito,sans-serif;fill:var(--ink-2);cursor:default}
.ch .lb tspan{fill:var(--ink)}
.ch .lb.fr{fill:var(--fr)}
.ch .lb.fr{font-weight:700}
.ch.hov .lb{opacity:.25}.ch.hov .lb.on{opacity:1;font-weight:700}
.ch .dot{opacity:0}.ch.hov .dot.on{opacity:1}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--rule);border-radius:4px;box-shadow:var(--shadow);padding:9px 11px 8px;font:13px Carlito,sans-serif;min-width:178px;z-index:5}
.tip .tt{font-weight:700;font-size:14px;margin-bottom:2px;display:flex;align-items:center;gap:6px}
.tip .tt i{width:9px;height:9px;border-radius:50%;display:inline-block}
.tip .ts{color:var(--ink-3);font-size:12px;margin-bottom:6px}
.tip .r{display:grid;grid-template-columns:62px 1fr 38px;align-items:center;gap:7px;margin:2px 0;color:var(--ink-2)}
.tip .r u{height:5px;border-radius:3px;background:var(--rule-soft);position:relative;text-decoration:none}
.tip .r u s{position:absolute;left:0;top:0;bottom:0;border-radius:3px;text-decoration:none}
.tip .r b{color:var(--ink);text-align:right;font-variant-numeric:tabular-nums}
.tip .r.k{border-top:1px dashed var(--rule);padding-top:3px;margin-top:4px}
/* tableau */
.tw{overflow-x:auto}
table.g{border-collapse:separate;border-spacing:0;width:100%;font:14px Carlito,sans-serif;font-variant-numeric:tabular-nums}
table.g th{font:700 11px Carlito,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);padding:6px 6px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--rule);cursor:pointer;user-select:none}
table.g th.l{text-align:left}
table.g th:hover{color:var(--ink)}
table.g th.tri{color:var(--ink)}
table.g th .ar{display:inline-block;width:9px;color:var(--ink-3)}
table.g tr.grp th{cursor:default;border-bottom:0;padding:0 6px 2px;font-size:11px;color:var(--ink-2);text-align:left}
table.g tr.grp th.pf{border-left:2px solid var(--rule);padding-left:12px}
table.g td{padding:5px 6px;border-bottom:1px solid var(--rule-soft);text-align:right;white-space:nowrap}
table.g td.l{text-align:left}
table.g .pf1{border-left:2px solid var(--rule);padding-left:12px}
table.g td.cl{font-weight:600}
table.g td.cl i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}
table.g td.cl u{text-decoration:none;font:600 10px 'IBM Plex Mono',monospace;color:var(--ink-3);margin-left:6px}
table.g td.bi{color:var(--ink-2)}
table.g td.p{width:62px}
table.g td.p .v{display:block;font-weight:600}
table.g td.p .v.z{color:var(--ink-3);font-weight:400}
table.g td.p .bar{display:block;height:3px;margin-top:3px;border-radius:2px;background:var(--rule-soft);position:relative}
table.g td.p .bar s{position:absolute;right:0;top:0;bottom:0;border-radius:2px}
table.g tr.fr td{background:var(--fr-soft)}
table.g tr.fr td.cl{color:var(--fr)}
table.g tr:hover td{background:var(--surface-2)}
table.g tr.fr:hover td{background:color-mix(in srgb,var(--fr-soft) 80%,var(--fr))}
.plus{font:600 13px Carlito,sans-serif;color:var(--ink-2);margin-top:10px;cursor:pointer}
table.g .co,table.g .cox{display:none}
@media (max-width:560px){table.g .lo{display:none} table.g .co{display:inline} table.g .cox{display:table-cell} table.g .mob{display:none} table.g td.p{width:34px} table.g td.cl{max-width:104px;overflow:hidden;text-overflow:ellipsis} table.g th{letter-spacing:0} table.g{font-size:13px} table.g td.cl u{display:none} table.g td,table.g th{padding-left:4px;padding-right:4px} table.g .pf1,table.g tr.grp th.pf{padding-left:7px}}
/* France */
.frg{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:640px){.frg{grid-template-columns:1fr}}
.hist .ct{font:700 13px Carlito,sans-serif;margin-bottom:8px}
.hist .r{display:grid;grid-template-columns:86px 1fr 46px;align-items:center;gap:8px;margin:3px 0;font:13px Carlito,sans-serif;color:var(--ink-2)}
.hist .r div{height:16px;background:var(--fr);border-radius:2px}
.hist .r.m div{background:color-mix(in srgb,var(--fr) 45%,var(--surface))}
.hist .r b{color:var(--ink);text-align:right}
.note{font-size:13px}

</style>
</head>
<body>
${nav(CLUBS_PRJ.key)}
<main>
<div class="surtitre">Football · <a href="/football-coefficient-uefa/">Coefficient UEFA</a> · Projection des clubs</div>
<h1>Qui va gagner les coupes d'Europe ?</h1>
<p class="lede">Ligue des champions, Ligue Europa, Ligue Conférence : la chance de chaque club, tour après tour, jusqu'au trophée.</p>
${pret ? `<div class="hero" id="hero"></div>
<div class="pills" id="pills"></div>
<div class="pan">
  <div class="comp" id="comp"></div>
  <div class="ch" id="ch"></div>
</div>
<h2>Club par club</h2>
<div class="pan"><div class="tw" id="tab"></div></div>
<h2>Et la France ?</h2>
<div class="pan"><div class="frg" id="frg"></div></div>
<p class="maj" style="margin-top:14px" id="maj"></p>
<p class="note"><a href="/football-coefficient-uefa/#projection">Comment c'est calculé</a> · <a href="${CACHEES.clubsFR}">Phase de ligue : la fourchette de rang de chaque club</a></p>` : `<p class="note">Projection en cours de calcul : revenez après le prochain passage du robot.</p>`}
${PIED}
</main>
${pret ? `<script>

const DATA = ${DATA};
const SLOT = DATA.slot;
const col = c => \`var(\${SLOT[c] || '--ink-3'})\`;
/* deux clubs d'une même nation : même famille de couleur, teinte différente (le 1er de la
   nation garde la couleur pleine, les suivants alternent plus sombre / plus clair) */
const MIX = [['--ink', 30], ['--surface', 42], ['--ink', 52], ['--surface', 62], ['--ink', 66]];
let RN = new Map();
const teinte = c => { const j = RN.get(c.n) || 0, b = col(c.c); if (!j) return b; const [w, p] = MIX[(j - 1) % MIX.length]; return \`color-mix(in oklab, \${b} \${100 - p}%, var(\${w}))\`; };
const CN = ['Ligue des champions','Ligue Europa','Ligue Conférence'], CV = ['--c1','--c3','--c4'], CK = ['C1','C3','C4'];
const TOURS = ['Top 24','8es','Quarts','Demies','Finale','Titre'];
const pc = x => x >= .995 ? '>99' : x < .005 ? (x > 0 ? '<1' : '0') : String(Math.round(x * 100));
const pcs = x => pc(x) + ' %';
const NATN = DATA.nat;
let K = 0;
document.getElementById('maj').textContent = \`\${DATA.n.toLocaleString('fr-FR')} saisons simulées · données du \${DATA.maj} · mise à jour après chaque soir de match\`;
/* intro */
{ const H = DATA.H, au1 = 1 - (H.w[0] || 0);
  const fr = DATA.comp.flatMap((L, k) => L.filter(x => x.c === 'FRA').map(x => ({ ...x, k }))).sort((a, b) => b.p[5] - a.p[5]);
  document.getElementById('hero').innerHTML = \`<span class="big">\${Math.round(au1 * 100)} %</span><span class="t">de chances qu'un club français soulève une coupe d'Europe cette saison</span>\`;
  document.getElementById('pills').innerHTML = fr.filter(x => x.p[5] >= .01).map(x => \`<span><b>\${x.n}</b> \${pcs(x.p[5])}<i>\${CK[x.k]}</i></span>\`).join(''); }
/* sélecteur */
function comp() { document.getElementById('comp').innerHTML = CN.map((n, k) => \`<button class="\${k === K ? 'on' : ''}" style="\${k === K ? \`background:var(\${CV[k]})\` : ''}" onclick="K=\${k};tout()"><span class="lo">\${n}</span><span class="co">\${CK[k]}</span></button>\`).join(''); }
/* courbe lissée : spline monotone (Fritsch–Carlson), ne dépasse jamais ses points */
function lisse(P) {
  const n = P.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  let s = \`M\${P[0][0]},\${P[0][1]}\`;
  for (let i = 0; i < n - 1; i++) { const h = (P[i + 1][0] - P[i][0]) / 3;
    s += \` C\${P[i][0] + h},\${P[i][1] + m[i] * h} \${P[i + 1][0] - h},\${P[i + 1][1] - m[i + 1] * h} \${P[i + 1][0]},\${P[i + 1][1]}\`; }
  return s;
}
function course() {
  const box = document.getElementById('ch'), Wd = box.clientWidth, mob = Wd < 560;
  const W = Wd, H = mob ? 330 : 400, l = 30, r = mob ? 96 : 150, t = 12, b = 30;
  const L = DATA.comp[K], x = i => l + i * (W - l - r) / 5, y = v => t + (1 - v) * (H - t - b);
  const vis = new Set([...L.slice(0, mob ? 5 : 7), ...L.filter(c => c.c === 'FRA' && c.p[1] >= .2)].map(c => c.n));
  let s = \`<svg viewBox="0 0 \${W} \${H}" id="sv">\`;
  for (const v of [0, .25, .5, .75, 1]) s += \`<line x1="\${l}" x2="\${x(5)}" y1="\${y(v)}" y2="\${y(v)}" stroke="var(--rule-soft)"/><text x="\${l - 6}" y="\${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">\${v * 100}\${v === 1 ? ' %' : ''}</text>\`;
  TOURS.forEach((n, i) => s += \`<line x1="\${x(i)}" x2="\${x(i)}" y1="\${t}" y2="\${H - b}" stroke="var(--rule-soft)" stroke-dasharray="\${i ? '2 3' : ''}"/><text x="\${x(i)}" y="\${H - 10}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink-2)">\${mob && n.length > 6 ? n.slice(0, 4) + '.' : n}</text>\`);
  const ordre = [...L].sort((a, b) => (vis.has(a.n) - vis.has(b.n)) || (a.c === 'FRA') - (b.c === 'FRA'));
  for (const c of ordre) { const P = c.p.map((v, i) => [x(i), y(v)]), on = vis.has(c.n), fr = c.c === 'FRA';
    s += \`<path class="ln \${on ? '' : 'fond'}" data-n="\${c.n}" d="\${lisse(P)}" stroke="\${on ? teinte(c) : ''}" stroke-width="\${on ? (fr ? 2.6 : 1.8) : 1}"/>\`;
    s += c.p.map((v, i) => \`<circle class="dot" data-n="\${c.n}" cx="\${x(i)}" cy="\${y(v)}" r="3.2" fill="var(--surface)" stroke="\${teinte(c)}" stroke-width="2"/>\`).join(''); }
  const lab = L.filter(c => vis.has(c.n)).map(c => ({ c, y: y(c.p[5]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < lab.length; i++) lab[i].y = Math.max(lab[i].y, lab[i - 1].y + 14);
  const bas = H - b - 2; if (lab.length && lab[lab.length - 1].y > bas) { lab[lab.length - 1].y = bas; for (let i = lab.length - 2; i >= 0; i--) lab[i].y = Math.min(lab[i].y, lab[i + 1].y - 14); }
  for (const o of lab) s += \`<text class="lb \${o.c.c === 'FRA' ? 'fr' : ''}" data-n="\${o.c.n}" x="\${x(5) + 9}" y="\${o.y + 4}"><tspan class="pt" style="fill:\${teinte(o.c)}">●</tspan> \${o.c.n} <tspan font-weight="700">\${pcs(o.c.p[5])}</tspan></text>\`;
  box.innerHTML = s + '</svg><div class="tip" id="tip" hidden></div>';
  const sv = box.querySelector('svg'), tip = box.querySelector('#tip');
  const montre = (n, ev) => {
    const c = L.find(z => z.n === n); if (!c) return cache();
    box.classList.add('hov'); box.querySelectorAll('[data-n]').forEach(e => e.classList.toggle('on', e.dataset.n === n));
    const cc = teinte(c);
    tip.innerHTML = \`<div class="tt"><i style="background:\${cc}"></i>\${c.n}</div><div class="ts">\${NATN[c.c] || c.c} · bilan \${c.v.join('-')} · top 8 : \${pcs(c.top8)}</div>\`
      + c.p.map((v, i) => \`<div class="r\${i === 1 ? ' k' : ''}"><span>\${TOURS[i]}</span><u><s style="width:\${v * 100}%;background:\${cc}"></s></u><b>\${pcs(v)}</b></div>\`).join('');
    tip.hidden = false; const R = box.getBoundingClientRect(); let px = ev.clientX - R.left + 16, py = ev.clientY - R.top + 12;
    if (px + 200 > R.width) px = ev.clientX - R.left - 210; if (py + 210 > R.height) py = R.height - 214;
    tip.style.left = Math.max(0, px) + 'px'; tip.style.top = Math.max(0, py) + 'px'; };
  const cache = () => { box.classList.remove('hov'); box.querySelectorAll('.on').forEach(e => e.classList.remove('on')); tip.hidden = true; };
  /* survol : la courbe la plus proche du pointeur, toutes les 36 comprises */
  sv.addEventListener('mousemove', ev => { const R = sv.getBoundingClientRect(), mx = (ev.clientX - R.left) * W / R.width, my = (ev.clientY - R.top) * H / R.height;
    if (ev.target.dataset && ev.target.dataset.n && ev.target.tagName === 'text') return montre(ev.target.dataset.n, ev);
    if (mx < l - 4 || mx > x(5) + 4) return cache();
    const f = Math.min(4.999, Math.max(0, (mx - l) / ((W - l - r) / 5))), i = Math.floor(f), u = f - i;
    let best = null, bd = 18;
    for (const c of L) { const v = c.p[i] + (c.p[i + 1] - c.p[i]) * (u * u * (3 - 2 * u)), dd = Math.abs(y(v) - my); if (dd < bd) { bd = dd; best = c.n; } }
    best ? montre(best, ev) : cache(); });
  sv.addEventListener('mouseleave', cache);
}
/* tableau triable */
const COLS = [
  { k: 'n', t: 'Club', l: 1, g: 0 }, { k: 'bi', t: 'Bilan', g: 0, mob: 1 }, { k: 'top8', t: 'Top 8', c: 'T8', g: 0, p: 1 }, { k: 0, t: 'Top 24', g: 0, p: 1, mob: 1 },
  { k: 1, t: '8es', g: 1, p: 1 }, { k: 2, t: 'Quarts', c: '1/4', g: 1, p: 1 }, { k: 3, t: 'Demies', c: '1/2', g: 1, p: 1 }, { k: 4, t: 'Finale', c: 'F', g: 1, p: 1 }, { k: 5, t: 'Titre', g: 1, p: 1 }];
let TRI = { k: 5, s: -1 }, TOUS = false;
const val = (c, k) => k === 'n' ? c.n : k === 'bi' ? 3 * c.v[0] + c.v[1] + c.v[0] / 100 : k === 'top8' ? c.top8 : c.p[k];
const cell = (v, k) => \`<span class="v\${v < .005 ? ' z' : ''}">\${pc(v)}</span><span class="bar"><s style="width:\${Math.max(v * 100, v > 0 ? 3 : 0)}%;background:var(\${CV[k]})"></s></span>\`;
function tableau() {
  const L = [...DATA.comp[K]].sort((a, b) => { const A = val(a, TRI.k), B = val(b, TRI.k); return (typeof A === 'string' ? A.localeCompare(B) : A - B) * TRI.s || b.p[5] - a.p[5]; });
  const R = TOUS ? L : L.slice(0, 16);
  let h = \`<table class="g"><tr class="grp"><th colspan="2" class="l mob">\${CN[K]}</th><th class="l cox">\${CK[K]}</th><th colspan="2" class="mob">Phase de ligue</th><th class="cox">Ligue</th><th colspan="5" class="pf"><span class="lo">Phase finale · chance d'atteindre</span><span class="co">Phase finale</span></th></tr><tr>\`
    + COLS.map((c, i) => \`<th data-i="\${i}" class="\${c.l ? 'l ' : ''}\${c.mob ? 'mob ' : ''}\${c.k === 1 ? 'pf1 ' : ''}\${TRI.k === c.k ? 'tri' : ''}">\${c.c ? \`<span class="lo">\${c.t}</span><span class="co">\${c.c}</span>\` : c.t}<span class="ar">\${TRI.k === c.k ? (TRI.s < 0 ? '↓' : '↑') : ''}</span></th>\`).join('') + '</tr>';
  h += R.map(c => \`<tr class="\${c.c === 'FRA' ? 'fr' : ''}"><td class="cl l"><i style="background:\${teinte(c)}"></i>\${c.n}<u>\${c.c}</u></td><td class="bi mob">\${c.v.join('-')}</td>\`
    + \`<td class="p">\${cell(c.top8, K)}</td><td class="p mob">\${cell(c.p[0], K)}</td>\`
    + [1, 2, 3, 4, 5].map(i => \`<td class="p\${i === 1 ? ' pf1' : ''}">\${cell(c.p[i], K)}</td>\`).join('') + '</tr>').join('');
  h += '</table>' + (L.length > 16 ? \`<div class="plus" id="plus">\${TOUS ? '▴ réduire' : \`▾ les \${L.length} clubs\`}</div>\` : '');
  const T = document.getElementById('tab'); T.innerHTML = h;
  T.querySelectorAll('th[data-i]').forEach(th => th.onclick = () => { const c = COLS[+th.dataset.i]; TRI = { k: c.k, s: TRI.k === c.k ? -TRI.s : (c.k === 'n' ? 1 : -1) }; tableau(); });
  const p = document.getElementById('plus'); if (p) p.onclick = () => { TOUS = !TOUS; tableau(); };
}
function tout() { const vu = {}; RN = new Map(); [...DATA.comp[K]].sort((a, b) => b.p[5] - a.p[5] || b.p[1] - a.p[1]).forEach(c => { RN.set(c.n, vu[c.c] = (vu[c.c] ?? -1) + 1); }); comp(); course(); tableau(); }
tout(); addEventListener('resize', () => course());
/* France */
{ const H = DATA.H, rows = (o, lab, max) => Object.keys(o).map(Number).sort((a, b) => a - b).filter(n => n <= max).map(n => {
    const v = o[n] || 0, m = Object.keys(o).reduce((a, k) => Math.max(a, o[k]), 0);
    return \`<div class="r\${v === m ? '' : ' m'}"><span>\${lab(n)}</span><div style="width:\${v / m * 100}%"></div><b>\${pcs(v)}</b></div>\`; }).join('');
  document.getElementById('frg').innerHTML = \`<div class="hist"><div class="ct">Combien de clubs français en quarts ?</div>\${rows(H.q, n => n + (n > 1 ? ' clubs' : ' club'), 5)}</div>\`
    + \`<div class="hist"><div class="ct">Combien de coupes pour la France ?</div>\${rows(H.w, n => n === 0 ? 'aucune' : n + (n > 1 ? ' coupes' : ' coupe'), 3)}<div class="ct" style="margin-top:14px">Combien de finalistes français ?</div>\${rows(H.f, n => n === 0 ? 'aucun' : String(n), 3)}</div>\`; }

</script>` : ''}
${THEME_JS}
${ANALYTICS}
</body>
</html>
`;
  return { html, url: u, n: comp.flat().length };
}
