/* Fabrication de la page « Joueurs décisifs » : tools/joueurs/page.html + tools/joueurs/data.json,
 * plus le chrome commun du site (navigation, thème, polices, mesure d'audience).
 * data.json sort du pipeline du modèle (transfermarkt-datasets → script R) : saisons closes,
 * il ne bouge que quand on relance le modèle. Appelé par tools/build.mjs, sur le modèle
 * de la page économie. Les contrôles ci-dessous sont bloquants : une donnée bancale ne
 * part pas en ligne. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF } from '../chrome.mjs';
import { abs, DOMAINE } from '../site.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const KEY = 'joueurs';

function controle(D) {
  const err = m => { throw new Error('joueurs décisifs : ' + m); };
  const cles = Object.keys(D.saisons || {});
  if (cles.length < 3) err('moins de 3 saisons (' + cles.join(' ') + ')');
  for (const k of cles) {
    const S = D.saisons[k];
    if (!/^\d{4}$/.test(k) || S.label !== `${+k - 1}-${k.slice(2)}`) err(`libellé de saison incohérent (${k} / ${S.label})`);
    if (!Array.isArray(S.rows) || S.rows.length !== 100) err(`saison ${S.label} : ${S.rows?.length} lignes au lieu de 100`);
    if (!(S.classes > 1000) || !(S.actions > 10000) || !(S.moyPlie > 0 && S.moyPlie < 50)) err(`saison ${S.label} : totaux invraisemblables`);
    let prec = Infinity;
    S.rows.forEach((d, i) => {
      if (d.length !== 20) err(`saison ${S.label}, ligne ${i + 1} : ${d.length} colonnes`);
      if (d[0] !== i + 1) err(`saison ${S.label} : rang ${d[0]} à la position ${i + 1}`);
      if (!d[2] || !d[4] || !d[5]) err(`saison ${S.label}, rang ${d[0]} : nom, club ou championnat manquant`);
      for (const j of [1, 6, 7, 8, 9, 18, 19]) if (!Number.isInteger(d[j]) || d[j] < 0) err(`saison ${S.label}, ${d[2]} : compteur ${j} invalide`);
      if (d[7] > d[6]) err(`saison ${S.label}, ${d[2]} : plus de penalties que de buts`);
      if (d[19] > d[18]) err(`saison ${S.label}, ${d[2]} : n_menant_2 > n_buts_passes`);
      const s = d.slice(10, 18).reduce((a, b) => a + b, 0);
      if (![10, 11, 12, 13, 14, 15, 16, 17].every(j => Number.isFinite(d[j]) && d[j] >= 0)) err(`saison ${S.label}, ${d[2]} : score par famille invalide`);
      if (s > prec + 0.05) err(`saison ${S.label} : classement non trié au rang ${d[0]} (${d[2]})`);
      prec = s;
    });
  }
}

export function buildJoueurs({ apercu = null } = {}) {
  /* apercu : adresse de la préversion (travail en cours) → noindex, bandeau, canonique sur elle-même */
  const ICI_URL = apercu ? DOMAINE + apercu : abs(KEY);
  const D = JSON.parse(fs.readFileSync(path.join(ICI, 'data.json'), 'utf8'));
  controle(D);
  const brut = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
  const RE = /\/\*DATA_START\*\/[^]*?\/\*DATA_END\*\//;
  if (!RE.test(brut)) throw new Error('joueurs décisifs : sentinelles DATA introuvables');

  const cles = Object.keys(D.saisons).sort(), der = D.saisons[cles[cles.length - 1]];
  const n1 = der.rows[0][2];
  const titre = `Les joueurs les plus décisifs du football, saison par saison`;
  const desc = `Qui a vraiment fait gagner son équipe ? Chaque but et chaque passe décisive repesés selon le score du moment, la compétition et le tour, club et sélection confondus. En ${der.label}, n° 1 : ${n1}. Comparé au simple comptage buts + passes.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: abs(KEY),
    inLanguage: 'fr', isAccessibleForFree: true, temporalCoverage: `${cles[0] - 1}/${cles[cles.length - 1]}`,
    copyrightHolder: { '@type': 'Person', name: 'Tanguy Drouin' },
    isBasedOn: 'https://github.com/dcaribou/transfermarkt-datasets',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['joueur le plus décisif', 'buts décisifs', 'passes décisives', 'classement buteurs', 'football', 'Ligue des champions'],
  });

  const jsonldFinal = apercu ? '' : `<script type="application/ld+json">${jsonld}</script>\n`;
  let out = brut.replace(RE, () => `/*DATA_START*/const JD = ${JSON.stringify({ saisons: D.saisons })};/*DATA_END*/`);
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`);
  out = out.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    () => `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${desc}">
${VERIF}
<link rel="canonical" href="${ICI_URL}">
<meta name="robots" content="${apercu ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${titre}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${ICI_URL}">
<meta name="twitter:card" content="summary">
${jsonldFinal}${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', () => `${TOKENS}
${navCSS}
.gnav{margin:0}
</style>`);
  out = out.replace('<body>\n', () => `<body>\n${nav(KEY)}\n`);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (apercu) {
    const BANDEAU = `<div class="wip" role="note"><span class="k">Preview · travail en cours</span><span>Il manque encore la Coupe de France, la Ligue des nations, les qualifications et les amicaux, ainsi que les saisons 2025-26 et 2026-27. Les classements vont bouger.</span><a href="${abs(KEY)}">← Retour</a></div>`;
    out = out.replace('<main class="wrap jd">', () => '<main class="wrap jd">\n' + BANDEAU);
    out = out.replace('</style>', () => `.wip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:16px;padding:8px 14px;border:1px dashed var(--ink-3);border-radius:10px;font-size:13px;color:var(--ink-2);background:var(--surface)}
.wip .k{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:var(--n4);color:#0F141D;border-radius:999px;padding:2px 8px;font-size:10.5px}
.wip a{margin-left:auto;font-weight:700}
</style>`);
    if (!out.includes('class="wip"') || !out.includes('noindex')) throw new Error('joueurs décisifs : bandeau aperçu non injecté');
  }
  if (!out.includes('gnav') || !out.includes('const JD = {"saisons"') || !out.includes('rel="canonical"')) throw new Error('joueurs décisifs : injection ratée');
  return { html: out };
}
