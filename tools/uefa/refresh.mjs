#!/usr/bin/env node
/* Rafraîchissement quotidien du bloc UEFA.
 *
 *   node tools/uefa/refresh.mjs [--force] [--dry-run] [--fixtures <fichier>]
 *
 * Va lire les quatre pages de 5-jahres-wertung.de, reconstruit le bloc de données
 * de tools/uefa/page.html, puis régénère public/. Trois sorties possibles :
 *
 *   code 0, « inchangé »  — la source n'a pas bougé depuis la dernière fois.
 *                           Rien n'est écrit, rien n'est publié.
 *   code 0, « mis à jour » — nouvelles données, contrôles passés, fichiers écrits.
 *   code 1                 — un contrôle a échoué. Rien n'est écrit : la page de
 *                           la veille reste en ligne. Une page datée vaut mieux
 *                           qu'une page fausse.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { extract, warnings, PAGES, BASE, SourceError } from './extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PAGE = path.join(HERE, 'page.html');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FORCE = has('--force'), DRY = has('--dry-run'), FIXTURES = opt('--fixtures');

const log = (...a) => console.log(...a);

/* ---------- récupération ---------- */
/* Le site est modeste : on l'interroge une page à la fois, avec un délai
   d'attente franc et deux reprises, plutôt qu'en rafale. */
async function fetchPage(file, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 30_000);
      const r = await fetch(BASE + file, {
        signal: ac.signal,
        headers: { 'User-Agent': 'grotang.fr/1.0 (+https://grotang.fr)', 'Accept-Language': 'de,en' },
      });
      clearTimeout(to);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const t = await r.text();
      if (t.length < 20_000) throw new Error(`réponse trop courte (${t.length} octets)`);
      return t;
    } catch (e) {
      if (i >= tries) throw new Error(`${file} : ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

async function loadSources() {
  if (FIXTURES) { log(`source : capture locale ${FIXTURES}`); return JSON.parse(fs.readFileSync(FIXTURES, 'utf8')); }
  const out = {};
  for (const [key, file] of Object.entries(PAGES)) {
    out[key] = await fetchPage(file);
    log(`  ${file.padEnd(16)} ${String(out[key].length).padStart(7)} octets`);
  }
  return out;
}

/* ---------- bloc de données de la page ---------- */
const SENTINEL = { open: '/*DATA_START*/', close: '/*DATA_END*/' };

function readBlock(src) {
  const a = src.indexOf(SENTINEL.open), b = src.indexOf(SENTINEL.close);
  if (a < 0 || b < 0) throw new Error('page.html : sentinelles du bloc de données introuvables');
  return JSON.parse(src.slice(a + SENTINEL.open.length, b).replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
}

function writeBlock(src, data) {
  const a = src.indexOf(SENTINEL.open), b = src.indexOf(SENTINEL.close);
  return src.slice(0, a) + SENTINEL.open + 'const D = ' + JSON.stringify(data) + ';' + src.slice(b);
}

/* ---------- comparaison avec la veille ---------- */
/* Ce qu'on regarde n'est pas la date affichée par la source mais les chiffres
   eux-mêmes : la source republie parfois à l'identique, et on ne veut pas d'un
   commit vide par jour. */
function digest(d) {
  return JSON.stringify({
    m: d.meta,
    n: d.nations.map(n => [n.c, n.r, n.t, n.tp, n.b, n.y, n.k, n.a]),
    s: d.nations.map(n => d.series[n.c]),
    c: d.clubs.map(c => [c.n, c.k, c.p]),
  });
}

/* ---------- exécution ---------- */
try {
  log(`— rafraîchissement UEFA, ${new Date().toISOString()}`);
  const html = await loadSources();

  const parse = h => new DOMParser().parseFromString(h, 'text/html');
  const names = JSON.parse(fs.readFileSync(path.join(HERE, 'names.json'), 'utf8'));
  const clubAliases = JSON.parse(fs.readFileSync(path.join(HERE, 'club-aliases.json'), 'utf8'));
  const data = extract(parse, html, { names, clubAliases });

  for (const w of warnings) log('  ⚠ ' + w);

  const src = fs.readFileSync(PAGE, 'utf8');
  const before = readBlock(src);
  data.meta.built = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  const same = digest({ ...before, meta: { ...before.meta, built: null } })
            === digest({ ...data,   meta: { ...data.meta,   built: null } });
  log(`source arrêtée au ${data.meta.lastUpdated} · ${data.nations.length} nations · ${data.clubs.length} clubs`);
  log(`France : coefficient de saison ${data.nations.find(n => n.c === 'FRA').y[4]}, rang ${data.nations.find(n => n.c === 'FRA').r}`);

  if (same && !FORCE) { log('inchangé depuis la dernière publication — rien à faire'); process.exit(0); }
  if (DRY) { log('essai à blanc : les contrôles passent, rien n\'est écrit'); process.exit(0); }

  fs.writeFileSync(PAGE, writeBlock(src, data));
  fs.writeFileSync(path.join(HERE, 'nations.json'), JSON.stringify(data.nations, null, 0));
  log('page.html et nations.json réécrits');

  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build.mjs')], { stdio: 'inherit' });
  log('mis à jour');
  process.exit(0);
} catch (e) {
  console.error(`\n✗ ${e instanceof SourceError ? 'contrôle source' : 'échec'} : ${e.message}`);
  console.error('Rien n\'a été écrit ; la version publiée reste celle de la veille.');
  if (!(e instanceof SourceError)) console.error(e.stack);
  process.exit(1);
}
