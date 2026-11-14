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
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { url } from '../site.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const PAGE = path.join(ICI, 'page.html');
const BATI = path.join(RACINE, 'public', url('uefa'), 'index.html');   // adresse lue dans le registre (tools/site.mjs)
const SENT = ['/*PRJ_START*/', '/*PRJ_END*/'];
const N = Number(process.argv[2] || 100000);
/* BASCULE (12/11/2026) : semaine du passage de la force des nations à la force des
   clubs. La ligne « nations » du 2b s'arrête là, la ligne « clubs » commence là. */
const BASCULE = '2026-11-02';

if (!fs.existsSync(BATI)) { console.error(BATI + ' absent : lancer le build d\'abord.'); process.exit(2); }

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
let INFO = null;
try { INFO = await page.evaluate(() => window.__semaines ? window.__semaines() : null); } catch (e) { INFO = null; }

if (boum.length) { console.error('erreur dans la page :', boum[0]); process.exit(1); }
const nations = Object.keys(R.q.tir || {}).length;
if (!nations) { console.error('projection vide : champ de competition incomplet, rien n\'est incruste.'); process.exit(1); }

/* Les contrôles de conservation du modèle remontent tels quels : 90 points de
   phase finale par compétition, 45/30/15 de bonus de tour, 75/75/42 de bonus de
   rang. À cent mille tirages ils doivent tomber au centième. */
if (R.ecarts && R.ecarts.length) { console.error('controles de conservation en echec :', R.ecarts.join(' · ')); process.exit(1); }

/* Contrôle des matchs restants (voir simule() dans page.html) : en cas d'écart,
   la projection n'est PAS mise à jour — elle garde sa dernière valeur juste —
   mais la page, elle, est publiée. Le drapeau laissé dans le dossier temporaire
   fait échouer la dernière étape du robot, APRÈS la publication : GitHub envoie
   alors son e-mail « Run failed ». */
const DRAPEAU = path.join(os.tmpdir(), 'grotang-projection-bloquee.txt');
const cal = R.calendrier || { bloque: [], tolere: [] };
for (const t of cal.tolere) console.log('controle des matchs restants, ecart tolere :', t);
if (cal.bloque.length) {
  const txt = 'Projection non mise a jour : ' + cal.bloque.join(' · ');
  console.log('::warning::' + txt);
  fs.writeFileSync(DRAPEAU, txt + '\n');
  execFileSync(process.execPath, [path.join(RACINE, 'tools/build.mjs')], { stdio: 'inherit' });
  process.exit(0);
}
if (fs.existsSync(DRAPEAU)) fs.unlinkSync(DRAPEAU);

let PS = null;
try { if (INFO) PS = await historique(nav, INFO); } catch (e) { console.log('historique en echec, valeurs precedentes gardees :', e.message); }
await nav.close();

const src = fs.readFileSync(PAGE, 'utf8');
const a = src.indexOf(SENT[0]), b = src.indexOf(SENT[1]);
if (a < 0 || b < 0) { console.error('sentinelles PRJ introuvables dans page.html'); process.exit(2); }
let out = src.slice(0, a) + SENT[0] + 'const PRJ = ' + JSON.stringify(R) + ';' + src.slice(b);
/* PSEM : on fusionne avec l'existant, une semaine sautée garde sa valeur précédente */
const PA = out.indexOf('/*PSEM_START*/'), PB = out.indexOf('/*PSEM_END*/');
if (PS && PA >= 0 && PB > PA) {
  let avant = null; try { avant = JSON.parse(out.slice(PA + 14, PB).replace(/^const PSEM = /, '').replace(/;$/, '')); } catch (e) { avant = null; }
  const s = { ...((avant && avant.s) || {}), ...PS.s }, c = { ...((avant && avant.c) || {}), ...(PS.c || {}) };
  out = out.slice(0, PA) + '/*PSEM_START*/const PSEM = ' + JSON.stringify({ ...PS, s, c }) + ';' + out.slice(PB);
  console.log(`page.html : bloc PSEM mis a jour (${Object.keys(PS.s).length} semaines « nations », ${Object.keys(PS.c || {}).length} « clubs » calculees)`);
}
fs.writeFileSync(PAGE + '.tmp', out); fs.renameSync(PAGE + '.tmp', PAGE);

console.log(`${R.n.toLocaleString('fr-FR')} saisons simulees en ${sec} s · ${nations} nations · controles de conservation OK`);
console.log('page.html : bloc PRJ mis a jour');
execFileSync(process.execPath, [path.join(RACINE, 'tools/build.mjs')], { stdio: 'inherit' });
/* la gazette (bloc 2c) : rangée dans tools/uefa/archive/gazettes.json, une page par semaine (06/11/2026) */
try { execFileSync(process.execPath, [path.join(ICI, 'gazettes.mjs')], { stdio: 'inherit' }); } catch (e) { console.log('gazettes : echec, fichier precedent garde'); }


