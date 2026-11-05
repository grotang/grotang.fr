/* Fabrication de la page FC Nantes : tools/nantes/page.html + les saisons lues
 * dans le Sheet (tools/nantes/source.mjs), plus le chrome commun du site.
 * Appelé par tools/build.mjs, sur le modèle de la page « Joueurs décisifs ». */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF } from '../chrome.mjs';
import { abs, DOMAINE } from '../site.mjs';
import { charge, PHOTO } from './source.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const KEY = 'nantes';

export async function buildNantes({ apercu = null } = {}) {
  const ICI_URL = apercu ? DOMAINE + apercu : abs(KEY);
  const { saisons, source } = await charge();
  let photo = null;
  if (source === 'photo') try {
    photo = execFileSync('git', ['log', '-1', '--format=%cs', '--', PHOTO], { cwd: ICI, encoding: 'utf8' }).trim().split('-').reverse().join('/') || null;
  } catch { /* hors git */ }

  const brut = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
  const RE = /\/\*DATA_START\*\/[^]*?\/\*DATA_END\*\//;
  if (!RE.test(brut)) throw new Error('FC Nantes : sentinelles DATA introuvables');

  const champ = saisons.filter(s => s.div === 1 && s.rang === 1).length;
  const cdf = saisons.filter(s => s.coupes.cdf === 'V').length;
  const titre = 'Le FC Nantes, saison par saison : classements, coupes, Europe, buteurs, entraîneurs';
  const desc = `${saisons.length} saisons du FC Nantes, de ${saisons[0].label} à ${saisons.at(-1).label} : rang en D1 et en D2, ${champ} titres de champion, ${cdf} Coupes de France, parcours européens, meilleurs buteurs et entraîneurs.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: abs(KEY),
    inLanguage: 'fr', isAccessibleForFree: true, temporalCoverage: `${saisons[0].an - 1}/${saisons.at(-1).an}`,
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['FC Nantes', 'histoire du FC Nantes', 'palmarès FC Nantes', 'Canaris', 'Ligue 1'],
  });

  let out = brut.replace(RE, () => `/*DATA_START*/const FCN = ${JSON.stringify({ saisons, source, photo })};/*DATA_END*/`);
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
${apercu ? '' : `<script type="application/ld+json">${jsonld}</script>\n`}${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', () => `${TOKENS}
${navCSS}
.gnav{margin:0}
</style>`);
  out = out.replace('<body>\n', () => `<body>\n${nav(KEY)}\n`);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (apercu) {
    const BANDEAU = `<div class="wip" role="note"><span class="k">Preview · travail en cours</span><span>Page en construction, bloc par bloc.</span><a href="${abs(KEY)}">← Retour</a></div>`;
    out = out.replace('<main class="wrap fcn">', () => '<main class="wrap fcn">\n' + BANDEAU);
    out = out.replace('</style>', () => `.wip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:16px;padding:8px 14px;border:1px dashed var(--ink-3);border-radius:10px;font-size:13px;color:var(--ink-2);background:var(--surface)}
.wip .k{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:var(--n4);color:#0F141D;border-radius:999px;padding:2px 8px;font-size:10.5px}
.wip a{margin-left:auto;font-weight:700}
</style>`);
  }
  if (!out.includes('gnav') || !out.includes('const FCN = {"saisons"') || !out.includes('rel="canonical"')) throw new Error('FC Nantes : injection ratée');
  return { html: out, source };
}
