/* PAGE CACHÉE : où finiront les clubs en phase de ligue ? (la France par défaut)
 *   /football-clubs-francais-phase-de-ligue/ (registre : CACHEES.clubsFR)
 *
 * Hors menu, hors sitemap, noindex ; un seul lien y mène : la pastille « Ligue »
 * du bloc 2 de la page UEFA, les semaines de phase de ligue (décision de GT,
 * 05/11/2026). Pourquoi si discret : le modèle est « à la nation », pas « au
 * club ». La force d'un club est celle de sa nation (± son rang dans le
 * contingent), et seul compte le V/N/D : perdre 9-1 ou 1-0, c'est pareil pour
 * lui. Ça donne une tendance, pas un pronostic à afficher.
 *
 * Forme retenue par GT (maquette B, 05/11) : pour chaque club, sa fourchette de
 * rang final — médiane, une chance sur deux, neuf chances sur dix — sur le fond
 * des trois zones (8es directs, barrages, éliminé). Sélecteur de nation.
 *
 * Les chiffres viennent de la projection du robot (projette.mjs → PRJ.clubs dans
 * page.html : [nom, nation, compétition, points attendus, rangs à 10/25/50/75/90 %,
 * part top 8, barrages, éliminé]) ; le bilan, du relevé de la source (D.eff). La
 * page est fabriquée à chaque build : elle suit la projection sans rien faire
 * tourner de plus. Après la dernière journée (27/01/2027), elle montre le
 * classement final et ne va pas plus loin : rien sur la phase finale tant que le
 * modèle n'est pas au club.
 */
import { nav, navCSS, FAVICON, FONTS, TOKENS, THEME_BOOT, THEME_JS, ANALYTICS } from '../chrome.mjs';
import { CACHEES, DOMAINE } from '../site.mjs';