/* 2b · CHANCES DE LA FRANCE, SEMAINE PAR SEMAINE (06/11/2026, demande de GT).
   Pour chaque semaine européenne close de la saison (fin de l'été comprise), on
   remet la page dans l'état des données au soir du dernier match de la semaine,
   et on relance le MÊME modèle (__projette) :
   - SEM : les scores des matchs de phase de ligue postérieurs sont effacés ;
   - D.eff : le bilan V/N/D de phase de ligue de chaque club est recompté sur les
     scores Wikipédia jusqu'à cette date (garde-fou : tous les matchs passés à
     cette date doivent avoir leur score, sinon la semaine est sautée) ;
   - D.series, D.nations (t, y[4], tp, r, g) : recalés sur le cumul de la
     semaine que calcule le bloc 2b (window.__semaines), le même que celui affiché ;
   - D.meta.lastUpdated : le dernier jour de la semaine, 23:59 (heure et graine).
   On ne recolle JAMAIS d'anciennes valeurs de PRJ : elles viennent d'anciennes
   versions du modèle. Tout est recalculé à chaque passage, avec le modèle du
   jour (environ 5 s par semaine à 40 000 saisons). L'été n'est pas rembobiné
   (il faudrait reconstituer qui était encore en course). En cas d'échec, la
   valeur précédente reste : la projection principale n'est jamais bloquée.
   Par semaine on garde (06/11, pour la gazette 2c) : rg = rang final de la
   France (rgFR), med = coefficient de saison médian projeté de chaque nation
   (q.tir), pr = le pronostic 1N2 des matchs de la semaine SUIVANTE, tels que le
   modèle les voyait avant de les jouer ([compétition, domicile, extérieur,
   victoire domicile, victoire extérieur]). */
/* DEUX SÉRIES DEPUIS LA FORCE DES CLUBS (GT, 12/11/2026). Tant que la page n'a
   pas de forces (FORCE = null), rien ne change : s = le modèle du jour, recalculé.
   Dès que FORCE est là :
   - PSEM.s = le modèle INITIAL (force des nations), pour les semaines jusqu'à la
     BASCULE comprise, recalculé UNE fois en forçant FORCE = null, puis figé
     (marque m: 'n') ;
   - PSEM.c = le modèle avec la force des clubs, pour les semaines à partir de la
     BASCULE, calculé une fois la semaine close, puis figé (les forces bougent
     chaque semaine : recalculer une semaine passée avec les forces du jour lui
     ferait voir l'avenir). */
