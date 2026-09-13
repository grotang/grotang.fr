#!/usr/bin/env node
/* Test de non-régression du collecteur.
 *
 *   node tools/uefa/test-extract.mjs [capture.json|capture.json.gz]
 *
 * Rejoue la lecture sur une capture figée des quatre pages sources et compare le
 * résultat, champ par champ, à une sortie validée à la main. Deux choses peuvent
 * le faire échouer, et toutes deux méritent qu'on s'arrête :
 *   — j'ai cassé le collecteur en le modifiant ;
 *   — le site a changé de forme et la lecture ne donne plus la même chose.
 *
 * Il tourne hors ligne, en une seconde, et il est lancé avant chaque
 * rafraîchissement automatique.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { extract, warnings } from './extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(HERE, f), 'utf8');
const readMaybeGz = f =>
  f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8');

const SRC = process.argv[2] || path.join(HERE, 'fixtures/source.json.gz');
const html = JSON.parse(readMaybeGz(SRC));
const expected = JSON.parse(read('fixtures/expected.json'));

const got = extract(h => new DOMParser().parseFromString(h, 'text/html'), html, {
  names: JSON.parse(read('names.json')),
  clubAliases: JSON.parse(read('club-aliases.json')),
});

/* Comparaison structurelle, avec une tolérance sur les flottants : la source
   publie trois décimales, on ne veut pas d'un échec sur un dernier chiffre. */
const diffs = [];
const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 5e-4;
function cmp(a, b, at) {
  if (a === b || near(a, b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return diffs.push(`${at} : ${a.length} éléments au lieu de ${b.length}`);
    a.forEach((v, i) => cmp(v, b[i], `${at}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], `${at}.${k}`);
    return;
  }
  diffs.push(`${at} : ${JSON.stringify(a)} au lieu de ${JSON.stringify(b)}`);
}

/* « built » et l'heure de génération n'ont pas à être stables. */
const strip = d => ({ ...d, meta: { ...d.meta, built: undefined } });
cmp(strip(got), strip(expected), '');

console.log(`capture : ${path.basename(SRC)}`);
console.log(`lu : ${got.nations.length} nations · ${got.clubs.length} clubs · ${Object.keys(got.series).length} séries`);
console.log(`source arrêtée au ${got.meta.lastUpdated}, saison ${got.meta.season}`);
if (warnings.length) console.log('avertissements :\n  ' + warnings.join('\n  '));

if (diffs.length) {
  console.error(`\n✗ ${diffs.length} écart(s) avec la sortie de référence :`);
  for (const d of diffs.slice(0, 25)) console.error('  ' + d);
  if (diffs.length > 25) console.error(`  … et ${diffs.length - 25} autres`);
  process.exit(1);
}
console.log('\n✓ identique à la sortie de référence');
