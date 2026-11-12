/* Fabrication de la page « Force des clubs » (/football-force-des-clubs/, chantier C23).
 *
 * Données :
 *   - tools/uefa/force-clubs.json : écrit chaque lundi par le robot force.yml
 *     (tools/uefa/force-clubs.py) — forces des 182 clubs de 1re division des
 *     10 premières nations (`championnats`, noms Wikipédia), des clubs engagés en
 *     Europe (`clubs`, noms de la source UEFA), des nations, promus, base de l'indice ;
 *   - tools/uefa/archive/force-historique.json : l'indice de chaque club, semaine
 *     par semaine (colonne « Sem. ») ;
 *   - tools/uefa/force-noms.json : nom de la source UEFA -> nom Wikipédia ;
 *   - la page UEFA (tools/uefa/page.html) : noms français (NOMCLUB), coupe et
 *     points de coefficient de chaque club (D.eff), clubs de la phase de ligue (PRJ.clubs).
 * Indice : 100 = club moyen de la phase de ligue 2026/27 (gelé), 40 points = 1 but.
 * Appelé par tools/build.mjs. Rend null si force-clubs.json n'a pas encore les
 * championnats (le build pose alors la page d'attente). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, navCSS, FAVICON, TOKENS, THEME_BOOT, THEME_JS, FONTS, ANALYTICS, VERIF, PIED } from '../chrome.mjs';
import { abs } from '../site.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..', '..');
const KEY = 'force';
const lit = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const entre = (src, a, b) => { const i = src.indexOf(a); if (i < 0) return null; const j = src.indexOf(b, i + a.length); return j < 0 ? null : src.slice(i + a.length, j); };
const DIX = ['ENG', 'ITA', 'ESP', 'GER', 'FRA', 'POR', 'BEL', 'NED', 'TUR', 'GRE'];

/* nom affiché d'un club connu seulement par son nom Wikipédia (club sans match européen) */
const propre = w => w.replace(/\s*\([^)]*\)/g, '').replace(/\s+(FC|F\.C\.|CF|SFK|FK|JK|SK|BC|AFC)$/, '').replace(/^(FC|AFC|1 FC|1 FSV)\s+/, '').trim();

