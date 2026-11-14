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
import fs from 'node:fs';
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
  /* bloc 3 : l'archive semaine par semaine (projette.mjs), saison en cours ; à défaut, le seul point du jour */
  let arch = {}; try { arch = JSON.parse(fs.readFileSync(new URL('./archive/clubs-semaines.json', import.meta.url), 'utf8'))[D.meta.season] || {}; } catch (e) { arch = {}; }
  let sem = Object.keys(arch).sort().map(w => ({ d: arch[w].d1 || w, t: Object.fromEntries(arch[w].ko.map(c => [nom(c[0]), c[7]])) }));
  if (!sem.length) { const [jj, mm, aa] = maj.split('/'); sem = [{ d: `${aa}-${mm}-${jj}`, t: Object.fromEntries((P.clubsKO || []).map(c => [nom(c[0]), c[7]])) }]; }
  const finales = [...src.matchAll(/\['F','(\d{4}-\d\d-\d\d)'\]/g)].slice(0, 3).map(m => m[1]);
  const DATA = JSON.stringify({ comp, H, nat: FRNAME, slot, maj, n: P.n || 0, ordre: [...(D.nations || [])].sort((a, b) => a.r - b.r).map(n => n.c), evo: { sem, fin: finales.length === 3 ? finales : [0, 1, 2].map(() => sem[sem.length - 1].d) } });
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

