/* Fabrication des pages économie : tools/eco/page.html + tools/eco/data.json.
 * UNE source, DEUX pages : mode 'france' → /budget-france/ (les comptes publics),
 * mode 'b27' → /budget-2027/ (le simulateur). page.html marque chaque bloc
 * data-p="france" ou data-p="b27" ; on pose data-mode sur <body> et la page
 * n'affiche (et ne calcule) que ses blocs.
 * plus le chrome commun du site (navigation, thème, polices, mesure d'audience).
 * Appelé par tools/build.mjs, sur le même modèle que la page tennis. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF } from '../chrome.mjs';
import { abs } from '../site.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

export function buildEco(mode = 'france') {
  const key = mode === 'b27' ? 'b27' : 'eco';
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
  const LV0 = JSON.parse(fs.readFileSync(path.join(ICI, 'leviers.json'), 'utf8')), LB = LV0.base;
  const titre = mode === 'b27'
    ? `Faites votre budget ${LB.annee} : les leviers pour réduire le déficit de la France`
    : `Où va l'argent public ? Dépenses et recettes publiques de la France (${D.der})`;
  const desc = mode === 'b27'
    ? `Le gouvernement prévoit un déficit de ${(-LB.solde_pct).toLocaleString('fr-FR')} % du PIB en ${LB.annee}. Actionnez les leviers (niches fiscales, âge de la retraite, taxe Zucman, plafond des pensions, convergence avec nos voisins) et voyez où arrivent le déficit et la dette. Chaque chiffrage est sourcé.`
    : `En ${D.der}, ${md(te)} milliards d'euros de dépenses publiques (${pc(te)} % du PIB), ${md(tr)} milliards de recettes, ${md(-b9)} milliards de déficit. `
    + `Le circuit complet de l'argent public, politique par politique, impôt par impôt, depuis 1995, et la comparaison avec l'Europe.`;
  const jsonld = mode === 'b27' ? JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebApplication', name: titre, description: desc, url: abs(key),
    applicationCategory: 'EducationalApplication', operatingSystem: 'Tous', inLanguage: 'fr', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
  }) : JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: abs(key),
    inLanguage: 'fr', isAccessibleForFree: true, temporalCoverage: `1995/${D.der}`,
    copyrightHolder: { '@type': 'Person', name: 'Tanguy Drouin' },
    copyrightNotice: '© Tanguy Drouin — grotang.fr. Tous droits réservés.',
    isBasedOn: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['dépenses publiques', 'recettes publiques', 'budget de la France', 'déficit public', 'dette publique', 'COFOG', 'prélèvements obligatoires'],
  });

  let out = brut.replace(RE, () => `/*DATA_START*/const DE = ${JSON.stringify(D)};/*DATA_END*/`);
  /* Distribution des retraites (Drees, relevée à la main) pour le simulateur. */
  const RT = JSON.parse(fs.readFileSync(path.join(ICI, 'retraites.json'), 'utf8'));
  const RE2 = /\/\*RT_START\*\/[^]*?\/\*RT_END\*\//;
  if (!RE2.test(out)) throw new Error('économie : sentinelles RT introuvables');
  out = out.replace(RE2, () => `/*RT_START*/const RT = ${JSON.stringify(RT)};/*RT_END*/`);
  /* Leviers du simulateur « Budget 2027 » (relevés à la main dans le PLF). */
  /* le simulateur n'existe que sur /budget-2027/ : la page des comptes ne porte pas ses données */
  const LV = mode === 'b27' ? LV0 : null;
  const RE3 = /\/\*LV_START\*\/[^]*?\/\*LV_END\*\//;
  if (!RE3.test(out)) throw new Error('économie : sentinelles LV introuvables');
  out = out.replace(RE3, () => `/*LV_START*/const LV = ${JSON.stringify(LV)};/*LV_END*/`);
  const RE4 = /\/\*MODE_START\*\/[^]*?\/\*MODE_END\*\//;
  if (!RE4.test(out)) throw new Error('économie : sentinelles MODE introuvables');
  out = out.replace(RE4, () => `/*MODE_START*/const MODE = ${JSON.stringify(mode)};/*MODE_END*/`);
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`);
  out = out.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    () => `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${desc}">
${VERIF}
<link rel="canonical" href="${abs(key)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${titre}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${abs(key)}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonld}</script>
${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', () => `${TOKENS}
${navCSS}
.gnav{margin:0}
</style>`);
  out = out.replace('<body>\n', () => `<body data-mode="${mode}">\n${nav(key)}\n`);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (!out.includes('gnav') || !out.includes('const DE = {') || !out.includes('const RT = {') || (mode === 'b27') !== out.includes('const LV = {') || !out.includes(`data-mode="${mode}"`)) throw new Error('économie : injection ratée');
  return { html: out, der: D.der };
}
