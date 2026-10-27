#!/usr/bin/env node
/* Test sans réseau de tools/eco/data.json.
 *
 * Les contrôles de eurostat.mjs portent sur la réponse d'Eurostat AVANT
 * écriture. Celui-ci relit le fichier tel qu'il est dans le dépôt, celui que
 * la page affichera : identités comptables au million près (les séries sont
 * arrondies au million, d'où quelques unités de tolérance), et quelques
 * repères connus qui ne doivent pas bouger d'une révision à l'autre. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REC, DEP, SECTEURS } from './eurostat.mjs';

const D = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'data.json'), 'utf8'));
let ko = 0;
const ok = (c, m) => { console.log(c ? '  ok ' : 'ÉCHEC', m); if (!c) ko++; };
const i = y => D.an.indexOf(y);

ok(D.an[0] === 1995 && D.an.at(-1) === D.der && D.an.length === D.der - 1994, `années 1995 → ${D.der}`);
ok(D.derF <= D.der && D.derT <= D.der && D.ue.an <= D.der, `fonctions ${D.derF}, impôts ${D.derT}, Europe ${D.ue.an}`);
for (const k of ['pib', 'pop', 'dette']) ok(D[k].length === D.an.length && D[k].every(v => v > 0), `${k} complet`);

let n = 0;
for (const s of SECTEURS) for (const y of D.an) {
  const A = D.agg[s], k = i(y), v = c => (A[c] || [])[k] || 0;
  const sR = REC.reduce((a, c) => a + v(c), 0), sE = DEP.reduce((a, c) => a + v(c), 0);
  if (Math.abs(sR - v('TR')) > 6 || Math.abs(sE - v('TE')) > 8 || Math.abs(v('TR') - v('TE') - v('B9')) > 2) {
    ok(false, `${y} ${s} : identité rompue (TR ${v('TR')} / Σ ${sR}, TE ${v('TE')} / Σ ${sE}, B9 ${v('B9')})`); n++; }
}
ok(n === 0, `recettes = Σ composantes, dépenses = Σ natures, solde = R − D, ${SECTEURS.length} secteurs × ${D.an.length} ans`);

n = 0;
for (const s of SECTEURS) for (const y of D.an.filter(y => y <= D.derF)) {
  const C = D.cofog[s], k = i(y), n1 = Object.keys(C).filter(c => /^GF\d\d$/.test(c));
  const s1 = n1.reduce((a, c) => a + C[c][k], 0);
  if (Math.abs(s1 - C.TOTAL[k]) > 8) { n++; ok(false, `${y} ${s} : Σ fonctions ${s1} ≠ ${C.TOTAL[k]}`); }
  for (const c of n1) {
    const s2 = Object.keys(C).filter(x => x.length === 6 && x.startsWith(c)).reduce((a, x) => a + C[x][k], 0);
    if (Math.abs(s2 - C[c][k]) > 10) { n++; ok(false, `${y} ${s} ${c} : Σ sous-fonctions ${s2} ≠ ${C[c][k]}`); }
  }
}
ok(n === 0, `COFOG : total = Σ 10 fonctions = Σ sous-fonctions, 1995 → ${D.derF}, 4 secteurs`);

n = 0;
{ const N = D.natf, k0 = D.an.indexOf(N.debut);
  for (const [c, o] of Object.entries(N.c)) for (let i = 0; D.an[k0 + i] <= D.derF; i++) {
    const sn = Object.values(o).reduce((a, z) => a + (z[i] || 0), 0), t = D.cofog.S13[c][k0 + i];
    if (Math.abs(sn - t) > Math.max(12, Math.abs(t) * 0.003)) { n++; if (n < 4) ok(false, `${D.an[k0 + i]} ${c} : Σ natures ${sn} ≠ ${t}`); }
  } }
ok(n === 0, `chaque poste = Σ de ses natures, ${D.natf.debut} → ${D.derF}`);

for (const g of D.ue.geo) {
  const C = D.ue.cofog[g], s = Object.keys(C).filter(c => /^GF\d\d$/.test(c)).reduce((a, c) => a + C[c], 0);
  ok(Math.abs(s - C.TOTAL) <= 0.6, `Europe ${g} : Σ fonctions ${s.toFixed(1)} ≈ ${C.TOTAL} % du PIB (arrondis au dixième)`);
}

/* Repères (Eurostat, millésime d'octobre 2026). Une révision les déplace de
   quelques dixièmes, pas plus : au-delà, c'est la lecture qui a changé. */
const pc = (s, y) => s[i(y)] / D.pib[i(y)] * 100;
ok(Math.abs(pc(D.agg.S13.TE, 2023) - 56.8) < 0.5, `2023 : dépenses ${pc(D.agg.S13.TE, 2023).toFixed(1)} % du PIB (≈ 56,8)`);
ok(Math.abs(pc(D.agg.S13.TE, 2020) - 61.7) < 0.5, `2020 : dépenses ${pc(D.agg.S13.TE, 2020).toFixed(1)} % du PIB (≈ 61,7, covid)`);
ok(D.cofog.S13.GF10[i(2023)] / D.cofog.S13.TOTAL[i(2023)] > 0.38, '2023 : la protection sociale dépasse 38 % de la dépense');
ok(D.cofog.S13.GF1002[i(2023)] > D.cofog.S13.GF07[i(2023)], '2023 : la vieillesse pèse plus que toute la santé');

if (ko) { console.error(`\n${ko} échec(s).`); process.exit(1); }
console.log('\ndata.json : tout est cohérent.');

/* retraites.json (Drees) : la distribution relevée doit redonner la moyenne
   publiée, et la masse reconstituée (effectif × moyenne × 12) la masse publiée
   des pensions de droit direct, à l'écart des retraités vivant à l'étranger près. */
{
  const R = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'retraites.json'), 'utf8'));
  const d = R.distribution, q = d.queue;
  const s = d.parts.reduce((a, b) => a + b, 0) + d.au_dessus_4500;
  const moy = (d.parts.reduce((a, p, i) => a + p * (i + 0.5) * d.pas, 0) + (d.au_dessus_4500 - q.part) * (4500 + q.seuil) / 2 + q.part * q.moyenne) / 100;
  const A0 = R.annees[R.masse_annee], masse = A0.effectif * A0.moyenne_brute * 12 / 1e9;
  console.log(Math.abs(s - 100) < 0.05 ? '  ok ' : 'ÉCHEC', `retraites : parts sommées ${s.toFixed(1)} %`); if (Math.abs(s - 100) >= 0.05) process.exitCode = 1;
  console.log(Math.abs(moy / d.moyenne_publiee - 1) < 0.01 ? '  ok ' : 'ÉCHEC', `retraites : moyenne reconstituée ${moy.toFixed(0)} € = publiée ${d.moyenne_publiee} € (fin 2020)`); if (Math.abs(moy / d.moyenne_publiee - 1) >= 0.01) process.exitCode = 1;
  for (const [y, a] of Object.entries(R.annees)) if (!(a.effectif > 1e7 && a.moyenne_brute > 1000 && a.moyenne_nette < a.moyenne_brute && a.smic_net > 1000)) { console.log('ÉCHEC', `retraites : année ${y} incomplète`); process.exitCode = 1; }
  console.log(Math.abs(masse / R.masse_droit_direct_md - 1) < 0.03 ? '  ok ' : 'ÉCHEC', `retraites : masse reconstituée ${masse.toFixed(1)} Md€ ≈ publiée ${R.masse_droit_direct_md} Md€ (${R.masse_annee})`); if (Math.abs(masse / R.masse_droit_direct_md - 1) >= 0.03) process.exitCode = 1;
}
