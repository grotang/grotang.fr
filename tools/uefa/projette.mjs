#!/usr/bin/env node
/* Rejoue la projection sur le runner et incruste les quantiles dans la page.
 *
 *   node tools/uefa/projette.mjs [nombre de saisons]      (défaut : 100 000)
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * La simulation tournait dans le navigateur de CHAQUE visiteur, à chaque
 * ouverture. Précision et attente s'opposaient donc directement : 2 000 saisons
 * pour tenir une seconde sur un poste fixe, cinq à neuf sur un téléphone de
 * milieu de gamme. À ce compte-là l'erreur d'échantillonnage valait un dixième
 * de point — un dixième inventé par le tirage, sur un chiffre publié.
 *
 * Le calcul a donc lieu ici, une fois par rafraîchissement, et la page ne reçoit
 * plus que six nombres par nation et par horizon.
 *
 * LE MODÈLE N'EST PAS RECOPIÉ ICI. Ce script ouvre la page déjà construite dans
 * un navigateur sans fenêtre et appelle `window.__projette(n)` — le même code,
 * la même graine, seulement beaucoup plus de saisons. Une réimplémentation en
 * Node aurait été une seconde version du modèle, et deux versions d'un modèle
 * divergent au premier paramètre qu'on change.
 *
 * La graine reste la date des données : à données égales, le résultat est
 * reproductible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const PAGE = path.join(ICI, 'page.html');
const BATI = path.join(RACINE, 'public/uefa/index.html');
const SENT = ['/*PRJ_START*/', '/*PRJ_END*/'];
const N = Number(process.argv[2] || 100000);

if (!fs.existsSync(BATI)) { console.error('public/uefa/index.html absent : lancer le build d\'abord.'); process.exit(2); }

const EXE = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
const nav = await chromium.launch(EXE ? { executablePath: EXE } : {});
const page = await nav.newPage();
const boum = [];
page.on('pageerror', e => boum.push(e.message));
await page.goto('file://' + BATI, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__projette === 'function', null, { timeout: 15000 });

const t0 = Date.now();
const R = await page.evaluate(n => window.__projette(n), N);
const sec = ((Date.now() - t0) / 1000).toFixed(1);
await nav.close();

if (boum.length) { console.error('erreur dans la page :', boum[0]); process.exit(1); }
const nations = Object.keys(R.q.tir || {}).length;
if (!nations) { console.error('projection vide : champ de competition incomplet, rien n\'est incruste.'); process.exit(1); }

/* Les contrôles de conservation du modèle remontent tels quels : 90 points de
   phase finale par compétition, 45/30/15 de bonus de tour, 75/75/42 de bonus de
   rang. À cent mille tirages ils doivent tomber au centième. */
if (R.ecarts && R.ecarts.length) { console.error('controles de conservation en echec :', R.ecarts.join(' · ')); process.exit(1); }

const src = fs.readFileSync(PAGE, 'utf8');
const a = src.indexOf(SENT[0]), b = src.indexOf(SENT[1]);
if (a < 0 || b < 0) { console.error('sentinelles PRJ introuvables dans page.html'); process.exit(2); }
const out = src.slice(0, a) + SENT[0] + 'const PRJ = ' + JSON.stringify(R) + ';' + src.slice(b);
fs.writeFileSync(PAGE + '.tmp', out); fs.renameSync(PAGE + '.tmp', PAGE);

console.log(`${R.n.toLocaleString('fr-FR')} saisons simulees en ${sec} s · ${nations} nations · controles de conservation OK`);
console.log('page.html : bloc PRJ mis a jour');
execFileSync(process.execPath, [path.join(RACINE, 'tools/build.mjs')], { stdio: 'inherit' });
