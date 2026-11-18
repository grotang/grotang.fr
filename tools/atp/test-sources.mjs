#!/usr/bin/env node
/* Test des sources de la Race ATP, lancé à la main depuis GitHub (workflow
 * « Test des sources ATP »). Rien n'est écrit dans le dépôt : le script lit
 * chaque source une fois, avec le User-Agent du robot (on ne se fait pas
 * passer pour un navigateur), et dit ce qu'il a obtenu.
 *
 * Pour chaque source : code HTTP, taille, temps de réponse, présence de
 * quelques noms du haut de la Race (signe que le classement est bien dans la
 * page et pas chargé ensuite par JavaScript), liens qui parlent de « race »,
 * et le début du texte. Le résumé s'affiche aussi en tête de la page du
 * passage GitHub (GITHUB_STEP_SUMMARY). */
import fs from 'node:fs';

const UA = 'grotang.fr-robot/1.0 (https://grotang.fr/; classement ATP, une lecture par semaine)';
/* 2e test (18/11/2026). Les adresses d'articles sont celles trouvées par
   recherche, vérifiées comme existantes : on teste l'accès depuis GitHub. */
const SOURCES = [
  ['Wikipédia, Current tennis rankings', 'https://en.wikipedia.org/w/index.php?action=raw&title=Current_tennis_rankings'],
  ['Wikipédia, historique au 30/03', 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=revisions&titles=Current_tennis_rankings&rvlimit=1&rvstart=2026-03-31T00:00:00Z&rvdir=older&rvprop=timestamp|content&rvslots=main'],
  ['tennis365, article 30/03', 'https://www.tennis365.com/tennis-news/atp-rankings-race-to-turin-alcaraz-sinner-well-clear-djokovic-in-5th-fils-surges'],
  ['tennis365, article 15/07', 'https://www.tennis365.com/tennis-news/atp-rankings-race-to-turin-novak-djokovic-carlos-alcaraz-jannik-sinner-alexander-zverev-lead'],
  ['ATP Finals, article 24/08', 'https://www.nittoatpfinals.com/en/news/fils-tiafoe-pif-atp-live-race-to-turin-24-august-2026'],
  ['ATP Finals, article Roland-Garros', 'https://www.nittoatpfinals.com/en/news/zverev-pif-atp-live-race-to-turin-roland-garros-2026'],
];
const NOMS = ['Sinner', 'Zverev', 'Alcaraz', 'Shelton', 'Fritz', 'Djokovic', 'Medvedev', 'Fils'];
/* chiffres attendus, pour vérifier que la page contient bien le classement */
const CHIFFRES = ['2,950', '2,900', '7,950', '9,350', '3,140', '5,040'];

const lignes = ['| Source | HTTP | Taille | Temps | Noms trouvés | Chiffres trouvés |', '|---|---|---|---|---|---|'];
for (const [nom, url] of SOURCES) {
  const t0 = Date.now();
  let code = '—', corps = '', err = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    code = String(r.status); corps = await r.text();
  } catch (e) { err = e.message; }
  const ms = Date.now() - t0;
  const trouves = NOMS.filter(n => corps.includes(n));
  const chiffres = CHIFFRES.filter(c => corps.includes(c));
  const liens = [...new Set([...corps.matchAll(/href="([^"]*race[^"]*)"/gi)].map(m => m[1]))].slice(0, 6);
  const texte = corps.replace(/<script[^]*?<\/script>/gi, ' ').replace(/<style[^]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n=== ${nom} — ${url}`);
  console.log(`HTTP ${code}${err ? ' (' + err + ')' : ''} · ${corps.length} octets · ${ms} ms`);
  console.log(`Noms trouvés : ${trouves.join(', ') || 'aucun'}`);
  console.log(`Chiffres attendus trouvés : ${chiffres.join(' ; ') || 'aucun'}`);
  if (liens.length) console.log('Liens « race » : ' + liens.join(' | '));
  console.log('Début du texte : ' + texte.slice(0, 400));
  lignes.push(`| ${nom} | ${code}${err ? ' ⚠' : ''} | ${corps.length} | ${ms} ms | ${trouves.length}/${NOMS.length} | ${chiffres.join(' ; ') || '—'} |`);
  await new Promise(ok => setTimeout(ok, 1500));
}
console.log('\n' + lignes.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test des sources ATP\n\n' + lignes.join('\n') + '\n');
