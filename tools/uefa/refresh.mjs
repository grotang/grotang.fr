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

/* ---------- archive des effectifs ----------
 * Le reste de la page est sans mémoire : chaque publication rejoue le calcul
 * complet depuis la source, et c'est ce qui la rend vérifiable. Une seule série
 * fait exception, et il n'y avait pas le choix : la source publie le nombre de
 * clubs encore en lice AUJOURD'HUI, jamais son histoire. Sans archive, la courbe
 * de survie ne pourrait pas exister.
 * On n'ajoute donc une entrée que lorsqu'un effectif change, on n'en réécrit
 * jamais une ancienne, et la date est celle du relevé de la source — pas celle
 * de la machine qui fait tourner ce script.
 */
const SURV_SENTINEL = { open: '/*SURVIE_START*/', close: '/*SURVIE_END*/' };

function majSurvie(src, data) {
  const a = src.indexOf(SURV_SENTINEL.open), b = src.indexOf(SURV_SENTINEL.close);
  if (a < 0 || b < 0) { log('  ⚠ bloc SURVIE absent de page.html : effectifs non archivés'); return src; }
  const prev = JSON.parse(src.slice(a + SURV_SENTINEL.open.length, b)
    .replace(/^const SURVIE\s*=\s*/, '').replace(/;\s*$/, ''));
  const rel = Array.isArray(prev.rel) ? prev.rel.slice() : [];

  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(data.meta.lastUpdated).trim());
  if (!m) { log('  ⚠ date de relevé illisible : effectifs non archivés'); return src; }
  const iso = `${m[3]}-${m[2]}-${m[1]}`;

  const vec = {};
  for (const n of data.nations) vec[n.c] = [n.a[0], n.a[1], n.a[2], n.a[3]];

  const dernier = rel.length ? rel[rel.length - 1] : null;
  const identique = dernier && JSON.stringify(dernier[1]) === JSON.stringify(vec);
  if (identique) { log('effectifs inchangés — archive non modifiée'); return src; }

  /* Un relevé plus ancien que le dernier archivé ne peut pas être une nouveauté :
     c'est une source qui recule, on refuse plutôt que de désordonner l'archive. */
  if (dernier && iso < dernier[0]) { log(`  ⚠ relevé ${iso} antérieur à ${dernier[0]} : archive inchangée`); return src; }

  /* Même journée, effectif différent : on remplace, sinon deux marches tombent
     sur la même abscisse et l'escalier devient vertical. */
  if (dernier && iso === dernier[0]) rel[rel.length - 1] = [iso, vec]; else rel.push([iso, vec]);

  const chg = dernier ? data.nations.filter(n => dernier[1][n.c] && dernier[1][n.c][3] !== n.a[3]) : [];
  log(`effectifs archivés au ${iso} · ${rel.length} relevés`
    + (chg.length ? ` · ${chg.map(n => `${n.c} ${dernier[1][n.c][3]}→${n.a[3]}`).join(', ')}` : ''));

  return src.slice(0, a) + SURV_SENTINEL.open + 'const SURVIE = ' + JSON.stringify({ rel }) + ';' + src.slice(b);
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

  fs.writeFileSync(PAGE, majSurvie(writeBlock(src, data), data));
  /* nations.json porte en plus `lp`, les points marqués en PHASE DE LIGUE seuls.
     Il est déductible de data.series (les gains m[*] ramenés en points par le
     diviseur), mais pas de nations.json lui-même — et c'est la seule entrée dont
     le script R de projection a besoin pour pondérer la saison en cours. Le
     calculer ici évite de publier la série complète juste pour ça. */
  const nationsOut = data.nations.map(n => {
    const m = (data.series[n.c] || {}).m || [];
    const lp = +(m.reduce((a, s) => a + s[1], 0) * (n.divisor || 1)).toFixed(3);
    return n.divisor ? { ...n, lp } : n;
  });
  fs.writeFileSync(path.join(HERE, 'nations.json'), JSON.stringify(nationsOut, null, 0));
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
