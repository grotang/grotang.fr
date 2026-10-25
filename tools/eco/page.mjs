/* Fabrication de la page /economie/ : tools/eco/page.html + tools/eco/data.json,
 * plus le chrome commun du site (navigation, thème, polices, mesure d'audience).
 * Appelé par tools/build.mjs, sur le même modèle que la page tennis. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF } from '../chrome.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

export function buildEco() {
  const D = JSON.parse(fs.readFileSync(path.join(ICI, 'data.json'), 'utf8'));
  const brut = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
  const RE = /\/\*DATA_START\*\/[^]*?\/\*DATA_END\*\//;
  if (!RE.test(brut)) throw new Error('économie : sentinelles DATA introuvables');
  const k = D.an.indexOf(D.der), te = D.agg.S13.TE[k], tr = D.agg.S13.TR[k], b9 = D.agg.S13.B9[k];
  const md = m => Math.round(m / 1000).toLocaleString('fr-FR');
  const pc = m => (m / D.pib[k] * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

  /* Référencement : la requête visée est « où va l'argent public », « dépenses
     publiques France », « budget de la France ». La description porte les
     chiffres de l'année et se réécrit seule quand Eurostat publie. */
  const titre = `Où va l'argent public ? Dépenses et recettes publiques de la France (${D.der})`;
  const desc = `En ${D.der}, ${md(te)} milliards d'euros de dépenses publiques (${pc(te)} % du PIB), ${md(tr)} milliards de recettes, ${md(-b9)} milliards de déficit. `
    + `Le circuit complet de l'argent public, politique par politique, impôt par impôt, depuis 1995, et la comparaison avec l'Europe.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: 'https://grotang.fr/economie/',
    inLanguage: 'fr', isAccessibleForFree: true, temporalCoverage: `1995/${D.der}`,
    copyrightHolder: { '@type': 'Person', name: 'Tanguy Drouin' },
    copyrightNotice: '© Tanguy Drouin — grotang.fr. Tous droits réservés.',
    isBasedOn: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['dépenses publiques', 'recettes publiques', 'budget de la France', 'déficit public', 'dette publique', 'COFOG', 'prélèvements obligatoires'],
  });

  let out = brut.replace(RE, () => `/*DATA_START*/const DE = ${JSON.stringify(D)};/*DATA_END*/`);
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`);
  out = out.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    () => `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${desc}">
${VERIF}
<link rel="canonical" href="https://grotang.fr/economie/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${titre}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="https://grotang.fr/economie/">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonld}</script>
${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', () => `${TOKENS}
${navCSS}
.gnav{margin:0}
</style>`);
  out = out.replace('<body>\n', () => `<body>\n${nav('eco')}\n`);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (!out.includes('gnav') || !out.includes('const DE = {')) throw new Error('économie : injection ratée');
  return { html: out, der: D.der };
}
