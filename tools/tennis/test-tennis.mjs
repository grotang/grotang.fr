#!/usr/bin/env node
/* Test de la page tennis, sans réseau.
 *
 * 1. Lecture d'un tableau : un tableau de 128 fabriqué ici, au format exact
 *    des pages Wikipédia (huit sections de 16 + carré final), avec des
 *    Français placés à la main, d'abord complet puis en cours de tournoi.
 * 2. data.json : les faits que l'histoire impose (un vainqueur par édition ;
 *    pour la France, Noah 1983 et sept finales ; quelques palmarès), les
 *    plafonds de chaque tour, une nation par joueur et par édition, et les
 *    dates de chaque édition jouée.
 *
 * Un échec arrête le workflow avant toute écriture. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireTableau, colonnes, nomsColonnes, lireDates, compteParcours, TOURS } from './wiki.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
let ko = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'ÉCHEC') + ' ' + msg); if (!cond) ko++; };

/* --- 1 · tableau fabriqué ------------------------------------------------ */
/* joueurs 0..127 ; les Français : 0, 5, 9, 17, 40, 64, 100. Le joueur de
   plus petit numéro gagne toujours : 0 est champion, 64 finaliste. */
const FR = new Set([0, 5, 9, 17, 40, 64, 100]);
const case_ = (j, gagne) => {
  if (j === null) return '';
  const c = `{{flagicon|${FR.has(j) ? 'FRA' : 'ESP'}}} [[Joueur ${j}|J ${j}]]`;
  return gagne ? `'''${c}'''` : c;
};
/* tours[r] = joueurs présents au tour r (0 = 1er tour, 128 joueurs) ;
   « jusque » = nombre de tours joués (les suivants restent vides) */
function fabrique(jusque) {
  const tours = [[...Array(128).keys()]];
  while (tours[tours.length - 1].length > 1) {
    const p = tours[tours.length - 1], s = [];
    for (let i = 0; i < p.length; i += 2) s.push(Math.min(p[i], p[i + 1]));
    tours.push(s);
  }
  const joue = r => r < jusque;           /* le tour r est-il joué ? */
  const present = r => r <= jusque;       /* ses places sont-elles connues ? */
  let t = "== Draw ==\n=== Finals ===\n{{8TeamBracket-Tennis5\n| RD1=Quarterfinals\n| RD2=Semifinals\n| RD3=Final\n";
  for (let d = 0; d < 3; d++) {
    const r = 4 + d;
    tours[r].forEach((j, i) => { t += `| RD${d + 1}-team${String(i + 1).padStart(2, '0')}=${present(r) ? case_(j, joue(r) && tours[r + 1].includes(j)) : ''}\n`; });
  }
  t += '}}\n\n=== Top half ===\n';
  for (let s = 0; s < 8; s++) {
    t += `==== Section ${s + 1} ====\n{{16TeamBracket-Compact-Tennis5\n| RD1=First round\n| RD2=Second round\n| RD3=Third round\n| RD4=Fourth round\n`;
    for (let d = 0; d < 4; d++) {
      const n = 16 >> d, lot = tours[d].slice(s * n, s * n + n);
      lot.forEach((j, i) => { t += `| RD${d + 1}-team${String(i + 1).padStart(2, '0')}=${present(d) ? case_(j, joue(d) && tours[d + 1].includes(j)) : ''}\n`; });
    }
    t += '}}\n';
  }
  return { t, tours };
}
const attendu = (tours, r) => tours[r].filter(j => FR.has(j)).length;

{
  const { t, tours } = fabrique(7);
  const c = colonnes(lireTableau(t));
  const n = TOURS.map(k => c[k][0]);
  const vrai = [0, 1, 2, 3, 4, 5, 6].map(r => attendu(tours, r)).concat([FR.has(tours[7][0]) ? 1 : 0]);
  ok(n.join() === vrai.join(), `tableau complet : ${n.join(' ')} (attendu ${vrai.join(' ')})`);
  ok(TOURS.every(k => c[k][1] === 'c'), 'tableau complet : tous les tours « c »');
  const nc = nomsColonnes(lireTableau(t));
  ok(TOURS.every(k => nc[k].length === c[k][0]), 'tableau complet : autant de noms que de Français à chaque tour');
  ok(nc.V.join() === 'Joueur 0' && nc.F.join() === 'Joueur 0,Joueur 64', `tableau complet : finale ${nc.F.join(' / ')}, titre ${nc.V.join()}`);
}
/* dates lues dans l'infobox, aux formats rencontrés sur les 233 éditions */
{
  const cas = [
    ['| date = 25 May – 8 June 2025', 2025, '2025-05-25,2025-06-08'],
    ['| date=12–25 January 1987', 1987, '1987-01-12,1987-01-25'],
    ['| date = August 27 – September 7', 1975, '1975-08-27,1975-09-07'],
    ['| date = 26 December 1973 – 1 January 1974', 1974, '1973-12-26,1974-01-01'],
  ];
  for (const [t, an, att] of cas) { const d = lireDates(t, an); ok(d && d.join() === att, `dates « ${t.replace(/^\|\s*date\s*=\s*/, '')} » → ${d && d.join(' / ')}`); }
}
{
  /* en cours : 1er tour joué, 2e tour connu, 3e tour vide */
  const { t, tours } = fabrique(1);
  const c = colonnes(lireTableau(t));
  ok(c.T1[0] === 7 && c.T1[1] === 'c', `en cours : 1er tour ${c.T1.join('/')}`);
  ok(c.T2[0] === attendu(tours, 1) && c.T2[1] === 'c', `en cours : 2e tour ${c.T2.join('/')}`);
  ok(c.T3[1] === 'v' && c.Q[1] === 'v' && c.V[1] === 'v', 'en cours : 3e tour, quarts, titre « v »');
}
{
  /* tableau à moitié rempli : un tour commencé */
  const { t } = fabrique(1);
  const moitie = t.replace(/(\| RD2-team0[1-4]=)[^\n]*/g, '$1');
  const c = colonnes(lireTableau(moitie));
  ok(c.T2[1] === 'p', `tour commencé : 2e tour « ${c.T2[1]} »`);
}

