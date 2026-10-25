#!/usr/bin/env node
/* Test de la page tennis, sans réseau.
 *
 * 1. Lecture d'un tableau : un tableau de 128 fabriqué ici, au format exact
 *    des pages Wikipédia (huit sections de 16 + carré final), avec des
 *    Français placés à la main, d'abord complet puis en cours de tournoi.
 * 2. data.json : les faits que l'histoire impose (un seul titre, Noah 1983 ;
 *    sept finales), les plafonds de chaque tour, le parcours des joueurs
 *    (il redonne le chiffre de chaque case) et les dates de chaque édition jouée.
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
const D = JSON.parse(fs.readFileSync(path.join(ICI, 'data.json'), 'utf8'));
ok(D.tours.join() === TOURS.join(), 'data.json : colonnes dans le bon ordre');
let titres = [], finales = [], plafond = true;
const MAX = [256, 128, 64, 16, 8, 4, 2, 1];
for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e)) {
  if (!Array.isArray(v)) { ok(v === null || ['?', 'C', 'ND'].includes(v), `${s} ${an} : valeur spéciale « ${v} »`); continue; }
  if (v.length !== 8 || v.some((x, i) => !Number.isInteger(x) || x < 0 || x > MAX[i])) { plafond = false; console.log('  hors plafond', s, an, v.join()); }
  if (v[7]) titres.push(s + an);
  if (v[6]) finales.push(s + an);
}
ok(plafond, 'data.json : chaque tour sous son plafond');
ok(titres.join() === 'RG1983', `data.json : titres ${titres.join(' ')}`);
ok(finales.length === 7, `data.json : ${finales.length} finales (${finales.join(' ')})`);
/* parcours des joueurs : ils redonnent exactement les chiffres de chaque case */
let parcOk = true;
for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e)) {
  if (!Array.isArray(v) || s === 'AOd') continue;
  const p = D.parcours?.[an]?.[s] || [];
  if (compteParcours(p).join() !== v.join() || p.some((x, j) => j % 2 === 0 && !D.joueurs[x])) { parcOk = false; console.log('  parcours', s, an); }
}
ok(parcOk, 'data.json : parcours des joueurs = chiffres de chaque case');
const champion = (D.parcours?.[1983]?.RG || []).filter((x, j) => j % 2 && x === 7).length === 1
  && D.joueurs[D.parcours[1983].RG[D.parcours[1983].RG.indexOf(7) - 1]] === 'Yannick Noah';
ok(champion, 'data.json : titre RG 1983 = Yannick Noah');
ok(new Set(D.joueurs).size === D.joueurs.length && Object.keys(D.alias || {}).every(k => !D.joueurs.includes(k)),
  `data.json : ${D.joueurs.length} joueurs, sans doublon ni graphie en double`);
let sansDate = [];
for (const [an, e] of Object.entries(D.editions)) for (const [s, v] of Object.entries(e))
  if (Array.isArray(v) && s !== 'AOd' && !D.dates?.[an]?.[s]) sansDate.push(s + an);
ok(sansDate.length === 0, `data.json : dates de chaque édition jouée${sansDate.length ? ' (manque ' + sansDate.join(' ') + ')' : ''}`);
ok(D.editions[2026] && D.editions[2026].WIM[0] === 15 && D.editions[2026].USO[0] === 13, 'data.json : 2026 WIM 15, USO 13 au 1er tour');

if (ko) { console.log(`\n${ko} échec(s).`); process.exit(1); }
console.log('\nTout est bon.');
