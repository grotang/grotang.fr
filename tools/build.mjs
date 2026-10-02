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
import { nav, navCSS, FAVICON, FAVICON_SVG, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF } from './chrome.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'public');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); return s.length; };

/* Écriture STABLE : si la page ne diffère de celle déjà publiée que par son
   horodatage de fabrication, on garde l'ancien horodatage et le fichier ne
   bouge pas d'un octet.

   Sans ça, l'heure de fabrication changeait à chaque passage, donc le fichier
   changeait toujours, donc le robot commitait toujours — cinq fois par jour,
   avec pour seul contenu « il est maintenant 4 h 16 ». C'est exactement ce que
   l'en-tête du workflow dit vouloir éviter : « une republication quotidienne à
   vide a été essayée puis retirée : elle ne changeait qu'un horodatage et
   noyait l'historique ».

   Et cette ligne était aussi la seule source de conflits git : elle diffère
   toujours entre deux fabrications, donc entre le dépôt d'une correction et la
   republication du robot. Stabilisée, elle ne se dispute plus avec personne.

   L'horodatage garde tout son sens : il dit quand la page a change pour la
   derniere fois, ce qui est plus utile que l'heure du dernier passage a vide. */
const PUB_RE = /window\.PUBLIE = "[^"]*"/;
/* `avant` est passé en argument et non relu ici : public/ est entièrement
   effacé au début de la fabrication, donc à l'instant où l'on écrit il n'y a
   plus rien à comparer sur le disque. C'est ce détail qui avait fait échouer
   la première version, silencieusement. */
