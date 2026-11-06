#!/usr/bin/env node
/* Range les gazettes (bloc 2c de la page UEFA) dans tools/uefa/archive/gazettes.json.
 *
 *   node tools/uefa/gazettes.mjs          (après un build : lit public/<page UEFA>)
 *
 * Le rédacteur vit dans la page (un seul exemplaire) : on ouvre la page
 * construite dans un navigateur sans fenêtre et on lit window.__gazettes().
 * Le fichier n'est réécrit que si une gazette a changé (pas de commit pour
 * rien) ; dans ce cas le site est reconstruit, pour que les pages par semaine
 * suivent. Appelé par projette.mjs, après la projection. Un échec ici ne bloque
 * jamais rien : on garde le fichier précédent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { url } from '../site.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const BATI = path.join(RACINE, 'public', url('uefa'), 'index.html');
const FICHIER = path.join(ICI, 'archive', 'gazettes.json');

try {
  if (!fs.existsSync(BATI)) throw new Error(BATI + ' absent');
  const EXE = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  const nav = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const page = await nav.newPage(), boum = [];
  page.on('pageerror', e => boum.push(e.message));
  await page.goto('file://' + BATI, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__gazettes === 'function', null, { timeout: 15000 });
  const G = await page.evaluate(() => window.__gazettes());
  await nav.close();
  if (boum.length) throw new Error('erreur dans la page : ' + boum[0]);
  if (!G || !G.liste || !G.liste.length) throw new Error('aucune gazette');
  const neuf = JSON.stringify({ liste: G.liste }, null, 1) + '\n';
  const avant = fs.existsSync(FICHIER) ? fs.readFileSync(FICHIER, 'utf8') : '';
  if (neuf === avant) { console.log(`gazettes : ${G.liste.length}, inchangées`); }
  else {
    fs.writeFileSync(FICHIER, neuf);
    console.log(`gazettes : ${G.liste.length} rangées dans tools/uefa/archive/gazettes.json`);
    execFileSync(process.execPath, [path.join(RACINE, 'tools/build.mjs')], { stdio: 'inherit' });
  }
} catch (e) { console.log('gazettes : rien de changé (' + e.message + ')'); }
