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
const SOURCES = [
  ['Wikipédia (référence)', "https://en.wikipedia.org/w/index.php?action=raw&title=2026_ATP_Finals"],
  ['tennis-db (texte)', 'https://tennis-db.com/seasons-and-rankings.md?view=race'],
  ['tennis-db (page)', 'https://tennis-db.com/seasons-and-rankings?view=race'],
  ['live-tennis.eu', 'https://live-tennis.eu/fr/classement-atp-live'],
  ['ATP, Race officielle', 'https://www.atptour.com/en/rankings/singles-race-to-turin'],
];
const NOMS = ['Sinner', 'Zverev', 'Alcaraz', 'Shelton', 'Fritz', 'Djokovic', 'Medvedev', 'Fils'];

const lignes = ['| Source | HTTP | Taille | Temps | Noms trouvés | Liens « race » |', '|---|---|---|---|---|---|'];
for (const [nom, url] of SOURCES) {
  const t0 = Date.now();
  let code = '—', corps = '', err = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    code = String(r.status); corps = await r.text();
  } catch (e) { err = e.message; }
  const ms = Date.now() - t0;
  const trouves = NOMS.filter(n => corps.includes(n));
  const liens = [...new Set([...corps.matchAll(/href="([^"]*race[^"]*)"/gi)].map(m => m[1]))].slice(0, 6);
  const texte = corps.replace(/<script[^]*?<\/script>/gi, ' ').replace(/<style[^]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n=== ${nom} — ${url}`);
  console.log(`HTTP ${code}${err ? ' (' + err + ')' : ''} · ${corps.length} octets · ${ms} ms`);
  console.log(`Noms trouvés : ${trouves.join(', ') || 'aucun'}`);
  if (liens.length) console.log('Liens « race » : ' + liens.join(' | '));
  console.log('Début du texte : ' + texte.slice(0, 600));
  lignes.push(`| ${nom} | ${code}${err ? ' ⚠' : ''} | ${corps.length} | ${ms} ms | ${trouves.length}/${NOMS.length} | ${liens.length} |`);
  await new Promise(ok => setTimeout(ok, 1500));
}
console.log('\n' + lignes.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Test des sources ATP\n\n' + lignes.join('\n') + '\n');
