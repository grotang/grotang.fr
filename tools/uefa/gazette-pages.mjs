/* LES GAZETTES, UNE PAGE PAR SEMAINE (06/11/2026, demande de GT : une adresse
 * propre pour chaque gazette, pour Google et pour le partage).
 *
 *   /football-gazette-uefa/              toutes les gazettes, la plus récente d'abord
 *   /football-gazette-uefa/AAAA-MM-JJ/   la gazette d'une semaine (date du DERNIER match de
 *                                        la semaine, choix de GT le 06/11/2026)
 *
 * Le 06/11/2026, de 02:03 à 02:10 environ, les adresses ont porté la date du
 * PREMIER match. Elles ont été publiées : chacune reçoit une page relais vers
 * la bonne adresse (même mécanique que RELAIS dans site.mjs), fabriquée ici à
 * partir de `d0`, pour toujours.
 *
 * Le texte n'est PAS écrit ici : c'est le bloc 2c de la page UEFA qui l'écrit
 * (un seul exemplaire du rédacteur). tools/uefa/gazettes.mjs ouvre la page
 * construite, lit window.__gazettes() et range le résultat dans
 * tools/uefa/archive/gazettes.json, que ce module met en pages à chaque build.
 * L'adresse ne dépend que de la date : elle ne bouge pas quand le titre change
 * (un score qui arrive, un modèle recalé). Les pages sont indexées et dans le
 * sitemap ; elles ne sont pas dans le menu (on y arrive depuis le bloc 2c).
 */
import { nav, navCSS, FAVICON, FONTS, TOKENS, THEME_BOOT, THEME_JS, ANALYTICS } from '../chrome.mjs';
import { GAZETTE, DOMAINE, url } from '../site.mjs';

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function buildGazettes(json, css) {
  if (!json || !Array.isArray(json.liste) || !json.liste.length) return { pages: {}, liste: [] };
  const L = [...json.liste].sort((a, b) => a.slug < b.slug ? -1 : 1);
  const tete = (titre, desc, u, jsonld) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titre)} — grotang.fr</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${DOMAINE}${u}">
<meta property="og:type" content="article">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${DOMAINE}${u}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
${FAVICON}
${FONTS}
${THEME_BOOT}
<style>${TOKENS}
${navCSS}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:980px;margin:0 auto;padding:24px clamp(14px,3vw,28px) 60px}
.carte{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:clamp(16px,3vw,28px);margin-top:14px}
.fil{font-size:13px;color:var(--ink-3)} .fil a{color:var(--fr);font-weight:600;text-decoration:none}
.pn{display:flex;justify-content:space-between;gap:12px;margin-top:16px;font-size:14px}
.pn a{color:var(--fr);font-weight:600;text-decoration:none}
.liste{list-style:none;margin:0;padding:0}
.liste li{padding:12px 0;border-bottom:1px solid var(--rule)}
.liste .d{font:600 11px "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.liste a{display:block;font:600 20px/1.25 Newsreader,Georgia,serif;color:var(--ink);text-decoration:none;margin:2px 0 4px}
.liste p{margin:0;color:var(--ink-2);font-size:14px}
h1{font:700 clamp(26px,4vw,36px)/1.15 Newsreader,Georgia,serif;margin:6px 0 4px}
:root{--vl:var(--good);--dl:var(--bad)}
${css}
</style>
</head>
<body>
${nav('gazette')}
<main>`;
  const pied = `</main>
${THEME_JS}
${ANALYTICS}
</body>
</html>`;
  const pages = {};
  L.forEach((g, i) => {
    const u = `${GAZETTE}${g.slug}/`, av = L[i - 1], ap = L[i + 1];
    const ld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: g.titre, description: g.desc,
      datePublished: g.d1, dateModified: g.d1, inLanguage: 'fr-FR', mainEntityOfPage: DOMAINE + u,
      author: { '@type': 'Organization', name: 'grotang.fr', url: DOMAINE + '/' }, publisher: { '@type': 'Organization', name: 'grotang.fr' } };
    pages[u] = tete(`${g.titre} · ${g.per}`, g.desc, u, ld)
      + `<div class="fil"><a href="${url('uefa')}">Coefficient UEFA</a> › <a href="${GAZETTE}">La gazette</a> › ${esc(g.per)}</div>`
      + `<article class="carte gaz">${g.html.replace(/<h4 class="gtitre">([^]*?)<\/h4>/, '<h1 class="gtitre">$1</h1>')}</article>`
      + `<nav class="pn" aria-label="Autres gazettes"><span>${av ? `<a href="${GAZETTE}${av.slug}/">‹ ${esc(av.per)}</a>` : ''}</span><span>${ap ? `<a href="${GAZETTE}${ap.slug}/">${esc(ap.per)} ›</a>` : `<a href="${url('uefa')}#gazette">Suivre la saison en direct ›</a>`}</span></nav>`
      + pied;
  });
  /* relais des adresses « premier match » (voir plus haut) */
  for (const g of L) { if (!g.d0 || g.d0 === g.slug || L.some(x => x.slug === g.d0)) continue;
    const vers = `${GAZETTE}${g.slug}/`;
    pages[`${GAZETTE}${g.d0}/`] = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Page déplacée — grotang.fr</title>
<link rel="canonical" href="${DOMAINE}${vers}">
<meta http-equiv="refresh" content="0; url=${vers}">
<script>location.replace('${vers}' + location.search + location.hash);</script>
</head>
<body><a href="${vers}">${esc(g.titre)}</a></body>
</html>`; }
  const R = [...L].reverse();
  pages[GAZETTE] = tete('La gazette du coefficient UEFA', `Chaque semaine européenne, le bilan de la France au coefficient UEFA : points pris, écart avec ses poursuivants, projection de fin de saison et faits marquants.`, GAZETTE)
    + `<div class="fil"><a href="${url('uefa')}">Coefficient UEFA</a> › La gazette</div><div class="carte"><h1>La gazette du coefficient UEFA</h1>`
    + `<p style="color:var(--ink-2);margin:0 0 10px">Chaque semaine européenne, écrite automatiquement à partir des données du site : la course de la France, ce que le modèle attendait, ce qui a compté.</p>`
    + `<ul class="liste">${R.map(g => `<li><div class="d">${esc(g.per)}</div><a href="${GAZETTE}${g.slug}/">${esc(g.titre)}</a><p>${esc(g.desc)}</p></li>`).join('')}</ul></div>` + pied;
  return { pages, liste: L };
}