.hero{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:6px 22px;margin:20px 0 6px;padding:16px 22px;background:var(--surface);border:1px solid var(--rule);border-left:4px solid var(--fr);border-radius:3px}
.hero .hn{font:700 clamp(46px,6.5vw,62px)/1 Carlito,sans-serif;color:var(--fr);letter-spacing:-.02em;white-space:nowrap}
.hero .hn small{font-size:.5em;margin-left:3px;vertical-align:.55em}
.hero .ht > b{display:block;font:600 clamp(16px,1.9vw,19px)/1.3 Carlito,sans-serif;color:var(--ink);max-width:40ch}
.hero .hn{grid-row:span 2}
.hero .ht{align-self:end}
.hero .pills{display:flex;gap:6px;flex-wrap:wrap;align-self:start;margin-top:2px}
.hero .pills span{font:13px Carlito,sans-serif;color:var(--ink-2);border:1px solid var(--rule);border-radius:999px;padding:3px 10px;background:var(--surface-2)}
.hero .pills b{color:var(--ink)}
.hero .pills i{font-style:normal;font:600 10px 'IBM Plex Mono',monospace;color:var(--ink-3);margin-left:4px}
@media (max-width:560px){.hero{gap:8px 14px;padding:14px 14px}.hero .hn{grid-row:auto}.hero .ht{align-self:center}.hero .pills{grid-column:1 / -1}}
.blk{margin-top:30px}
.blk h2{font:700 20px Carlito,sans-serif;margin:0 0 4px;display:flex;align-items:center}
.blk h2 .no{font:700 11px Carlito,sans-serif;letter-spacing:.06em;color:var(--surface);background:var(--ink);padding:2px 7px;border-radius:2px;margin-right:10px}
.blk .sous{color:var(--ink-2);font-size:14px;margin:0 0 10px}
.blk > .pan{margin-top:10px}
.ch .mk{pointer-events:none}
.ch.hov .mk{opacity:.12}.ch.hov .mk.on{opacity:1}
.ch .vl{font:700 11px Carlito,sans-serif;pointer-events:none;paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}
.ch.hov .vl{opacity:.15}.ch.hov .vl.on{opacity:1}
table.g td.cl .kc{font:700 9.5px Carlito,sans-serif;color:#fff;border-radius:999px;padding:1px 6px;margin-left:7px;vertical-align:1px}
:root[data-theme="dark"] table.g td.cl .kc{color:#0B0F14}
.sw svg,.ev svg{width:100%;height:auto;display:block}
.lbs{font:11.5px Carlito,sans-serif;fill:var(--ink-2);paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}
.lbs.fr{fill:var(--fr);font-weight:700}
.lbs tspan{stroke-width:3px}
.evn{font-size:12.5px;color:var(--ink-3);margin:8px 0 0}
/* titres DANS les blocs, filtres coupe à gauche / nation à droite : gabarit des pages
   Coefficient UEFA et Force des clubs (GT, 14/11/2026) */
.blk{margin-top:16px}
.ptitle{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 9px;margin-bottom:4px}
.ptitle .no{font:700 11px Carlito,sans-serif;letter-spacing:.06em;color:var(--surface);background:var(--ink);border-radius:2px;padding:2px 6px;flex:none}
.ptitle h3{font:600 17.5px/1.25 Carlito,sans-serif;letter-spacing:-.008em;margin:0}
@media (max-width:680px){.ptitle h3{flex:1 1 12em;min-width:0}}
.psous{font-size:13px;color:var(--ink-3);margin:0 0 12px}
.ptitle + .f1,.ptitle + .frg{margin-top:12px}
.f1{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 14px}
.f1 .grp{display:flex;align-items:center;gap:8px;min-width:0}
.f1 .grp.dr{margin-left:auto}
.f1 .lb{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
.seg{display:inline-flex;border:1px solid var(--rule);border-radius:3px;overflow:hidden}
.seg button{font:inherit;font-size:13px;height:32px;padding:0 11px;border:0;background:var(--surface);color:var(--ink-2);cursor:pointer;border-right:1px solid var(--rule)}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:var(--surface);font-weight:700}
.seg .co{display:none}
select.sel{font:inherit;font-size:13.5px;height:32px;padding:0 8px;border:1px solid var(--rule);border-radius:3px;background:var(--surface);color:var(--ink);min-width:150px;max-width:100%}
@media (max-width:640px){
  .f1{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:end}
  .f1 .grp{flex-direction:column;align-items:stretch;gap:4px}
  .f1 .grp.dr{margin-left:0}
  .seg button,select.sel{height:38px;font-size:14px}
  select.sel{min-width:0;width:100%}
  .seg .lo{display:none} .seg .co{display:inline}
}
/* bloc 4 : les trois premières colonnes comme la page Force des clubs */
table.g th{font:600 11px Carlito,sans-serif;letter-spacing:.1em}
table.g td.rg{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink-3);width:28px;text-align:right;padding-right:4px}
table.g th.rg{cursor:default}
table.g td.club{font-weight:600;text-align:left;color:var(--ink)}
table.g td.club i.sq{display:none;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:0}
table.g td.nation{white-space:nowrap;font-size:13.5px;text-align:left}
table.g td.nation i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:7px;vertical-align:0}
table.g .court{display:none;font-family:'IBM Plex Mono',monospace;font-size:11.5px}
table.g i.cp{display:inline-block;min-width:24px;text-align:center;font:600 10.5px 'IBM Plex Mono',monospace;color:#fff;border-radius:2px;padding:1px 4px;font-style:normal}
:root[data-theme="dark"] table.g i.cp{color:#0B0F14}
table.g td.vide{text-align:left;color:var(--ink-3);padding:14px 6px}
/* téléphone : la nation passe en carré devant le club (la colonne ne tient pas), noms longs coupés */
@media (max-width:560px){table.g td.rg,table.g th.rg,table.g td.nation,table.g th.nat{display:none} table.g td.club i.sq{display:inline-block} table.g td.club .nm{display:inline-block;max-width:calc(100% - 16px);overflow:hidden;text-overflow:ellipsis;vertical-align:bottom} table.g tr.grp{display:none} table.g{table-layout:fixed} table.g th.clh{width:34%} table.g th.cph{width:13%} table.g td.club{overflow:hidden;white-space:nowrap} table.g th{letter-spacing:0;padding-left:2px;padding-right:2px} table.g td{padding-left:2px;padding-right:2px}}
/* bloc 2 : survol */
.sw{position:relative}
.sw .fp{transition:opacity .12s}
.sw.hov .fp{opacity:.22}.sw.hov .fp.on{opacity:1}
.sw.hov .lbs{opacity:.2}.sw.hov .lbs.on{opacity:1}
.tipf{min-width:236px}
.tipf .tt .cp{font:600 10px 'IBM Plex Mono',monospace;color:#fff;border-radius:2px;padding:1px 5px;margin-left:auto;font-style:normal}
:root[data-theme="dark"] .tipf .tt .cp{color:#0B0F14}
.tipf .tt{gap:7px}
.tipf .ts{margin-bottom:8px}
.tipf .tg{display:flex;align-items:baseline;gap:8px;padding:6px 0 8px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin-bottom:6px}
.tipf .tg .tl{font:700 10.5px Carlito,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.tipf .tg b{font:700 30px/1 Carlito,sans-serif;letter-spacing:-.01em}
.tipf .tg .tsur{font-size:12px;color:var(--ink-3);margin-left:auto}
.tipf .tpar{font:700 10.5px Carlito,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px}
.tipf .tf{font-size:11.5px;color:var(--ink-3);margin-top:6px}
</style>
</head>
<body>
${nav(CLUBS_PRJ.key)}
<main>
<div class="surtitre">Football · <a href="/football-coefficient-uefa/">Coefficient UEFA</a> · Projection des clubs</div>
<h1>Qui va gagner les coupes d'Europe ?</h1>
<p class="lede">Ligue des champions, Ligue Europa, Ligue Conférence : la chance de chaque club, tour après tour, jusqu'au trophée.</p>
${pret ? `<div class="hero" id="hero"></div>
<section class="blk"><div class="pan">
  <div class="ptitle"><span class="no">1</span><h3>La course au trophée</h3></div>
  <p class="psous">Chance d'être encore en lice, tour après tour.</p>
  <div class="f1"><div class="grp"><span class="lb">Coupe</span><span class="seg" id="comp" role="group" aria-label="Coupe"></span></div><div class="grp dr"><label class="lb" for="natC">Nation</label><select class="sel" id="natC"></select></div></div>
  <div class="ch" id="ch"></div>
</div></section>
<section class="blk"><div class="pan">
  <div class="ptitle"><span class="no">2</span><h3>Les favoris, coupe par coupe</h3></div>
  <p class="psous">Chaque point est un club, placé selon sa chance de titre.</p>
  <div class="sw" id="sw"></div>
</div></section>
<section class="blk"><div class="pan">
  <div class="ptitle"><span class="no">3</span><h3>Semaine après semaine</h3></div>
  <p class="psous">Chance de titre à la fin de chaque semaine européenne.</p>
  <div class="f1"><div class="grp"><span class="lb">Coupe</span><span class="seg" id="compE" role="group" aria-label="Coupe"></span></div><div class="grp dr"><label class="lb" for="natE">Nation</label><select class="sel" id="natE"></select></div></div>
  <div class="ev" id="ev"></div><p class="evn" id="evn"></p>
</div></section>
<section class="blk"><div class="pan">
  <div class="ptitle"><span class="no">4</span><h3>Club par club</h3></div>
  <div class="f1"><div class="grp"><span class="lb">Coupe</span><span class="seg" id="compT" role="group" aria-label="Coupe"></span></div><div class="grp dr"><label class="lb" for="natT">Nation</label><select class="sel" id="natT"></select></div></div>
  <div class="tw" id="tab"></div>
</div></section>
<section class="blk"><div class="pan">
  <div class="ptitle"><span class="no">5</span><h3>Et la France ?</h3></div>
  <div class="frg" id="frg"></div>
</div></section>
<p class="maj" style="margin-top:14px" id="maj"></p>
<p class="note"><a href="/football-coefficient-uefa/#projection">Comment c'est calculé</a> · <a href="${CACHEES.clubsFR}">Phase de ligue : la fourchette de rang de chaque club</a></p>` : `<p class="note">Projection en cours de calcul : revenez après le prochain passage du robot.</p>`}
${PIED}
</main>
${pret ? `<script>
const DATA = ${DATA};
const SLOT = DATA.slot;
const col = c => \`var(\${SLOT[c] || '--ink-3'})\`;
/* une seule couleur par nation, partout (GT, 14/11/2026) : la France en bleu, le top 8 dans ses
   couleurs, les autres en gris */
const teinte = c => c.c === 'FRA' ? 'var(--fr)' : col(c.c);
const CN = ['Ligue des champions', 'Ligue Europa', 'Ligue Conférence'], CV = ['--c1', '--c3', '--c4'], CK = ['C1', 'C3', 'C4'];
const TOURS = ['Top 24', '8es', 'Quarts', 'Demies', 'Finale', 'Titre'];
const pc = x => x >= .995 ? '>99' : x < .005 ? (x > 0 ? '<1' : '0') : String(Math.round(x * 100));
const pcs = x => pc(x) + ' %';
const NATN = DATA.nat;
DATA.comp.forEach((L, k) => L.forEach(c => c.k = k));
let K = 0, KT = 0, NC = '', NT = '', NE = '';
document.getElementById('maj').textContent = \`\${DATA.n.toLocaleString('fr-FR')} saisons simulées · données du \${DATA.maj} · mise à jour après chaque soir de match\`;
/* en-tête : la chance qu'un club français gagne une coupe, et les clubs qui la portent */
{ const H = DATA.H, au1 = 1 - (H.w[0] || 0);
  const fr = DATA.comp.flat().filter(x => x.c === 'FRA' && x.p[5] >= .01).sort((a, b) => b.p[5] - a.p[5]);
  document.getElementById('hero').innerHTML = \`<div class="hn">\${Math.round(au1 * 100)}<small>%</small></div>\`
    + \`<div class="ht"><b>de chances qu'un club français soulève une coupe d'Europe cette saison</b></div>\`
    + \`<div class="pills">\${fr.map(x => \`<span><b>\${x.n}</b> \${pcs(x.p[5])}<i>\${CK[x.k]}</i></span>\`).join('')}</div>\`; }
/* sélecteurs : la coupe à gauche (boutons), la nation à droite (liste), même gabarit que
   la page Force des clubs ; chaque bloc a les siens */
function boutons(id, cur, tous, fn) {
  const L = CN.map((n, k) => [k, n, CK[k]]); if (tous) L.push([3, 'Toutes', 'Toutes']);
  const el = document.getElementById(id);
  el.innerHTML = L.map(([k, n, c]) => \`<button type="button" class="\${k === cur ? 'on' : ''}" aria-pressed="\${k === cur}" data-k="\${k}"><span class="lo">\${n}</span><span class="co">\${c}</span></button>\`).join('');
  el.onclick = e => { const b = e.target.closest('button'); if (b) fn(+b.dataset.k); };
}
function nations(id, cur, clubs, fn) {
  const avec = new Set(clubs.map(c => c.c)), el = document.getElementById(id);
  el.innerHTML = '<option value="">Toutes</option>' + DATA.ordre.filter(c => avec.has(c)).map(c => \`<option value="\${c}"\${c === cur ? ' selected' : ''}>\${NATN[c] || c}</option>\`).join('');
  el.onchange = () => fn(el.value);
}
const nomNat = c => \`<span style="color:\${c === 'FRA' ? 'var(--fr)' : col(c)};font-weight:\${c === 'FRA' ? 700 : 600}">\${NATN[c] || c}</span>\`;
/* bloc 1 : la course. Lignes droites d'un tour à l'autre, une marque discrète à chaque
   tour ; le favori porte ses chances au-dessus de sa courbe. */
function course() {
  boutons('comp', K, false, k => { K = k; if (NC && !DATA.comp[k].some(c => c.c === NC)) NC = ''; course(); });
  nations('natC', NC, DATA.comp[K], v => { NC = v; course(); });
  const box = document.getElementById('ch'), Wd = box.clientWidth, mob = Wd < 560;
  const W = Wd, H = mob ? 330 : 410, l = 30, r = mob ? 96 : 150, t = 26, b = 30;
  const L = DATA.comp[K], x = i => l + i * (W - l - r) / 5, y = v => t + (1 - v) * (H - t - b);
  /* une nation choisie : tous ses clubs en couleur ; sinon les favoris et les clubs français */
  const vis = new Set((NC ? L.filter(c => c.c === NC) : [...L.slice(0, mob ? 5 : 7), ...L.filter(c => c.c === 'FRA' && c.p[1] >= .2)]).map(c => c.n));
  const pts = c => c.p.map((v, i) => \`\${x(i)},\${y(v)}\`).join(' ');
  let s = \`<svg viewBox="0 0 \${W} \${H}" id="sv">\`;
  for (const v of [0, .25, .5, .75, 1]) s += \`<line x1="\${l}" x2="\${x(5)}" y1="\${y(v)}" y2="\${y(v)}" stroke="var(--rule-soft)"/><text x="\${l - 6}" y="\${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">\${v * 100}\${v === 1 ? ' %' : ''}</text>\`;
  TOURS.forEach((n, i) => s += \`<line x1="\${x(i)}" x2="\${x(i)}" y1="\${t}" y2="\${H - b}" stroke="var(--rule-soft)" stroke-dasharray="\${i ? '2 3' : ''}"/><text x="\${x(i)}" y="\${H - 10}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink-2)">\${mob && n.length > 6 ? n.slice(0, 4) + '.' : n}</text>\`);
  const F = L.find(c => vis.has(c.n)) || L[0], rg = c => (vis.has(c.n) ? 1 : 0) + (c.c === 'FRA' ? 1 : 0) + (c === F ? 2 : 0), ordre = [...L].sort((a, b) => rg(a) - rg(b));
  for (const c of ordre) { const on = vis.has(c.n), fr = c.c === 'FRA', tc = teinte(c);
    s += \`<polyline class="ln \${on ? '' : 'fond'}" data-n="\${c.n}" points="\${pts(c)}" stroke="\${on ? tc : ''}" stroke-width="\${on ? (fr ? 2.6 : 1.8) : 1}" stroke-linejoin="round"/>\`;
    if (on) s += c.p.map((v, i) => \`<circle class="mk" data-n="\${c.n}" cx="\${x(i)}" cy="\${y(v)}" r="2.3" fill="\${tc}"/>\`).join('');
    s += c.p.map((v, i) => \`<circle class="dot" data-n="\${c.n}" cx="\${x(i)}" cy="\${y(v)}" r="3.6" fill="var(--surface)" stroke="\${tc}" stroke-width="2"/>\`).join(''); }
  /* le favori : ses chances, tour par tour, au-dessus de sa courbe */
  s += F.p.map((v, i) => i === 0 || i === 5 ? '' : \`<text class="vl" data-n="\${F.n}" x="\${x(i)}" y="\${y(v) - 9}" text-anchor="middle" fill="\${teinte(F)}">\${pcs(v)}</text>\`).join('');
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
    for (const c of L) { const v = c.p[i] + (c.p[i + 1] - c.p[i]) * u, dd = Math.abs(y(v) - my); if (dd < bd) { bd = dd; best = c.n; } }
    best ? montre(best, ev) : cache(); });
  sv.addEventListener('mouseleave', cache);
}
/* bloc 2 : tableau triable, filtre par compétition (ou les trois) */
const COLS0 = [
  { k: 'rg', t: '', nt: 1 }, { k: 'n', t: 'Club', l: 1 }, { k: 'nat', t: 'Nation', l: 1 }, { k: 'cp', t: 'Coupe', l: 1, tous: 1 }, { k: 'bi', t: 'Bilan', mob: 1 },
  { k: 'top8', t: 'Top 8', c: 'T8', p: 1 }, { k: 0, t: 'Top 24', p: 1, mob: 1 },
  { k: 1, t: '8es', p: 1 }, { k: 2, t: 'Quarts', c: '1/4', p: 1 }, { k: 3, t: 'Demies', c: '1/2', p: 1 }, { k: 4, t: 'Finale', c: 'F', p: 1 }, { k: 5, t: 'Titre', p: 1 }];
let TRI = { k: 5, s: -1 }, TOUS = false;
const val = (c, k) => k === 'n' ? c.n : k === 'nat' ? (NATN[c.c] || c.c) : k === 'cp' ? c.k : k === 'bi' ? 3 * c.v[0] + c.v[1] + c.v[0] / 100 : k === 'top8' ? c.top8 : c.p[k];
const cell = (v, k) => \`<span class="v\${v < .005 ? ' z' : ''}">\${pc(v)}</span><span class="bar"><s style="width:\${Math.max(v * 100, v > 0 ? 3 : 0)}%;background:var(\${CV[k]})"></s></span>\`;
/* bloc 4 : tableau triable ; filtres coupe (ou les trois) et nation. Les trois premières
   colonnes reprennent celles de la page Force des clubs (rang, club, nation en couleur). */
function tableau() {
  boutons('compT', KT, true, k => { KT = k; TOUS = false; if (NT && k < 3 && !DATA.comp[k].some(c => c.c === NT)) NT = ''; tableau(); });
  const base = KT === 3 ? DATA.comp.flat() : DATA.comp[KT];
  nations('natT', NT, base, v => { NT = v; TOUS = false; tableau(); });
  const COLS = COLS0.filter(c => !c.tous || KT === 3);
  const L = base.filter(c => !NT || c.c === NT).sort((a, b) => { const A = val(a, TRI.k), B = val(b, TRI.k); return (typeof A === 'string' ? A.localeCompare(B, 'fr') : A - B) * TRI.s || b.p[5] - a.p[5]; });
  const R = TOUS ? L : L.slice(0, 16), g1 = COLS.findIndex(c => c.k === 'top8');
  let h = \`<table class="g"><tr class="grp"><th colspan="\${g1}" class="l"></th><th colspan="2" class="mob">Phase de ligue</th><th class="cox">Ligue</th><th colspan="5" class="pf"><span class="lo">Phase finale · chance d'atteindre</span><span class="co">Phase finale</span></th></tr><tr>\`
    + COLS.map((c, i) => \`<th data-i="\${i}" class="\${c.l ? 'l ' : ''}\${c.mob ? 'mob ' : ''}\${c.k === 'rg' ? 'rg ' : ''}\${c.k === 'nat' ? 'nat ' : ''}\${c.k === 'n' ? 'clh ' : ''}\${c.k === 'cp' ? 'cph ' : ''}\${c.k === 1 ? 'pf1 ' : ''}\${TRI.k === c.k ? 'tri' : ''}">\${c.c ? \`<span class="lo">\${c.t}</span><span class="co">\${c.c}</span>\` : c.t}<span class="ar">\${TRI.k === c.k ? (TRI.s < 0 ? '↓' : '↑') : ''}</span></th>\`).join('') + '</tr>';
  h += R.map((c, i) => \`<tr class="\${c.c === 'FRA' ? 'fr' : ''}"><td class="rg">\${i + 1}</td><td class="club l"><i class="sq" style="background:\${teinte(c)}"></i><span class="nm">\${c.n}</span></td>\`
    + \`<td class="nation l"><i style="background:\${teinte(c)}"></i>\${nomNat(c.c).replace('>' + (NATN[c.c] || c.c) + '<', \`><span class="long">\${NATN[c.c] || c.c}</span><span class="court">\${c.c}</span><\`)}</td>\`
    + (KT === 3 ? \`<td class="l"><i class="cp" style="background:var(\${CV[c.k]})">\${CK[c.k]}</i></td>\` : '')
    + \`<td class="bi mob">\${c.v.join('-')}</td><td class="p">\${cell(c.top8, c.k)}</td><td class="p mob">\${cell(c.p[0], c.k)}</td>\`
    + [1, 2, 3, 4, 5].map(i => \`<td class="p\${i === 1 ? ' pf1' : ''}">\${cell(c.p[i], c.k)}</td>\`).join('') + '</tr>').join('');
  if (!R.length) h += \`<tr><td colspan="\${COLS.length}" class="vide">Aucun club de cette nation dans cette coupe.</td></tr>\`;
  h += '</table>' + (L.length > 16 ? \`<div class="plus" id="plus">\${TOUS ? '▴ réduire' : \`▾ les \${L.length} clubs\`}</div>\` : '');
  const T = document.getElementById('tab'); T.innerHTML = h;
  T.querySelectorAll('th[data-i]:not(.rg)').forEach(th => th.onclick = () => { const c = COLS[+th.dataset.i]; TRI = { k: c.k, s: TRI.k === c.k ? -TRI.s : (c.k === 'n' ? 1 : -1) }; tableau(); });
  const p = document.getElementById('plus'); if (p) p.onclick = () => { TOUS = !TOUS; tableau(); };
}
course(); tableau(); addEventListener('resize', () => course());
/* bloc 3 : la France, toutes coupes confondues, dans la même saison simulée */
{ const H = DATA.H, rows = (o, lab, max) => Object.keys(o).map(Number).sort((a, b) => a - b).filter(n => n <= max).map(n => {
    const v = o[n] || 0, m = Object.keys(o).reduce((a, k) => Math.max(a, o[k]), 0);
    return \`<div class="r\${v === m ? '' : ' m'}"><span>\${lab(n)}</span><div style="width:\${v / m * 100}%"></div><b>\${pcs(v)}</b></div>\`; }).join('');
  document.getElementById('frg').innerHTML = \`<div class="hist"><div class="ct">Combien de clubs français en quarts ?</div>\${rows(H.q, n => n + (n > 1 ? ' clubs' : ' club'), 5)}</div>\`
    + \`<div class="hist"><div class="ct">Combien de coupes pour la France ?</div>\${rows(H.w, n => n === 0 ? 'aucune' : n + (n > 1 ? ' coupes' : ' coupe'), 3)}<div class="ct" style="margin-top:14px">Combien de finalistes français ?</div>\${rows(H.f, n => n === 0 ? 'aucun' : String(n), 3)}</div>\`; }
/* bloc 2 : les favoris, coupe par coupe. Chaque point est un club, placé selon sa chance de
   titre sur une échelle logarithmique (0,1 % à 50 %) : les petites chances restent lisibles.
   Survol (ou toucher) : le club ressort, les autres s'effacent, un trait descend jusqu'à
   l'axe ; la bulle met la chance de titre en grand, puis le parcours tour par tour. */
function favoris() {
  const box = document.getElementById('sw'), W = box.clientWidth, mob = W < 560, H = 3 * 120 + 40, l = mob ? 22 : 110, r = mob ? 26 : 20;
  const lx = v => Math.log10(Math.max(v, .001)), x = v => l + (lx(v) + 3) / (Math.log10(.5) + 3) * (W - l - r);
  let s = \`<svg viewBox="0 0 \${W} \${H}" id="svf">\`;
  for (const v of [.001, .01, .05, .1, .25, .5]) s += \`<line x1="\${x(v)}" x2="\${x(v)}" y1="8" y2="\${H - 26}" stroke="var(--rule-soft)"/><text x="\${x(v)}" y="\${H - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">\${v < .01 ? '0,1' : Math.round(v * 100)} %</text>\`;
  s += \`<line id="gd" x1="0" x2="0" y1="0" y2="\${H - 26}" stroke="var(--ink-3)" stroke-dasharray="3 3" visibility="hidden"/>\`;
  const tous = [];
  DATA.comp.forEach((Lc, k) => { const y0 = 20 + k * 120 + 50;
    s += \`<text x="0" y="\${y0 - 40}" font-size="13" font-weight="700" fill="var(\${CV[k]})">\${CN[k]}</text>\`;
    const pts = [...Lc].filter(c => c.p[5] >= .001).sort((a, b) => b.p[5] - a.p[5]).map((c, i) => ({ c, k, rang: i + 1, x: x(c.p[5]), y: y0 })), nul = Lc.length - pts.length;
    if (nul && !mob) s += \`<text x="\${x(.001) - 8}" y="\${y0 + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">\${nul} à moins de 0,1 %</text>\`;
    /* empilement : un point qui en chevauche un autre se décale au-dessus ou en dessous */
    const pos = []; for (const p of pts) { let d = 0, ok = false; while (!ok) { ok = true; for (const q of pos) if (Math.abs(q.x - p.x) < 9 && Math.abs(q.y - (y0 + d)) < 9) { ok = false; break; } if (!ok) d = d > 0 ? -d : -d + 9; } p.y = y0 + d; pos.push(p); }
    for (const p of pos) { const fr = p.c.c === 'FRA'; tous.push(p);
      s += \`<circle class="fp" data-n="\${p.c.n}" cx="\${p.x}" cy="\${p.y}" r="\${fr ? 5.5 : 4.3}" fill="\${teinte(p.c)}" stroke="\${fr ? 'var(--ink)' : 'var(--surface)'}" stroke-width="\${fr ? 1.4 : 1}"/>\`; }
    const lab = pos.filter((p, i) => i < 3 || (p.c.c === 'FRA' && p.c.p[5] >= .005));
    const DY = [-12, 20, -26, 34, -40, 48]; lab.forEach((p, i) => { const fr = p.c.c === 'FRA'; s += \`<text class="lbs \${fr ? 'fr' : ''}" data-n="\${p.c.n}" x="\${p.x}" y="\${y0 + DY[i % DY.length]}" text-anchor="middle">\${p.c.n} \${pcs(p.c.p[5])}</text>\`; });
  });
  s += \`<circle id="hl" r="9" fill="none" stroke-width="2.5" visibility="hidden"/>\`;
  box.innerHTML = s + '</svg><div class="tip tipf" id="tipf" hidden></div>';
  const sv = box.querySelector('svg'), tip = box.querySelector('#tipf'), gd = sv.querySelector('#gd'), hl = sv.querySelector('#hl');
  const sur = v => { if (v >= .5) return 'plus d\\'une chance sur deux'; const n = Math.round(1 / v); return n <= 1 ? '' : \`1 chance sur \${n.toLocaleString('fr-FR')}\`; };
  const cache = () => { box.classList.remove('hov'); sv.querySelectorAll('.on').forEach(e => e.classList.remove('on')); gd.setAttribute('visibility', 'hidden'); hl.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  const montre = (p, ev) => {
    const c = p.c, cc = teinte(c), kc = \`var(\${CV[p.k]})\`;
    box.classList.add('hov'); sv.querySelectorAll('[data-n]').forEach(e => e.classList.toggle('on', e.dataset.n === c.n));
    gd.setAttribute('x1', p.x); gd.setAttribute('x2', p.x); gd.setAttribute('y1', p.y + 9); gd.setAttribute('visibility', 'visible');
    hl.setAttribute('cx', p.x); hl.setAttribute('cy', p.y); hl.setAttribute('stroke', cc); hl.setAttribute('visibility', 'visible');
    tip.innerHTML = \`<div class="tt"><i style="background:\${cc}"></i>\${c.n}<em class="cp" style="background:\${kc}">\${CK[p.k]}</em></div>\`
      + \`<div class="ts">\${nomNat(c.c)} · \${p.rang === 1 ? \`favori de la \${CN[p.k]}\` : \`\${p.rang}<sup>e</sup> favori de la \${CN[p.k]}\`}</div>\`
      + \`<div class="tg"><span class="tl">Titre</span><b style="color:\${cc}">\${pcs(c.p[5])}</b><span class="tsur">\${sur(c.p[5])}</span></div>\`
      + \`<div class="tpar">Le parcours</div>\`
      + [0, 1, 2, 3, 4].map(i => \`<div class="r"><span>\${TOURS[i]}</span><u><s style="width:\${c.p[i] * 100}%;background:\${kc}"></s></u><b>\${pcs(c.p[i])}</b></div>\`).join('')
      + \`<div class="tf">Bilan en phase de ligue : \${c.v.join('-')} · top 8 : \${pcs(c.top8)}</div>\`;
    tip.hidden = false;
    const R = box.getBoundingClientRect(), k = R.width / W, px0 = p.x * k, py0 = p.y * k, tw = tip.offsetWidth, th = tip.offsetHeight;
    let px = px0 + 18, py = py0 - th / 2;
    if (px + tw > R.width) px = px0 - tw - 18;
    tip.style.left = Math.max(0, px) + 'px'; tip.style.top = Math.min(Math.max(0, py), R.height - th) + 'px'; };
  const proche = ev => { const R = sv.getBoundingClientRect(), mx = (ev.clientX - R.left) * W / R.width, my = (ev.clientY - R.top) * H / R.height;
    let best = null, bd = 16; for (const p of tous) { const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = p; } } return best; };
  sv.addEventListener('mousemove', ev => { const p = proche(ev); p ? montre(p, ev) : cache(); });
  sv.addEventListener('click', ev => { const p = proche(ev); p ? montre(p, ev) : cache(); });
  sv.addEventListener('mouseleave', cache);
}
/* bloc 3 : l'évolution, semaine après semaine (archive tenue par le robot depuis le 14/11/2026) :
   chance de titre de chaque club à la fin de chaque semaine européenne, jusqu'à la finale */
let KE = 0;
function evolution() {
  boutons('compE', KE, false, k => { KE = k; if (NE && !DATA.comp[k].some(c => c.c === NE)) NE = ''; evolution(); });
  nations('natE', NE, DATA.comp[KE], v => { NE = v; evolution(); });
  const E = DATA.evo, box = document.getElementById('ev'), W = box.clientWidth, mob = W < 560, H = mob ? 280 : 330, l = 34, r = mob ? 96 : 150, t = 14, b = 30;
  const S = E.sem, fin = E.fin[KE], j = d => new Date(d + 'T12:00:00Z').getTime(), d0 = j(S[0].d), d1 = j(fin);
  const x = d => l + (j(d) - d0) / Math.max(1, d1 - d0) * (W - l - r);
  const Lc = DATA.comp[KE], derniers = S[S.length - 1].t;
  const vis = NE ? Lc.filter(c => c.c === NE).slice(0, 8) : [...Lc.slice(0, mob ? 5 : 6), ...Lc.slice(mob ? 5 : 6).filter(c => c.c === 'FRA' && c.p[5] >= .01)];
  const mx = Math.max(.05, ...vis.flatMap(c => S.map(w => w.t[c.n] || 0))), top = Math.ceil(mx * 1.15 * 20) / 20, y = v => t + (1 - v / top) * (H - t - b);
  let s = \`<svg viewBox="0 0 \${W} \${H}">\`;
  for (let v = 0; v <= top + 1e-9; v += top > .3 ? .1 : .05) s += \`<line x1="\${l}" x2="\${W - r}" y1="\${y(v)}" y2="\${y(v)}" stroke="var(--rule-soft)"/><text x="\${l - 6}" y="\${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">\${Math.round(v * 100)}\${v === 0 ? '' : ' %'}</text>\`;
  /* mois sur l'axe, et la date de la finale */
  const M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  for (let a = new Date(d0), n = 0; a.getTime() <= d1 && n < 14; n++) { a = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + (n ? 1 : 0), 1));
    if (a.getTime() < d0) continue; const xi = x(a.toISOString().slice(0, 10)); if (xi > W - r - 20) break;
    s += \`<line x1="\${xi}" x2="\${xi}" y1="\${t}" y2="\${H - b}" stroke="var(--rule-soft)" stroke-dasharray="2 3"/><text x="\${xi + 4}" y="\${H - 10}" font-size="11" fill="var(--ink-3)">\${M[a.getUTCMonth()]}</text>\`; }
  s += \`<text x="\${x(fin)}" y="\${H - 10}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink-2)">finale</text><line x1="\${x(fin)}" x2="\${x(fin)}" y1="\${t}" y2="\${H - b}" stroke="var(--ink-3)" stroke-width="1"/>\`;
  const xd = x(S[S.length - 1].d);
  s += \`<rect x="\${xd}" y="\${t}" width="\${Math.max(0, x(fin) - xd)}" height="\${H - t - b}" fill="var(--surface-2)" opacity=".6"/><text x="\${(xd + x(fin)) / 2}" y="\${t + 16}" text-anchor="middle" font-size="11" fill="var(--ink-3)">à venir</text>\`;
  const lab = [];
  for (const c of [...vis].reverse()) { const tc = teinte(c), fr = c.c === 'FRA', P = S.map(w => [x(w.d), y(w.t[c.n] || 0), w]);
    if (P.length > 1) s += \`<polyline fill="none" points="\${P.map(q => q[0] + ',' + q[1]).join(' ')}" stroke="\${tc}" stroke-width="\${fr ? 2.6 : 1.8}" stroke-linejoin="round"/>\`;
    s += P.map(([px, py, w]) => \`<circle cx="\${px}" cy="\${py}" r="\${P.length > 1 ? 2.6 : 4}" fill="\${tc}"><title>\${c.n} · \${pcs(w.t[c.n] || 0)} au \${w.d.split('-').reverse().slice(0, 2).join('/')}</title></circle>\`).join('');
    lab.push({ c, y: P[P.length - 1][1], v: derniers[c.n] || 0 }); }
  lab.sort((a, b) => a.y - b.y); for (let i = 1; i < lab.length; i++) lab[i].y = Math.max(lab[i].y, lab[i - 1].y + 14);
  const bas = H - b - 2; if (lab.length && lab[lab.length - 1].y > bas) { lab[lab.length - 1].y = bas; for (let i = lab.length - 2; i >= 0; i--) lab[i].y = Math.min(lab[i].y, lab[i + 1].y - 14); }
  for (const o of lab) s += \`<text class="lbs \${o.c.c === 'FRA' ? 'fr' : ''}" x="\${xd + 9}" y="\${o.y + 4}" font-size="12">\${o.c.n} <tspan font-weight="700">\${pcs(o.v)}</tspan></text>\`;
  box.innerHTML = s + '</svg>';
  document.getElementById('evn').textContent = S.length < 2 ? \`Premier point le \${S[0].d.split('-').reverse().slice(0, 2).join('/')} : un point s'ajoute après chaque semaine européenne.\` : '';
}
favoris(); evolution(); addEventListener('resize', () => { favoris(); evolution(); });
</script>` : ''}
${THEME_JS}
${ANALYTICS}
</body>
</html>
`;
  return { html, url: u, n: comp.flat().length };
}
