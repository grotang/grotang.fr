#!/usr/bin/env node
/* Test de non-régression de la page publiée.
 *
 *   node tools/uefa/test-page.mjs [chemin.html]     (défaut : public/uefa/index.html)
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * Le site se republie seul, cinq fois par jour, sans personne devant. Les deux
 * contrôles existants regardent la MATIÈRE : refresh.mjs vérifie que les
 * chiffres de la source sont cohérents entre eux, crosscheck.mjs les confronte
 * à un second calcul. Aucun des deux n'ouvre la page. Celui-ci ouvre la page.
 *
 * Il attrape la seule catégorie d'erreur que rien d'autre ne voit : la mienne.
 * Une accolade coupée au mauvais endroit, un générateur aléatoire cassé, un
 * NaN qui traverse quatre blocs — tout ça s'est produit, et c'est GT qui l'a vu.
 *
 * DEUX RÉGIMES. Un échec BLOQUANT arrête le workflow avant le dépôt : la page
 * fautive ne sera jamais publiée, et le site continue de servir la dernière
 * version saine. Mieux vaut hier que faux. Un échec SIGNALANT s'affiche et
 * laisse passer : la page est lisible, elle mérite d'être publiée avec sa
 * réserve plutôt que retenue.
 *
 * Il doit rester PETIT. Une suite qui gonfle finit par échouer pour de
 * mauvaises raisons, et on prend l'habitude de l'ignorer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const FICHIER = path.resolve(process.argv[2] || 'public/uefa/index.html');
const dur = [], mou = [];
const bloquant = (nom, ok, detail = '') => (ok ? null : dur.push(`${nom}${detail ? ' — ' + detail : ''}`), ok);
const signalant = (nom, ok, detail = '') => (ok ? null : mou.push(`${nom}${detail ? ' — ' + detail : ''}`), ok);
const proche = (a, b, eps) => Math.abs(a - b) <= eps;

/* ---------- 1. l'arithmétique, sans navigateur ---------- */
const src = fs.readFileSync(FICHIER, 'utf8');
const bloc = (ouv, pre) => {
  const a = src.indexOf(ouv), b = src.indexOf(ouv.replace('_START', '_END'));
  if (a < 0 || b < 0) return null;
  return JSON.parse(src.slice(a + ouv.length, b).replace(new RegExp('^const ' + pre + '\\s*=\\s*'), '').replace(/;\s*$/, ''));
};
const D = bloc('/*DATA_START*/', 'D'), QUALS = bloc('/*QUAL_START*/', 'QUALS');

bloquant('bloc DATA lisible', !!D);
if (D) {
  const N = D.nations;
  bloquant('55 associations dans la source', N.length === 55, `${N?.length} lignes`);
  /* Le total à cinq ans est la somme des cinq saisons. Si cette égalité tombe,
     la source a changé de forme ou notre lecture a dérapé. */
  const faux = N.filter(n => !proche(n.t, n.y.reduce((a, v) => a + v, 0), 0.002));
  bloquant('total 5 ans = somme des saisons', faux.length === 0, faux.map(n => n.c).join(' '));
  /* Aucun coefficient négatif, aucun rang en double. */
  bloquant('aucun coefficient négatif', N.every(n => n.t >= 0 && n.y.every(v => v >= 0)));
  bloquant('rangs de 1 à 55', new Set(N.map(n => n.r)).size === 55);
  /* Le diviseur borne l'effectif en vie : on ne peut pas avoir plus de clubs
     vivants qu'engagés, ni un négatif. */
  const abs = N.filter(n => n.divisor && (n.a[3] > n.divisor || n.a[3] < 0));
  bloquant('clubs en vie ≤ clubs engagés', abs.length === 0, abs.map(n => n.c).join(' '));
}

bloquant('bloc QUAL lisible', !!QUALS);
if (D && QUALS) {
  /* Le grand livre doit retomber sur l'effectif publié, association par
     association. C'est le contrôle qui a trouvé le trou du Monténégro. */
  const BY = Object.fromEntries(D.nations.map(n => [n.c, n]));
  const ecarts = Object.entries(QUALS).filter(([c, q]) => BY[c] && q.s[3] !== BY[c].a[3]);
  bloquant('engagés − éliminés = encore en lice', ecarts.length === 0, ecarts.map(([c]) => c).join(' '));
  /* Une série de survie ne remonte jamais. */
  const remonte = Object.entries(QUALS).filter(([, q]) => q.s.some((v, i) => v > (i ? q.s[i-1] : q.e)));
  bloquant('la survie ne remonte jamais', remonte.length === 0, remonte.map(([c]) => c).join(' '));
}