const entre = (src, a, b) => { const i = src.indexOf(a); if (i < 0) return null; const j = src.indexOf(b, i + a.length); return j < 0 ? null : src.slice(i + a.length, j); };
const objet = (src, nom) => { const m = new RegExp(`const ${nom} = (\\{[^\\n]*?\\});`).exec(src); return m ? Function(`return (${m[1]});`)() : {}; };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function buildClubsFR(src) {
  const D = JSON.parse(entre(src, '/*DATA_START*/', '/*DATA_END*/').replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
  const P = JSON.parse(entre(src, '/*PRJ_START*/', '/*PRJ_END*/').replace(/^const PRJ\s*=\s*/, '').replace(/;\s*$/, ''));
  const NOMCLUB = JSON.parse(entre(src, '/*NOMS_START*/const NOMCLUB = ', ';/*NOMS_END*/') || '{}');
  const FRNAME = objet(src, 'FRNAME'), COURT = objet(src, 'CLUB_COURT');
  const nom = n => { const f = NOMCLUB[n] || n; return COURT[f] || f; };
  const pts = {}; for (const L of Object.values(D.eff || {})) for (const r of L) pts[r[0]] = [r[7], r[8], r[9]];
  /* [nom affiché, nation, compétition, pts attendus, q10, q25, q50, q75, q90, top 8, barrages, éliminé, V, N, D] */
  const clubs = (P.clubs || []).map(c => [nom(c[0]), ...c.slice(1), ...(pts[c[0]] || [0, 0, 0])]);
  const avec = new Set(clubs.map(c => c[1]));
  const nations = (D.nations || []).filter(n => avec.has(n.c)).map(n => [n.c, FRNAME[n.c] || n.c]);   // ordre du classement UEFA
  const u = CACHEES.clubsFR;
  const DATA = JSON.stringify({ clubs, nations });

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
.lede{color:var(--ink-2);margin:0 0 6px;max-width:76ch}
.maj{font:12px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink-3);margin-bottom:18px}
.pan{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:clamp(14px,2.2vw,22px)}
.selr{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap;margin-bottom:18px}
.selr .lb{font:700 11px Carlito,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.chips{display:flex;gap:4px;flex-wrap:wrap}
.chips button{font:600 13px Carlito,sans-serif;padding:5px 11px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);cursor:pointer}
.chips button[aria-pressed="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.selr select{font:600 13px Carlito,sans-serif;padding:5px 8px;border:1px solid var(--rule);border-radius:4px;background:var(--surface);color:var(--ink)}
.bk{margin-bottom:20px}.bk:last-child{margin-bottom:0}
.bkt{font-weight:700;font-size:15px;margin-bottom:6px;display:flex;align-items:center}
.kb{font:700 10.5px Carlito,sans-serif;color:#fff;border-radius:999px;padding:1px 8px;margin-right:8px}
:root[data-theme="dark"] .kb{color:#0B0F14}
.row{display:grid;grid-template-columns:190px 1fr 48px;align-items:center;column-gap:12px}
.ax{height:18px}.ax .tr{position:relative;height:100%}.ax b{position:absolute;top:0;transform:translateX(-50%);font:10px 'IBM Plex Mono',ui-monospace,monospace;color:var(--ink-3)}
.cl{min-height:44px;padding:4px 0}
.nm b{font-size:15px}.nm small{color:var(--ink-3);margin-left:4px}
.nm .z{display:block;font-size:11.5px;color:var(--ink-3)}.nm .z .g{color:var(--good)}.nm .z .r{color:var(--bad)}
.tr{position:relative;display:grid;grid-template-columns:8fr 16fr 12fr;height:26px;border-radius:3px;overflow:hidden}
.ax .tr{display:block;overflow:visible}
.z8{background:color-mix(in srgb,var(--good) 14%,var(--surface))}.zb{background:var(--surface-2)}.ze{background:color-mix(in srgb,var(--bad) 11%,var(--surface))}
.tr i{position:absolute;top:50%;transform:translateY(-50%)}
.tr i.w{height:2px;background:var(--ink-3)}.tr i.b{height:12px;border-radius:2px;opacity:.9}
.tr i.d{width:4px;height:20px;background:var(--ink);border-radius:2px;margin-left:-2px}
.md{font:700 15px 'IBM Plex Mono',ui-monospace,monospace;text-align:right}
.vide{color:var(--ink-3)}
.leg{font-size:12.5px;color:var(--ink-2);margin:0 0 14px;display:flex;gap:6px 18px;flex-wrap:wrap;align-items:center}
.leg i{display:inline-block;vertical-align:middle;margin-right:6px}
.leg .d{width:4px;height:14px;background:var(--ink);border-radius:2px}.leg .b{width:22px;height:10px;background:var(--ink-3);border-radius:2px}.leg .w{width:22px;height:2px;background:var(--ink-3)}
.note{font-size:12.5px;color:var(--ink-3);max-width:96ch;line-height:1.55;margin-top:18px}
.note a{color:var(--fr)}
@media (max-width:640px){ .row{grid-template-columns:1fr 40px} .row .nm{grid-column:1 / -1} .ax .sp{display:none} .ax{grid-template-columns:1fr 40px} .cl{min-height:0;padding:6px 0 8px} }
</style>
</head>
<body>
${nav('uefa')}
<main>
<h1>Où finiront les clubs français ?</h1>
<p class="lede">Le rang de chaque club à la fin de la phase de ligue : où il a une chance sur deux de finir, et où il en a neuf sur dix. Le fond dit ce que vaut la place : 8es directs, barrages, éliminé.</p>
<div class="maj">${(P.n || 0).toLocaleString('fr-FR')} saisons simulées · source arrêtée au ${esc(P.maj || D.meta.lastUpdated)} · mise à jour après chaque soir de match</div>
<div class="pan">
  <div class="selr"><span class="lb">Nation</span><span class="chips" id="chips"></span><select id="autre" aria-label="Autre nation"></select></div>
  <p class="leg"><span><i class="d"></i>rang médian</span><span><i class="b"></i>une chance sur deux</span><span><i class="w"></i>neuf chances sur dix</span></p>
  <div id="vue"></div>
</div>
<p class="note">Une tendance, pas un pronostic. Le modèle donne à chaque club la force de sa nation (au coefficient à cinq ans), un peu plus ou un peu moins selon son rang dans le contingent, et ne retient que les victoires, nuls et défaites : un 9-1 et un 1-0 pèsent pareil. Les égalités de points sont départagées par cette force, pas par la différence de buts comme dans le vrai classement. Méthode complète : <a href="/football-coefficient-uefa/#projection">la projection du coefficient UEFA</a>.</p>
</main>
<script>
(function(){
  const { clubs, nations } = ${DATA};
  const KN = ['Ligue des Champions', 'Ligue Europa', 'Ligue Conférence'], KV = ['--c1', '--c3', '--c4'], KS = ['C1', 'C3', 'C4'];
  const nomN = Object.fromEntries(nations);
  const TOP = nations.slice(0, 8).map(n => n[0]);
  if (!TOP.includes('FRA') && nomN.FRA) TOP.unshift('FRA');
  const pc = v => (v >= 0.995 ? '>\\u202f99' : v < 0.005 && v > 0 ? '<\\u202f1' : Math.round(v * 100)) + '\\u202f%';
  const x = r => ((r - .5) / 36 * 100).toFixed(2) + '%';
  const lire = () => { const h = decodeURIComponent(location.hash.slice(1)).toUpperCase(); return nomN[h] ? h : 'FRA'; };
  let nat = lire();
  const chips = document.getElementById('chips'), autre = document.getElementById('autre'), vue = document.getElementById('vue');
  chips.innerHTML = TOP.map(c => '<button type="button" data-n="' + c + '">' + nomN[c] + '</button>').join('');
  autre.innerHTML = '<option value="">Autre nation…</option>' + nations.filter(n => !TOP.includes(n[0])).map(n => n[1]).slice()
    .sort((a, b) => a.localeCompare(b, 'fr')).map(nm => '<option value="' + nations.find(n => n[1] === nm)[0] + '">' + nm + '</option>').join('');
  const axe = '<div class="row ax"><span class="sp"></span><span class="tr">' + [1, 8, 24, 36].map(r => '<b style="left:' + x(r) + '">' + r + '</b>').join('') + '</span><span class="sp"></span></div>';
  function dessine(){
    chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === nat));
    autre.value = TOP.includes(nat) ? '' : nat;
    const L = clubs.filter(c => c[1] === nat);
    vue.innerHTML = !L.length ? '<p class="vide">Aucun club de cette nation en phase de ligue.</p>' : [0, 1, 2].map(k => {
      const M = L.filter(c => c[2] === k).sort((a, b) => a[6] - b[6] || b[3] - a[3]);
      if (!M.length) return '';
      return '<div class="bk"><div class="bkt"><span class="kb" style="background:var(' + KV[k] + ')">' + KS[k] + '</span>' + KN[k] + '</div>' + axe
        + M.map(c => { const p = 3 * c[12] + c[13];
          return '<div class="row cl"><span class="nm"><b>' + c[0] + '</b><small>' + c[12] + 'V ' + c[13] + 'N ' + c[14] + 'D · ' + p + ' pt' + (p > 1 ? 's' : '') + '</small>'
            + '<span class="z"><span class="g">8es ' + pc(c[9]) + '</span> · barrages ' + pc(c[10]) + ' · <span class="r">éliminé ' + pc(c[11]) + '</span></span></span>'
            + '<span class="tr" role="img" aria-label="' + c[0] + ' : rang médian ' + c[6] + ', une chance sur deux entre ' + c[5] + ' et ' + c[7] + ', neuf sur dix entre ' + c[4] + ' et ' + c[8] + '">'
            + '<span class="z8"></span><span class="zb"></span><span class="ze"></span>'
            + '<i class="w" style="left:' + x(c[4]) + ';right:calc(100% - ' + x(c[8]) + ')"></i>'
            + '<i class="b" style="left:' + x(c[5]) + ';right:calc(100% - ' + x(c[7]) + ');background:var(' + KV[k] + ')"></i>'
            + '<i class="d" style="left:' + x(c[6]) + '"></i></span>'
            + '<span class="md">' + c[6] + '<sup>' + (c[6] > 1 ? 'e' : 'er') + '</sup></span></div>'; }).join('') + '</div>'; }).join('');
    document.querySelector('h1').textContent = nat === 'FRA' ? 'Où finiront les clubs français ?' : 'Où finiront les clubs ? · ' + nomN[nat];
  }
  const choisir = n => { nat = n; history.replaceState(null, '', n === 'FRA' ? location.pathname : '#' + n.toLowerCase()); dessine(); };
  chips.onclick = e => { const b = e.target.closest('button'); if (b) choisir(b.dataset.n); };
  autre.onchange = () => { if (autre.value) choisir(autre.value); };
  dessine();
})();
</script>
${THEME_JS}
${ANALYTICS}
</body>
</html>
`;
  return { html, url: u, n: clubs.length };
}