export function buildForce() {
  const FC = JSON.parse(lit('tools/uefa/force-clubs.json'));
  if (!Array.isArray(FC.championnats) || !FC.championnats.length) return null;
  let H = {}; try { H = JSON.parse(lit('tools/uefa/archive/force-historique.json')); } catch { /* pas encore d'historique */ }
  const NOMS_WIKI = JSON.parse(lit('tools/uefa/force-noms.json'));
  const src = lit('tools/uefa/page.html');
  const D = JSON.parse(entre(src, '/*DATA_START*/const D = ', ';/*DATA_END*/'));
  const P = JSON.parse(entre(src, '/*PRJ_START*/const PRJ = ', ';/*PRJ_END*/'));
  const NOMCLUB = JSON.parse(entre(src, '/*NOMS_START*/const NOMCLUB = ', ';/*NOMS_END*/') || '{}');

  const B = FC.base_indice, K = FC.points_par_but;
  const ix = f => Math.round((100 + K * (f - B)) * 10) / 10;
  const source = {}; for (const [s, w] of Object.entries(NOMS_WIKI)) if (!(w in source)) source[w] = s;   // Wikipédia -> source
  const fr = s => NOMCLUB[s] || s;
  /* engagés en Europe cette saison (10 nations) : coupe atteinte et points de coefficient (D.eff),
     présence en phase de ligue (PRJ.clubs) */
  const COUPE = ['C1', 'C3', 'C4'], eff = {}, lp = new Set((P.clubs || []).map(c => c[0]));
  for (const c of DIX) for (const r of (D.eff || {})[c] || []) eff[r[0]] = { nat: c, coupe: COUPE[r[1]], pts: r[3] };

  /* semaine en cours et précédente dans l'historique */
  const sems = Object.keys(H).sort(), semCour = sems.at(-1), semPrec = sems.length > 1 ? sems.at(-2) : null;
  const promus = new Set(FC.promus || []);
  const clubs = FC.championnats.map(([w, nat, f], i) => {
    const s = source[w], e = s && eff[s];
    const av = semPrec && H[semPrec][w] != null ? H[semPrec][w] : null;
    return { rang: i + 1, nom: s ? fr(s) : propre(w), nat, ix: ix(f), coupe: e ? e.coupe : null, promu: promus.has(w) || undefined, av };
  });
  const contingents = Object.entries(eff).map(([s, e]) => ({ nom: fr(s), nat: e.nat, coupe: e.coupe, pts: e.pts, lp: lp.has(s),
    ix: ix(FC.clubs[s] ?? FC.nations[e.nat]) }));
  const ligue = {}; for (const c of DIX) { const v = FC.championnats.filter(x => x[1] === c).map(x => x[2]); if (v.length) ligue[c] = ix(v.reduce((a, b) => a + b, 0) / v.length); }
  const dans = new Set(clubs.map(c => c.nom));
  const comparateur = [...FC.championnats.map(([w, nat, f]) => [source[w] ? fr(source[w]) : propre(w), nat, f]),
    ...Object.entries(eff).filter(([s]) => !dans.has(fr(s)) && FC.clubs[s] != null).map(([s, e]) => [fr(s), e.nat, FC.clubs[s]])]
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  const FD = { date: FC.date, semPrec, pts_but: K, echelle: FC.echelle, terrain: Math.round(FC.avantage_terrain * 100) / 100,
    ordre: DIX, clubs, contingents, ligue, comparateur, defaut: [fr('Paris Saint-Germain'), fr('Arsenal FC')] };

  const titre = 'La force des clubs de football européens : classement et indice chaque semaine';
  const desc = `Le niveau réel de ${clubs.length} clubs des 10 premiers championnats européens, mesuré sur trois saisons de championnat et de coupes d'Europe. Mis à jour chaque lundi.`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Dataset', name: titre, description: desc, url: abs(KEY),
    inLanguage: 'fr', isAccessibleForFree: true, dateModified: FC.date,
    copyrightHolder: { '@type': 'Person', name: 'Tanguy Drouin' },
    copyrightNotice: '© Tanguy Drouin — grotang.fr. Tous droits réservés.',
    license: abs(KEY) + '#droits',
    creator: { '@type': 'Organization', name: 'grotang.fr', url: 'https://grotang.fr/' },
    keywords: ['force des clubs', 'classement des clubs européens', 'meilleur club d\'Europe', 'Ligue des champions', 'coefficient UEFA'],
  });

  const brut = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
  let out = brut.replace(/\/\*DATA_START\*\/[^]*?\/\*DATA_END\*\//, () => `/*DATA_START*/const FD = ${JSON.stringify(FD)};/*DATA_END*/`);
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${titre}</title>`);
  out = out.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    () => `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${desc}">
${VERIF}
<link rel="canonical" href="${abs(KEY)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="grotang.fr">
<meta property="og:title" content="${titre}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${abs(KEY)}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${jsonld}</script>
${FAVICON}
${FONTS}
${THEME_BOOT}`);
  out = out.replace('</style>', () => `${TOKENS}
${navCSS}
.gnav{margin:0}
</style>`);
  out = out.replace('<body>\n', () => `<body>\n${nav(KEY)}\n`).replace('<!--PIED-->', () => PIED);
  out = out.replace('</body>', () => `${THEME_JS}\n${ANALYTICS}\n</body>`);
  if (!out.includes('gnav') || !out.includes('const FD = {"date"') || !out.includes('rel="canonical"')) throw new Error('Force des clubs : injection ratée');
  return { html: out, n: clubs.length };
}
