#!/usr/bin/env node
/* Générateur du site grotang.fr.
 *
 * Entrées   : tools/uefa/page.html  (page UEFA, reconstruite chaque matin)
 *             tools/tennis.src.html (page tennis, figée)
 *             tools/uefa/nations.json (chiffres des vignettes de l'accueil)
 * Sortie    : public/  — exactement ce que Netlify publie, sans build côté Netlify.
 *
 * Le site n'a volontairement aucune étape de build distante : ce script tourne ici,
 * le résultat est commité, Netlify ne fait que servir des fichiers. Un déploiement
 * ne peut donc pas échouer pour une raison de build, et le diff Git montre
 * littéralement ce qui change sur le site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS } from './chrome.mjs';
import { buildIndex } from './index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'public');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); return s.length; };

/* ---------- 1 · page UEFA ---------- */
/* page.html est écrite pour l'hébergement d'artefact Claude, qui fournit lui-même
   <!doctype>/<head>/<body>. Ici on doit produire un document complet : on scinde
   sur la fin du bloc <style>, ce qui sépare proprement l'en-tête du corps. */
function buildUefa() {
  const src = read('tools/uefa/page.html');
  const cut = src.indexOf('</style>');
  if (cut < 0) throw new Error('page.html : bloc <style> introuvable');
  const head = src.slice(0, cut + 8);
  const body = src.slice(cut + 8);
  const title = (src.match(/<title>([^<]*)<\/title>/) || [, 'Coefficient UEFA'])[1];
  const meta = JSON.parse(src.slice(src.indexOf('/*DATA_START*/') + 14, src.indexOf('/*DATA_END*/'))
    .replace(/^const D\s*=\s*/, '').replace(/;\s*$/, '')).meta;

  return { meta, html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Coefficient UEFA des associations suivi étape par étape sur la saison ${meta.season} : classement, origine des points par compétition, clubs engagés, projections.">
${FAVICON}
${THEME_BOOT}
${head}
<style>${navCSS}
.gnav{margin-bottom:0}
body{margin:0}</style>
</head>
<body>
${nav('uefa')}
${body.replace(/<\/body>\s*<\/html>\s*$/i, '')}
${THEME_JS}
</body>
</html>` };
}

/* ---------- 2 · page tennis ---------- */
/* Page reprise telle quelle depuis grotang.fr (octets identiques à la version en
   ligne, vérifiés par empreinte). On n'ajoute que l'en-tête de navigation et les
   métadonnées manquantes — aucune donnée n'est touchée. */
function buildTennis() {
  const src = read('tools/tennis.src.html');
  let out = src.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Nombre de joueurs français au tableau principal de chaque Grand Chelem, simple messieurs, ère Open 1968-2026.">
${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', `${TOKENS}
${navCSS}
body{padding-top:0}
.gnav{margin:-20px -20px 18px}
</style>`);
  out = out.replace('<body>\n', `<body>\n${nav('tennis')}\n`);
  out = out.replace('</body>', `${THEME_JS}\n</body>`);
  if (!out.includes('gnav')) throw new Error('tennis : injection de la navigation ratée');

  /* chiffres pour la vignette d'accueil, lus dans la source — pas ressaisis */
  const dat = src.slice(src.indexOf('const D = {'), src.indexOf('};', src.indexOf('const D = {')) + 2);
  const rows = [...dat.matchAll(/(\d{4}):\{AO:([^,]+), *RG:([^,]+), *WIM:([^,]+), *USO:([^}]+)\}/g)]
    .map(m => ({ y: +m[1], v: m.slice(2, 6).map(x => x.trim()).map(x => /^\d+$/.test(x) ? +x : null) }));
  if (rows.length < 55) throw new Error('tennis : lecture des données incomplète (' + rows.length + ' lignes)');
  const full = rows.filter(r => r.v.every(v => v !== null)).map(r => ({ y: r.y, t: r.v.reduce((a, b) => a + b, 0) }));
  const peak = full.reduce((a, b) => b.t > a.t ? b : a);
  const last = full[full.length - 1];
  const spark = full.slice(-24);
  return {
    html: out,
    stats: {
      editions: rows.length, peakVal: peak.t, peakYear: peak.y, lastVal: last.t, lastYear: last.y,
      spark: spark.map(s => s.t), sparkFrom: spark[0].y, sparkTo: spark[spark.length - 1].y,
      sparkHi: spark.findIndex(s => s.y === peak.y),
    },
  };
}

/* ---------- 3 · accueil ---------- */
function uefaStats(meta) {
  const N = JSON.parse(read('tools/uefa/nations.json'));
  const fr = N.find(n => n.c === 'FRA');
  if (!fr) throw new Error('nations.json : France absente');
  const endY = +String(meta.season).slice(0, 4);           // 2026 pour « 2026/2027 »
  const yrs = fr.y.map((_, i) => endY - (fr.y.length - 1 - i));
  return {
    rank: fr.r, total: fr.t, season: fr.y[fr.y.length - 1],
    spark: fr.y, sparkFrom: `${yrs[0]}/${String(yrs[0] + 1).slice(2)}`,
    sparkTo: `${yrs[yrs.length - 1]}/${String(yrs[yrs.length - 1] + 1).slice(2)}`,
    lastUpdated: meta.lastUpdated,
  };
}

/* ---------- 4 · fichiers annexes ---------- */
const ROBOTS = `User-agent: *
Allow: /

Sitemap: https://grotang.fr/sitemap.xml
`;

const sitemap = d => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/uefa/', '/tennis/'].map(u => `  <url><loc>https://grotang.fr${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`;

const NOTFOUND = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page introuvable — grotang.fr</title>${FAVICON}
<style>:root{color-scheme:light;--bg:#EBEEF3;--ink:#0F141D;--ink3:#78828F;--hi:#2a78d6}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0A0D13;--ink:#E8ECF3;--ink3:#727D8C;--hi:#5D9BF0}}
body{margin:0;min-height:100vh;display:grid;place-content:center;text-align:center;gap:6px;
background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:24px}
h1{font-size:56px;margin:0;font-weight:700;letter-spacing:-.03em}
p{margin:0;color:var(--ink3)}
a{color:var(--hi);font-weight:600;margin-top:14px;display:inline-block}</style>
</head><body><h1>404</h1><p>Cette page n'existe pas.</p><a href="/">Retour à l'accueil</a></body></html>`;

/* ---------- exécution ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
const uefa = buildUefa();
const tennis = buildTennis();
const today = new Date().toISOString().slice(0, 10);

const sizes = {
  'index.html': write('index.html', buildIndex({ uefa: uefaStats(uefa.meta), tennis: tennis.stats })),
  'uefa/index.html': write('uefa/index.html', uefa.html),
  'tennis/index.html': write('tennis/index.html', tennis.html),
  '404.html': write('404.html', NOTFOUND),
  'robots.txt': write('robots.txt', ROBOTS),
  'sitemap.xml': write('sitemap.xml', sitemap(today)),
};

for (const [f, n] of Object.entries(sizes)) console.log(String(n).padStart(7), f);
console.log('saison', uefa.meta.season, '· source arrêtée au', uefa.meta.lastUpdated);