const writeStable = (p, s, avant) => {
  if (avant && PUB_RE.test(avant) && PUB_RE.test(s)
      && avant.replace(PUB_RE, '') === s.replace(PUB_RE, '')) s = avant;
  return write(p, s);
};

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

  /* Horodatage de PUBLICATION, distinct de meta.built.
     meta.built dit quand les DONNÉES ont été relues à la source : il ne bouge pas
     tant que la source ne bouge pas, et reste donc figé pendant une semaine creuse.
     Celui-ci dit quand CETTE PAGE a été fabriquée — il bouge à chaque changement,
     y compris quand seuls le texte ou la mise en page changent. Les deux répondent
     à deux questions différentes : « les chiffres datent de quand ? » et « la page
     que je lis date de quand ? ».
     Heure de Paris, parce que la page s'adresse à des lecteurs français. */
  const now = new Date();
  const part = o => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(now);
  /* Même forme que la ligne du dessus, séparateur compris : deux lignes de tampon
     côte à côte avec deux ponctuations différentes, ça se voit tout de suite. */
  const publie = `${part({ weekday: 'short' })} ${part({ day: '2-digit' })} `
    + `${part({ month: 'short' })} ${part({ year: 'numeric' })} `
    + part({ hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

  /* ---------- référencement ----------
     Le titre AFFICHÉ en tête de page reste « L'observatoire du coefficient
     UEFA » : c'est le nom du site. Le titre que lisent les moteurs, lui, doit
     répondre mot pour mot à la requête qu'on vise — « coefficient UEFA » — et
     porter la saison, parce que c'est la première chose qu'un lecteur cherche
     à vérifier. D'où deux titres différents, et celui-ci écrase celui de
     page.html. La saison vient des données : elle se met à jour toute seule.

     On ne battra jamais uefa.com sur le terme seul. Ce qui se gagne, c'est la
     traîne : « coefficient UEFA France », « classement coefficient UEFA
     2026/2027 », « course à la 5e place ». D'où une description qui les
     contient sans les empiler. */
  const seo = {
    titre: `Coefficient UEFA ${meta.season} — classement des 55 associations`,
    desc: `Coefficient UEFA ${meta.season} : classement des 55 associations, mis à jour chaque matin. D'où viennent les points, et où en est la France dans la course à la 5e place.`,
    url: 'https://grotang.fr/uefa/',
  };
  /* dateModified au format ISO, à partir de « 17/09/2026 - 22:56 » */
  const isoMaj = (() => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(meta.lastUpdated).trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : new Date().toISOString().slice(0, 10); })();
  /* Un Dataset, parce que c'en est un : Google Dataset Search sait lire ce
     type, et il dit la vérité sur ce qu'est la page — des chiffres datés,
     gratuits, en français, couvrant cinq saisons. */
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: seo.titre, description: seo.desc, url: seo.url,
    inLanguage: 'fr', isAccessibleForFree: true,
    /* CC BY 4.0 : reprise libre des calculs et des graphes, à condition de
       citer grotang.fr. Les résultats de match sont des faits et ne sont à
       personne ; la licence ne couvre que le travail fait dessus. */
    license: 'https://creativecommons.org/licenses/by/4.0/',
    dateModified: isoMaj, temporalCoverage: '2022/2027',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['coefficient UEFA', 'classement des associations', 'indice UEFA',
               'Ligue des champions', 'places européennes', 'France'],
  });

  return { meta, html: `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${VERIF}
<title>${seo.titre}</title>
<meta name="description" content="${seo.desc}">
<link rel="canonical" href="${seo.url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${seo.titre}">
<meta property="og:description" content="${seo.desc}">
<meta property="og:url" content="${seo.url}">
<meta property="og:image" content="https://grotang.fr/uefa/carte.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Où chaque nation peut finir la saison : projection du coefficient UEFA des huit premières nations">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${seo.titre}">
<meta name="twitter:description" content="${seo.desc}">
<meta name="twitter:image" content="https://grotang.fr/uefa/carte.png">
<script type="application/ld+json">${jsonld}</script>
${FAVICON}
${THEME_BOOT}
${head.replace(/<title>[^<]*<\/title>\n?/, '')}
<script>window.PUBLIE = ${JSON.stringify(publie)};</script>
<style>${navCSS}
.gnav{margin-bottom:0}
body{margin:0}</style>
</head>
<body>
${nav('uefa')}
${body.replace(/<\/body>\s*<\/html>\s*$/i, '')}
${THEME_JS}
${ANALYTICS}
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
${VERIF}
<link rel="canonical" href="https://grotang.fr/tennis/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="Les Français en Grand Chelem, 1968-2026">
<meta property="og:description" content="Nombre de joueurs français au tableau principal de chaque Grand Chelem, simple messieurs, ère Open 1968-2026.">
<meta property="og:url" content="https://grotang.fr/tennis/">
<meta name="twitter:card" content="summary">
${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', `${TOKENS}
${navCSS}
body{padding-top:0}
.gnav{margin:-20px -20px 18px}
</style>`);
  out = out.replace('<body>\n', `<body>\n${nav('tennis')}\n`);
  out = out.replace('</body>', `${THEME_JS}\n${ANALYTICS}\n</body>`);
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

  /* Les noms français vivent dans page.html, qui doit rester un fichier autonome.
     On les relit ici plutôt que d'en garder une seconde copie : une seule source,
     donc pas de dérive possible entre l'accueil et la page. */
  const m = read('tools/uefa/page.html').match(/const FRNAME\s*=\s*(\{[^}]*\})/);
  if (!m) throw new Error('page.html : table FRNAME introuvable');
  const FRNAME = JSON.parse(m[1].replace(/([A-Z]{3}):/g, '"$1":'));
  /* « 3,77 devant Portugal » n'est pas du français. L'article dépend du genre et
     de l'initiale, deux choses qu'aucune règle ne déduit d'un code pays : on les
     écrit. Un pays absent de la table sort sans article — Chypre, Israël, Malte
     n'en prennent pas, et un oubli produit alors une phrase correcte plutôt
     qu'une faute. */
  const ART = {ENG:"l'", ITA:"l'", ESP:"l'", GER:"l'", FRA:'la ', POR:'le ', BEL:'la ',
    NED:'les ', TUR:'la ', POL:'la ', CZE:'la ', GRE:'la ', NOR:'la ', DEN:'le ',
    SUI:'la ', AUT:"l'", HUN:'la ', SCO:"l'", SWE:'la ', CRO:'la ', ROU:'la ',
    UKR:"l'", AZE:"l'", SVN:'la ', SVK:'la ', BUL:'la ', SRB:'la ', RUS:'la ',
    ISL:"l'", IRL:"l'", ARM:"l'", BIH:'la ', LVA:'la ', FIN:'la ', KAZ:'le ',
    LIE:'le ', MDA:'la ', ALB:"l'", MKD:'la ', BLR:'la ', LTU:'la ', AND:"l'",
    GIB:'', EST:"l'", NIR:"l'", GEO:'la ', LUX:'le ', MNE:'le ', WAL:'le ',
    SMR:'', CYP:'', ISR:'', MLT:'', KOS:'le ', FRO:'les '};
  const frName = c => (ART[c] ?? '') + (FRNAME[c] || c);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const by = Object.fromEntries(N.map(n => [n.r, n]));
  const ahead = by[fr.r - 1], behind = by[fr.r + 1];

  const endY = +String(meta.season).slice(0, 4);           // 2026 pour « 2026/2027 »
  const yrs = fr.y.map((_, i) => endY - (fr.y.length - 1 - i));
  return {
    rank: fr.r, total: fr.t, season: fr.y[fr.y.length - 1], nations: N.length,
    ahead:  ahead  ? { name: frName(ahead.c),  cap: cap(frName(ahead.c)),  gap: +(ahead.t - fr.t).toFixed(3) }  : null,
    behind: behind ? { name: frName(behind.c), cap: cap(frName(behind.c)), gap: +(fr.t - behind.t).toFixed(3) } : null,
    spark: fr.y,
    years: yrs.map(y => `${String(y).slice(2)}/${String(y + 1).slice(2)}`),
    lastUpdated: meta.lastUpdated,
  };
}

/* ---------- 4 · fichiers annexes ---------- */
const ROBOTS = `User-agent: *
Allow: /

Sitemap: https://grotang.fr/sitemap.xml
`;

/* Le site est publie par GitHub Pages, qui ne sait pas rediriger cote serveur :
   pas de 301 possible sur `/`. Sans fichier a la racine, l'apex repondait 404.
   Cette page minuscule est donc la redirection : `location.replace` part avant
   le premier rendu et n'empile rien dans l'historique — le bouton Retour ramene
   d'ou l'on venait, pas dans une boucle. Le `meta refresh` prend le relais si le
   script ne tourne pas, le lien si rien ne tourne. Le `canonical` dit aux moteurs
   que l'adresse qui compte est /uefa/, pour que l'autorite du domaine y aille.
   Genere par le build : `public/` est efface a chaque passage, un fichier depose
   a la main disparaitrait au rafraichissement du matin. */
const ACCUEIL = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
${VERIF}
<title>grotang.fr</title>
${FAVICON}
<link rel="canonical" href="https://grotang.fr/uefa/">
<meta http-equiv="refresh" content="0; url=/uefa/">
<script>location.replace('/uefa/');</script>
</head>
<body><p><a href="/uefa/">L'observatoire du coefficient UEFA</a></p></body>
</html>
`;

/* Une date PAR PAGE, et la vraie : celle du jour où cette page a changé pour la
   dernière fois, pas celle du dernier passage du robot.

   Avant, les deux lignes portaient « aujourd'hui ». Le fichier changeait donc à
   chaque minuit, le robot le commitait, et on retombait sur la republication à
   vide qu'on venait de supprimer de la page — même bug, deuxième fichier.

   Au passage c'est aussi plus honnête vis-à-vis des moteurs : `lastmod` est
   censé dire quand le contenu a bougé. Annoncer une modification quotidienne
   d'une page qui n'a pas bougé depuis une semaine, c'est le genre de signal
   qu'ils apprennent vite à ignorer. */
const sitemap = (dUefa, dTennis) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://grotang.fr/uefa/</loc><lastmod>${dUefa}</lastmod></url>
  <url><loc>https://grotang.fr/tennis/</loc><lastmod>${dTennis}</lastmod></url>
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
</head><body><h1>404</h1><p>Cette page n'existe pas.</p><a href="/uefa/">Coefficient UEFA</a></body></html>`;

/* ---------- exécution ---------- */
/* L'etat precedent, releve AVANT le grand menage : les deux pages, pour savoir
   si elles ont reellement change, et le sitemap, pour en reprendre les dates
   quand elles n'ont pas bouge. */
const lire = f => { try { return fs.readFileSync(path.join(OUT, f), 'utf8'); } catch { return null; } };
const PRECEDENT = lire('uefa/index.html');
const PREC_TENNIS = lire('tennis/index.html');
const PREC_SITEMAP = lire('sitemap.xml');
/* La carte de partage n'est pas fabriquee ici mais par tools/uefa/carte.mjs,
   apres la projection. Le grand menage l'effacerait a chaque construction :
   on la met de cote et on la repose telle quelle, avec sa signature. C'est ce
   qui permet a carte.mjs de ne la refaire que si son contenu a change. */
const CARTE = ['uefa/carte.png', 'uefa/carte.sig'].map(f => {
  try { return [f, fs.readFileSync(path.join(OUT, f))]; } catch { return null; } }).filter(Boolean);
fs.rmSync(OUT, { recursive: true, force: true });
const uefa = buildUefa();
const tennis = buildTennis();
const today = new Date().toISOString().slice(0, 10);

/* `lastmod` d'une page : la date du jour si son contenu a change, sinon celle
   deja inscrite dans le sitemap precedent. La comparaison de la page UEFA
   ignore son horodatage de fabrication, comme writeStable. */
const dateSitemap = (bal, avant, apres, sansHorodatage) => {
  const memeContenu = avant && (sansHorodatage
    ? avant.replace(PUB_RE, '') === apres.replace(PUB_RE, '')
    : avant === apres);
  const m = PREC_SITEMAP && PREC_SITEMAP.match(new RegExp(bal + '[^]*?<lastmod>([\\d-]{10})</lastmod>'));
  return memeContenu && m ? m[1] : today;
};
for (const [f, buf] of CARTE) { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), buf); }
const majUefa   = dateSitemap('/uefa/',   PRECEDENT,   uefa.html,   true);
const majTennis = dateSitemap('/tennis/', PREC_TENNIS, tennis.html, false);

const sizes = {
  'uefa/index.html': writeStable('uefa/index.html', uefa.html, PRECEDENT),
  'tennis/index.html': write('tennis/index.html', tennis.html),
  '404.html': write('404.html', NOTFOUND),
  'index.html': write('index.html', ACCUEIL),
  'robots.txt': write('robots.txt', ROBOTS),
  'favicon.svg': write('favicon.svg', FAVICON_SVG),
  'sitemap.xml': write('sitemap.xml', sitemap(majUefa, majTennis)),
};

for (const [f, n] of Object.entries(sizes)) console.log(String(n).padStart(7), f);
console.log('saison', uefa.meta.season, '· source arrêtée au', uefa.meta.lastUpdated);