/* ---------- 2. la page, dans un vrai navigateur ---------- */
/* Le navigateur vient de `npx playwright install chromium` sur le runner.
   PW_CHROMIUM permet d'en designer un deja present, pour ne pas le retelecharger. */
const EXE = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
const nav = await chromium.launch(EXE ? { executablePath: EXE } : {});
const page = await nav.newPage({ viewport: { width: 1440, height: 1200 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
await page.goto('file://' + FICHIER, { waitUntil: 'load' });
await page.waitForTimeout(2500);

/* Les ressources externes ne partent pas depuis un runner : ce n'est pas une
   régression de la page, on ne compte que les erreurs de code. */
const vraies = erreurs.filter(t => !/ERR_TUNNEL|ERR_NAME|net::|Failed to load resource/i.test(t));
bloquant('aucune erreur JavaScript', vraies.length === 0, vraies.slice(0, 3).join(' | '));

const vu = await page.evaluate(() => {
  const plein = s => { const e = document.querySelector(s); return !!e && (e.children.length > 0 || (e.textContent || '').trim().length > 0); };
  const BLOCS = ['#cal', '#bars', '#kbars', '#cl8', '#dbars', '#chartL', '#chartZ', '#mtx',
                 '#chartRdt', '#vlist', '#chartSurv', '#chartPrj', '#tProj'];
  const txt = document.body.innerText;
  const fr = [...document.querySelectorAll('#chartPrj text')].map(t => t.textContent);
  return {
    vides: BLOCS.filter(s => !plein(s)),
    sales: (txt.match(/\bNaN\b|\bundefined\b|\bInfinity\b/g) || []).slice(0, 5),
    nations: document.querySelectorAll('#vlist .vrow').length,
    lignesTab: document.querySelectorAll('#tAll tbody tr, #tAll tr').length,
    prj: fr.length,
    stamp: (document.getElementById('stamp')?.textContent || '').trim().length,
  };
});
bloquant('tous les blocs sont remplis', vu.vides.length === 0, vu.vides.join(' '));
bloquant('aucun NaN / undefined / Infinity affiché', vu.sales.length === 0, vu.sales.join(' '));
bloquant('les associations engagées sont listées', vu.nations >= 50, `${vu.nations} lignes`);
bloquant('la projection est tracée', vu.prj > 20, `${vu.prj} étiquettes`);
bloquant("l'horodatage est présent", vu.stamp > 0);

/* La projection France : une borne large, juste pour attraper l'absurde. */
const med = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#chartPrj text')].map(x => x.textContent);
  const i = t.findIndex(x => /^France$/.test(x.trim()));
  const n = t.map(x => parseFloat(String(x).replace(',', '.'))).filter(v => !isNaN(v) && v > 5 && v < 60);
  return { trouve: i >= 0, mini: Math.min(...n), maxi: Math.max(...n) };
});
signalant('projection dans une fourchette plausible', med.mini > 5 && med.maxi < 60, `${med.mini} … ${med.maxi}`);

/* Téléphone : la page ne doit pas déborder en largeur. */
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
const large = await page.evaluate(() => document.documentElement.scrollWidth);
signalant('pas de débordement horizontal à 390 px', large <= 392, `${large} px`);

await nav.close();

/* ---------- verdict ---------- */
const n = dur.length + mou.length;
console.log(`\n${path.basename(FICHIER)} — ${n === 0 ? 'tout est vert' : `${dur.length} bloquant(s), ${mou.length} signalant(s)`}`);
for (const m of dur) console.log('  ECHEC    ' + m);
for (const m of mou) console.log('  RESERVE  ' + m);
if (dur.length) { console.log('\nPublication interrompue : la derniere version saine reste en ligne.'); process.exit(1); }
console.log(mou.length ? '\nPublication autorisee, avec reserve.' : 'Publication autorisee.');
