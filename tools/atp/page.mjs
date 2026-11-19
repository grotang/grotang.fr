/* Fabrication des pages « Saison ATP » : tools/atp/page.html + tools/atp/data-AAAA.json
 * (écrit chaque lundi par tools/atp/refresh.mjs), plus le chrome commun du site.
 * Appelé par tools/build.mjs, une fois par saison, sur le modèle de la page FC Nantes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF, PIED } from '../chrome.mjs';
import { abs, DOMAINE } from '../site.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const SAISONS = [2026, 2027];
export const cle = an => 'atp' + an;
export const fichierData = an => path.join(ICI, `data-${an}.json`);

export function buildSaisonATP(an, { apercu = null } = {}) {
  const KEY = cle(an);
  const ICI_URL = apercu ? DOMAINE + apercu : abs(KEY);
  const data = JSON.parse(fs.readFileSync(fichierData(an), 'utf8'));
  const brut = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
  const RE = /\/\*DATA_START\*\/[^]*?\/\*DATA_END\*\//;
  if (!RE.test(brut)) throw new Error('Saison ATP : sentinelles DATA introuvables');

  const titre = `Saison ATP ${an} : le classement de la saison semaine par semaine, et la Race to Turin`;
  const desc = `La saison ATP ${an} semaine après semaine : tous les points gagnés depuis le 1er janvier (Grands Chelems, Masters 1000, ATP 500 et 250, Challengers), le classement chaque lundi, et la Race to Turin.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: abs(KEY),
    inLanguage: 'fr', isAccessibleForFree: true, temporalCoverage: String(an),
    copyrightHolder: { '@type': 'Person', name: 'Tanguy Drouin' },
    copyrightNotice: '© Tanguy Drouin — grotang.fr. Tous droits réservés.',
    license: abs(KEY) + '#droits',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: [`saison ATP ${an}`, `Race to Turin ${an}`, 'classement ATP', 'tennis'],
  });

  let out = brut.replace(RE, () => `/*DATA_START*/const SA = ${JSON.stringify(data)};/*DATA_END*/`);
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
  out = out.replace('<body>\n', () => `<body>\n${nav(KEY)}\n`).replace('<!--PIED-->', () => PIED);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (apercu) {
    const BANDEAU = `<div class="wip" role="note"><span class="k">Preview · travail en cours</span><span>Page en construction, bloc par bloc.</span><a href="${abs(KEY)}">← Retour</a></div>`;
    out = out.replace('<main class="wrap atp">', () => '<main class="wrap atp">\n' + BANDEAU);
    out = out.replace('</style>', () => `.wip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:8px 14px;border:1px dashed var(--ink-3);border-radius:10px;font-size:13px;color:var(--ink-2);background:var(--surface)}
.wip .k{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:var(--n4);color:#0F141D;border-radius:999px;padding:2px 8px;font-size:10.5px}
.wip a{margin-left:auto;font-weight:700}
</style>`);
  }
  if (!out.includes('gnav') || !out.includes('const SA = {"an"') || !out.includes('rel="canonical"')) throw new Error(`Saison ATP ${an} : injection ratée`);
  return { html: out, maj: data.maj };
}