async function historique(nav, info) {
  const NH = 40000, html = fs.readFileSync(BATI, 'utf8');
  const forceActif = /\/\*FORCE_START\*\/const FORCE = \{/.test(html);
  let avant = {}; try { const p = fs.readFileSync(PAGE, 'utf8'), a = p.indexOf('/*PSEM_START*/'), b = p.indexOf('/*PSEM_END*/');
    avant = JSON.parse(p.slice(a + 14, b).replace(/^const PSEM = /, '').replace(/;$/, '')); } catch (e) { avant = {}; }
  const sN = {}, sC = {};
  const lit = (deb, fin) => { const a = html.indexOf(deb), b = html.indexOf(fin, a); return a < 0 || b < 0 ? null : [a + deb.length, b]; };
  const pD = lit('/*DATA_START*/const D = ', ';/*DATA_END*/'), pS = lit('/*SEM_START*/const SEM = ', ';/*SEM_END*/');
  if (!pD || !pS) { console.log('historique : sentinelles DATA/SEM introuvables, rien de calcule'); return null; }
  const D0 = JSON.parse(html.slice(...pD)), S0 = JSON.parse(html.slice(...pS));
  const ligue = m => typeof m[3] === 'number' && m[3] <= 7;
  const cibles = info.weeks.map((k, i) => ({ ...k, i })).filter(k => (k.i < info.lastW || (forceActif && k.w === BASCULE && k.i <= info.lastW))
    && (k.ph === 0 || (k.ph === 1 && info.weeks[k.i + 1] && info.weeks[k.i + 1].ph === 0)));
  const tmp = path.join(os.tmpdir(), 'grotang-rembobine.html');
  const onglet = await nav.newPage(); const err = []; onglet.on('pageerror', e => err.push(e.message));
  for (const k of cibles) {
    const needN = !forceActif || (k.w <= BASCULE && !(avant.s && avant.s[k.w] && avant.s[k.w].m === 'n'));
    const needC = forceActif && k.w >= BASCULE && k.i < info.lastW && !(avant.c && avant.c[k.w]);
    if (!needN && !needC) continue;
    const cut = k.d1;
    /* phase finale (j 8-12) postérieure à la semaine : retirée, pas seulement vidée de ses
       scores (C25, 14/11/2026) ; le moteur s'en sert désormais, la semaine rembobinée
       ne doit pas connaître un tirage qui n'avait pas eu lieu */
    const SEM = S0.filter(m => !(typeof m[3] === 'number' && m[3] >= 8 && m[0] > cut))
      .map(m => ligue(m) && m[0] > cut ? [...m.slice(0, 8), null, null, ...m.slice(10)] : m);
    const passes = S0.filter(m => ligue(m) && m[0] <= cut);
    if (passes.some(m => m[8] == null)) { console.log(`historique ${k.w} : scores manquants, semaine sautee`); continue; }
    const D = JSON.parse(JSON.stringify(D0)), bil = {};
    for (const m of passes) for (const [n, a, b] of [[m[4], m[8], m[9]], [m[6], m[9], m[8]]]) {
      const t = bil[n + '|' + m[2]] = bil[n + '|' + m[2]] || [0, 0, 0]; t[a > b ? 0 : a === b ? 1 : 2]++; }
    for (const c in D.eff || {}) for (const r of D.eff[c]) { if (r.length < 10 || r[1] > 2) continue;
      const t = bil[r[0] + '|' + r[1]] || [0, 0, 0];
      r[3] = +(r[3] - 2 * (r[7] - t[0]) - (r[8] - t[1])).toFixed(3); r[7] = t[0]; r[8] = t[1]; r[9] = t[2]; }
    for (const n of D.nations) { const T = info.T[n.c]; if (!T || T[k.i] == null) continue;
      const Tw = T[k.i], dy = n.t - Tw, d = n.y[4] ? n.tp / n.y[4] : (n.divisor || 1);
      n.t = +Tw.toFixed(3); n.y[4] = +(n.y[4] - dy).toFixed(3); n.tp = +(n.tp - dy * d).toFixed(3);
      const S = D.series && D.series[n.c];
      if (S && S.m) { let prev = S.q[S.q.length - 1][0];
        S.m = S.m.map(x => { const cum = Math.min(x[0], Tw), g = cum - prev; prev = cum; return [+cum.toFixed(3), +g.toFixed(3), x[2]]; }); } }
    const tete = Math.max(...D.nations.map(n => n.t));
    [...D.nations].sort((a, b) => b.t - a.t).forEach((n, j) => { n.r = j + 1; n.g = +(tete - n.t).toFixed(3); });
    const [y, mo, j] = cut.split('-'); D.meta.lastUpdated = `${j}/${mo}/${y} - 23:59`;
    /* les deux blocs sont remplacés du dernier au premier : les positions restent justes */
    const morceaux = [[pD, JSON.stringify(D)], [pS, JSON.stringify(SEM)]].sort((x, y) => y[0][0] - x[0][0]);
    let out = html; for (const [[a, b], v] of morceaux) out = out.slice(0, a) + v + out.slice(b);
    const sansForce = out.replace(/\/\*FORCE_START\*\/[\s\S]*?\/\*FORCE_END\*\//, '/*FORCE_START*/const FORCE = null;/*FORCE_END*/');
    const essais = forceActif ? [needN && ['n', sansForce], needC && ['c', out]].filter(Boolean) : [['s', out]];
    for (const [modele, page2] of essais) {
    fs.writeFileSync(tmp, page2); err.length = 0;
    await onglet.goto('file://' + tmp, { waitUntil: 'load' });
    await onglet.waitForFunction(() => typeof window.__projette === 'function', null, { timeout: 15000 });
    const H = await onglet.evaluate(n => { const r = window.__projette(n);
      return { rg: r.rgFR, med: Object.fromEntries(Object.entries((r.q || {}).tir || {}).map(([c, v]) => [c, v[2]])), pr: r.pronos || [],
        bloque: (r.calendrier || {}).bloque || [], ecarts: r.ecarts || [] }; }, NH);
    if (err.length || !H.rg || H.bloque.length || H.ecarts.length) {
      console.log(`historique ${k.w} (${modele}) : semaine sautee (${err[0] || H.bloque[0] || H.ecarts[0] || 'pas de rang'})`); continue; }
    /* les pronostics de la semaine suivante seulement */
    const nx = info.weeks[k.i + 1], fin7 = nx ? (() => { const d = new Date(nx.w + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })() : null;
    const date = new Map(S0.filter(ligue).map(m => [m[2] + '|' + m[4] + '|' + m[6], (Array.isArray(m[10]) && m[10][0]) || m[0]]));
    const pr = nx ? H.pr.filter(p => { const d = date.get(p[0] + '|' + p[1] + '|' + p[2]); return d && d >= nx.w && d <= fin7; }) : [];
    const val = { rg: H.rg.map(v => +v.toFixed(4)), med: Object.fromEntries(Object.entries(H.med).map(([c, v]) => [c, +v.toFixed(3)])), pr };
    if (modele === 'c') sC[k.w] = val; else sN[k.w] = modele === 'n' ? { ...val, m: 'n' } : val;
    console.log(`historique ${k.w} (${modele === 'c' ? 'clubs' : 'nations'}) : France dans les 5 premieres ${(H.rg.slice(0, 5).reduce((a, b) => a + b, 0) * 100).toFixed(1)} %`);
    }
  }
  await onglet.close(); if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  return { n: NH, maj: D0.meta.lastUpdated, s: sN, c: sC };
}