/* --- 2 · data.json -------------------------------------------------------- */
/* Les chiffres de chaque case se déduisent des parcours (nation par nation) :
   on vérifie les faits que l'histoire impose. */
const D = JSON.parse(fs.readFileSync(path.join(ICI, 'data.json'), 'utf8'));
ok(D.tours.join() === TOURS.join(), 'data.json : colonnes dans le bon ordre');
const MAX = [256, 128, 64, 16, 8, 4, 2, 1];
const cases = (nat) => { const out = []; for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e))
  if (v === 'J') out.push([an, s, compteParcours(D.parcours?.[an]?.[s]?.[nat] || [])]); return out; };
let speciaux = true, plafond = true, unTitre = true, idsOk = true;
for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e)) {
  if (v !== 'J') { if (!(v === null || ['?', 'C', 'ND'].includes(v))) { speciaux = false; console.log('  valeur', s, an, v); } continue; }
  const tot = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const f of Object.values(D.parcours?.[an]?.[s] || {})) {
    compteParcours(f).forEach((x, i) => tot[i] += x);
    if (f.some((x, j) => j % 2 === 0 && !D.joueurs[x])) idsOk = false;
  }
  if (tot.some((x, i) => x > MAX[i])) { plafond = false; console.log('  hors plafond', s, an, tot.join()); }
  if (!D.ouverts?.[an]?.[s] && tot[7] !== 1) { unTitre = false; console.log('  titres', s, an, tot[7]); }
}
ok(speciaux, 'data.json : valeurs spéciales connues');
ok(plafond, 'data.json : chaque tour sous son plafond, toutes nations réunies');
ok(unTitre, 'data.json : un vainqueur et un seul par édition close');
ok(idsOk, 'data.json : chaque parcours renvoie à un joueur connu');
const fr = cases('FRA').filter(c => c[1] !== 'AOd');
const titresFR = fr.filter(c => c[2][7]).map(c => c[1] + c[0]), finalesFR = fr.filter(c => c[2][6]).map(c => c[1] + c[0]);
ok(titresFR.join() === 'RG1983', `France : titres ${titresFR.join(' ')}`);
ok(finalesFR.length === 7, `France : ${finalesFR.length} finales (${finalesFR.join(' ')})`);
const noah = (D.parcours[1983].RG.FRA || []).findIndex((x, j) => j % 2 && x === 7);
ok(noah > 0 && D.joueurs[D.parcours[1983].RG.FRA[noah - 1]] === 'Yannick Noah', 'France : titre RG 1983 = Yannick Noah');
const n2026 = cases('FRA').filter(c => c[0] === '2026');
ok(n2026.find(c => c[1] === 'WIM')[2][0] === 15 && n2026.find(c => c[1] === 'USO')[2][0] === 13, 'France : 2026 WIM 15, USO 13 au 1er tour');
/* quelques palmarès connus */
const titresDe = nat => cases(nat).filter(c => c[1] !== 'AOd' && c[2][7]).length;
for (const [nat, n] of [['ESP', 36], ['SUI', 23], ['SRB', 24], ['SWE', 25], ['AUS', 20]])
  ok(titresDe(nat) >= n, `${nat} : ${titresDe(nat)} titres (au moins ${n})`);
const ger = cases('GER').filter(c => +c[0] <= 1996 && c[2][7]).length;
ok(ger === 7, `Allemagne (RFA comprise) : ${ger} titres jusqu'en 1996 (Becker 6, Stich 1)`);
const medv = D.joueurs.indexOf('Daniil Medvedev');
ok(medv >= 0 && (D.parcours[2023].USO.RUS || []).some((x, j) => j % 2 === 0 && x === medv), 'bannière neutre : Medvedev compté avec la Russie (USO 2023)');
ok(new Set(D.joueurs).size === D.joueurs.length && Object.keys(D.alias || {}).every(k => !D.joueurs.includes(k)),
  `data.json : ${D.joueurs.length} joueurs, sans doublon ni graphie en double`);
/* un joueur, une nation par édition */
let uneNation = true;
for (const [an, e] of Object.entries(D.parcours)) for (const [s, p] of Object.entries(e)) {
  const vu = new Set();
  for (const f of Object.values(p)) for (let j = 0; j < f.length; j += 2) { if (vu.has(f[j])) { uneNation = false; console.log('  deux nations', s, an, D.joueurs[f[j]]); } vu.add(f[j]); }
}
ok(uneNation, 'data.json : une seule nation par joueur et par édition');
let sansDate = [];
for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e))
  if (v === 'J' && s !== 'AOd' && !D.dates?.[an]?.[s]) sansDate.push(s + an);
ok(sansDate.length === 0, `data.json : dates de chaque édition jouée${sansDate.length ? ' (manque ' + sansDate.join(' ') + ')' : ''}`);

if (ko) { console.log(`\n${ko} échec(s).`); process.exit(1); }
console.log('\nTout est bon.');
