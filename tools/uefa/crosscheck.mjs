#!/usr/bin/env node
/* Recoupement du classement avec un SECOND calculateur indépendant.
 *
 *   node tools/uefa/crosscheck.mjs <instantané.json> [--dry-run]
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * Les contrôles de refresh.mjs vérifient que les chiffres de 5-jahres-wertung
 * sont cohérents ENTRE EUX : somme des clubs ÷ nombre de clubs = coefficient,
 * barème des bonus respecté, recollement des cinq saisons. Tous passent au vert
 * même si la source s'est trompée à la saisie : une erreur cohérente reste
 * cohérente. C'est un rapprochement à une seule source.
 *
 * Ici on confronte le résultat à kassiesa.net, qui recalcule le même classement
 * à partir des mêmes résultats de matchs, mais séparément. Ce n'est pas une
 * seconde OBSERVATION du réel — les deux partent de l'UEFA — mais un second
 * CALCUL. Ça n'attrape pas une erreur de l'UEFA ; ça attrape une faute de
 * saisie, une règle mal appliquée (le barème du bonus de classement a changé
 * en 2024/25, c'est typiquement là que les sites divergent) et, cas le plus
 * probable, une erreur de notre propre reconstruction.
 *
 * Régime : SIGNALANT. Un désaccord ne bloque jamais la publication — il
 * s'affiche. Un site qui dit « ici mes deux sources divergent » est plus
 * crédible qu'un site qui n'en montre qu'une.
 *
 * L'instantané est fourni en fichier plutôt que récupéré ici : kassiesa n'est
 * pas joignable depuis les runners GitHub ni depuis le bac à sable. Il est
 * relevé à la main, une fois par semaine, via le navigateur du poste.
 * Format attendu : { upd, rows:[{ rank, name, tot, y:[5] }] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, 'page.html');
const SENT = { open: '/*XCHK_START*/', close: '/*XCHK_END*/' };
const DSENT = { open: '/*DATA_START*/', close: '/*DATA_END*/' };

/* Les deux sites nomment quatre pays différemment. Table explicite plutôt que
   rapprochement approximatif : un « à peu près » sur les noms finirait par
   comparer la Slovénie à la Slovaquie. */
const ALIAS = {
  'Czechia': 'Czech Republic',
  'Türkiye': 'Turkey',
  'Ireland': 'Republic of Ireland',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
};

/* Les deux sources publient à trois décimales. En deçà d'un demi-millième,
   l'écart est un arrondi d'affichage, pas un désaccord. Au-delà, les deux
   calculs ne disent pas la même chose — reste à savoir à quel point.
   Le seuil haut vaut un huitième de point : en dessous, l'écart ressemble à
   une division près, au-dessus il y a un résultat de match en jeu. */
const EPS = 5e-4, GROS = 0.125;

const YR = ['22/23', '23/24', '24/25', '25/26', '26/27'];

function lireBloc(src, sent, prefixe) {
  const a = src.indexOf(sent.open), b = src.indexOf(sent.close);
  if (a < 0 || b < 0) return null;
  return JSON.parse(src.slice(a + sent.open.length, b)
    .replace(new RegExp('^const ' + prefixe + '\\s*=\\s*'), '').replace(/;\s*$/, ''));
}

function ecrireBloc(src, sent, prefixe, data) {
  const a = src.indexOf(sent.open), b = src.indexOf(sent.close);
  if (a < 0 || b < 0) throw new Error(`page.html : sentinelles ${sent.open} introuvables`);
  return src.slice(0, a) + sent.open + `const ${prefixe} = ` + JSON.stringify(data) + ';' + src.slice(b);
}

export function recouper(D, K) {
  const mien = new Map(D.nations.map(n => [n.n, n]));
  const vus = new Set();
  const ecarts = [];      // désaccords sur une valeur
  const absents = [];     // pays présent d'un côté seulement
  let nPays = 0, nVal = 0;

  for (const r of K.rows) {
    const nom = ALIAS[r.name] || r.name;
    const m = mien.get(nom);
    if (!m) { absents.push({ nom: r.name, ou: 'kassiesa' }); continue; }
    vus.add(nom); nPays++;

    const pose = (quoi, a, b) => {
      const d = a - b;
      if (Math.abs(d) <= EPS) return;
      ecarts.push({ p: m.c, quoi, moi: +a.toFixed(3), lui: +b.toFixed(3),
                    d: +d.toFixed(3), gros: Math.abs(d) > GROS });
    };

    nVal++; if (m.r !== r.rank) ecarts.push({ p: m.c, quoi: 'rang', moi: m.r, lui: r.rank, d: m.r - r.rank, gros: true });
    nVal++; pose('total 5 ans', m.t, r.tot);
    for (let i = 0; i < 5; i++) { nVal++; pose(YR[i], m.y[i], r.y[i]); }
  }
  for (const [nom, n] of mien) if (!vus.has(nom)) absents.push({ nom, ou: 'nous', p: n.c });

  ecarts.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return {
    at: new Date().toISOString().slice(0, 10),
    src: 'kassiesa.net',
    srcUrl: 'https://kassiesa.net/uefa/data/method5/crank2027.html',
    srcAt: K.upd || null,
    nousAt: D.meta.lastUpdated,
    pays: nPays, valeurs: nVal,
    ecarts, absents,
    verdict: ecarts.length === 0 && absents.length === 0 ? 'ok'
           : ecarts.some(e => e.gros) || absents.length ? 'ecart' : 'mineur',
  };
}

/* ---------- exécution en ligne de commande ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const DRY = argv.includes('--dry-run');
  const fichier = argv.find(a => !a.startsWith('--'));
  if (!fichier) { console.error('usage : crosscheck.mjs <instantané.json> [--dry-run]'); process.exit(2); }

  const src = fs.readFileSync(PAGE, 'utf8');
  const D = lireBloc(src, DSENT, 'D');
  const K = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const r = recouper(D, K);

  const LBL = { ok: 'accord complet', mineur: 'écarts mineurs', ecart: 'ÉCART' };
  console.log(`${r.pays} pays, ${r.valeurs} valeurs comparées — ${LBL[r.verdict]}`);
  console.log(`  nous     ${r.nousAt}`);
  console.log(`  kassiesa ${r.srcAt}`);
  for (const e of r.ecarts) console.log(`  ${e.gros ? '!!' : ' ~'} ${e.p} ${e.quoi} : nous ${e.moi} / kassiesa ${e.lui} (${e.d > 0 ? '+' : ''}${e.d})`);
  for (const a of r.absents) console.log(`  ?? ${a.nom} absent chez ${a.ou === 'nous' ? 'kassiesa' : 'nous'}`);

  if (DRY) { console.log('\n--dry-run : page.html non modifiée'); process.exit(0); }
  fs.writeFileSync(PAGE, ecrireBloc(src, SENT, 'XCHK', r));
  console.log('\npage.html : bloc XCHK mis à jour');
}
