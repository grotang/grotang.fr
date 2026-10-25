#!/usr/bin/env node
/* Rafraîchissement de la page tennis (/tennis/) : les Français tour par tour
 * dans les quatre Grands Chelems, simple messieurs.
 *
 * Source : les pages Wikipédia (en) « AAAA <tournoi> – Men's singles », lues
 * par l'API de Wikimédia avec un User-Agent qui dit qui on est. Le tableau y
 * est rempli au fil du tournoi, souvent dans l'heure qui suit chaque match.
 *
 * Ce que fait un passage :
 *   1. CONTRÔLE DE RÉFÉRENCE : relit une édition close (Roland-Garros 2025) et
 *      exige les chiffres déjà validés. Si Wikipédia change la forme de ses
 *      tableaux, on l'apprend ici, et rien n'est écrit.
 *   2. Relit les éditions de l'année en cours (et celles de l'an passé encore
 *      ouvertes, au passage du 1er janvier). Une page absente ou sans tableau
 *      = « à venir ». Une édition close (finale jouée, tous les tours remplis)
 *      n'est plus relue.
 *      Avec les chiffres, les noms des Français de chaque tour (infobulles et
 *      tableau des joueurs ; un nom inconnu est ramené au titre de son article
 *      Wikipédia, pour qu'un même joueur ne compte pas deux fois), et les
 *      dates de chaque tournoi, lues une fois dans la page du tournoi.
 *   3. Contrôles de cohérence sur chaque édition relue (voir controle()). Une
 *      édition qui échoue garde ses chiffres de la veille.
 *   4. Réécrit tools/tennis/data.json SEULEMENT si un chiffre a bougé (pas
 *      d'horodatage dedans : pas de commit parasite).
 *
 * Sortie : code 0 dans tous les cas où la page reste juste (même datée). Un
 * contrôle en échec dépose une alarme dans le dossier temporaire ; le workflow
 * échoue en toute fin, après publication, pour que GitHub envoie son e-mail.
 *
 * Options : --annee AAAA (relire une autre année), --dry-run (ne rien écrire). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireTableau, colonnes, nomsColonnes, parcoursEdition, parcoursVersData, compteParcours, lireDates, ecrireData, TOURS } from './wiki.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const FICHIER = path.join(ICI, 'data.json');
const ALARME = path.join(os.tmpdir(), 'grotang-tennis-alarme.txt');
const UA = 'grotang.fr-robot/1.0 (https://grotang.fr/tennis/; Français en Grand Chelem, quelques pages par jour)';
const SLAMS = { AO: 'Australian Open', RG: 'French Open', WIM: 'Wimbledon Championships', USO: 'US Open' };
const titre = (an, s) => `${an} ${SLAMS[s]} – Men's singles`;
/* la page du tournoi (dates dans l'infobox) ; « US Open » seul est une page d'homonymie */
const titreTournoi = (an, s) => `${an} ${SLAMS[s]}${s === 'USO' ? ' (tennis)' : ''}`;

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const iA = args.indexOf('--annee');
const AN = iA >= 0 ? +args[iA + 1] : new Date().getUTCFullYear();

/* Le wikitexte d'une page ; null si elle n'existe pas (encore). Deux portes :
   si Wikimédia en ferme une, l'autre sert. */
async function wikitexte(t) {
  const H = { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } };
  const e = encodeURIComponent(t);
  for (let essai = 1; ; essai++) {
    try {
      let err = '';
      const r1 = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${e}`,
        { ...H, signal: AbortSignal.timeout(30_000) });
      if (r1.ok) {
        const p = (await r1.json()).query?.pages?.[0];
        if (p && p.missing) return null;
        const s = p?.revisions?.[0]?.slots?.main?.content;
        if (typeof s === 'string') return s;
        err += ' api:vide';
      } else err += ' api:' + r1.status;
      const r2 = await fetch(`https://en.wikipedia.org/w/index.php?action=raw&title=${e}`, { ...H, signal: AbortSignal.timeout(30_000) });
      if (r2.status === 404) return null;
      if (r2.ok) return await r2.text();
      throw new Error('HTTP' + err + ' raw:' + r2.status);
    } catch (x) {
      if (essai >= 3) throw new Error(`${t} : ${x.message}`);
      await new Promise(r => setTimeout(r, 3000 * essai));
    }
  }
}

/* Graphie → titre de l'article (« Eric Deblicker » → « Éric Deblicker »),
   par l'API de Wikimédia, 50 noms par requête. Seules les redirections
   sont renvoyées. */
async function redirections(noms) {
  const out = {};
  for (let i = 0; i < noms.length; i += 50) {
    const lot = noms.slice(i, i + 50);
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(lot.join('|'))}`,
      { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const q = (await r.json()).query || {};
    const norm = Object.fromEntries((q.normalized || []).map(n => [n.to, n.from]));
    for (const x of q.redirects || []) out[norm[x.from] || x.from] = x.to.replace(/\s*\([^)]*\)\s*$/, '');
  }
  return out;
}

/* chiffres et état de chaque colonne (c complet, p commencé, v à venir) */
function lire(t) {
  const L = lireTableau(t);
  if (!L) return null;
  const c = colonnes(L);
  const nc = nomsColonnes(L);
  return { n: TOURS.map(k => c[k] ? c[k][0] : null), etat: TOURS.map(k => c[k] ? c[k][1] : 'c').join(''), alertes: L.alertes,
           nc: TOURS.map(k => nc[k] ? nc[k].length : null), noms: nc };
}

/* Ce qui doit tomber juste sur toute édition, close ou en cours. */
function controle(r) {
  const plafond = [256, 128, 64, 16, 8, 4, 2, 1];
  const pb = [];
  r.n.forEach((v, i) => {
    if (v === null) return;
    if (!Number.isInteger(v) || v < 0 || v > plafond[i]) pb.push(`${TOURS[i]} = ${v}`);
  });
  /* on ne peut pas être plus nombreux au tour suivant (sauf 3e tour → 8es,
     qui peuvent être le même tour sur un vieux tableau de 64) */
  for (let i = 0; i < 7; i++)
    if (r.n[i] !== null && r.n[i + 1] !== null && r.n[i + 1] > r.n[i] && r.etat[i] === 'c' && i !== 2)
      pb.push(`${TOURS[i + 1]} (${r.n[i + 1]}) > ${TOURS[i]} (${r.n[i]})`);
  /* les noms relevés doivent retomber sur les chiffres */
  r.n.forEach((v, i) => { if (v !== null && r.etat[i] !== 'v' && r.nc[i] !== v) pb.push(`${TOURS[i]} : ${r.nc[i]} noms pour ${v} Français`); });
  return pb.concat(r.alertes.filter(a => !/deviné/.test(a)));
}

const data = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const alarmes = [];

/* 1 · contrôle de référence */
{
  const REF = { an: 2025, s: 'RG', n: [18, 9, 2, 0, 0, 0, 0, 0] };
  const t = await wikitexte(titre(REF.an, REF.s));
  const r = t && lire(t);
  if (!r || r.n.join() !== REF.n.join()) {
    const msg = `Contrôle de référence en échec : ${REF.s} ${REF.an} relu ${r ? r.n.join(',') : 'illisible'}, attendu ${REF.n.join(',')}. Rien n'est écrit.`;
    console.log('::error::' + msg);
    fs.writeFileSync(ALARME, msg);
    process.exit(0);
  }
  console.log(`Contrôle de référence : ${REF.s} ${REF.an} = ${r.n.join(' ')} — OK`);
}

/* 2 · éditions à relire */
const aRelire = [];
for (const an of [AN - 1, AN]) {
  for (const s of Object.keys(SLAMS)) {
    const v = data.editions[an]?.[s];
    const ouvert = data.ouverts?.[an]?.[s];
    if (an === AN - 1 && !ouvert && v !== '?') continue;
    if (an === AN && Array.isArray(v) && !ouvert) continue; /* close */
    if (typeof v === 'string' && v !== '?') continue;        /* annulé, non disputé */
    aRelire.push([an, s]);
  }
}

let change = false;
for (const [an, s] of aRelire) {
  let t;
  try { t = await wikitexte(titre(an, s)); }
  catch (e) { console.log(`${s} ${an} : lecture impossible (${e.message}) — chiffres de la veille gardés`); continue; }
  const r = t && lire(t);
  const ed = data.editions[an] = data.editions[an] || {};
  if (!r || r.n[0] === null || r.etat[0] === 'v') {
    /* pas encore de tableau : « à venir » */
    if (ed[s] !== '?') { ed[s] = '?'; change = true; }
    if (data.ouverts?.[an]?.[s]) { delete data.ouverts[an][s]; change = true; }
    console.log(`${s} ${an} : à venir`);
    continue;
  }
  const pb = controle(r);
  if (pb.length) {
    const msg = `${s} ${an} : ${pb.join(' ; ')} — chiffres de la veille gardés`;
    console.log('::warning::' + msg);
    alarmes.push(msg);
    continue;
  }
  const clos = /^c+$/.test(r.etat);
  /* les joueurs : graphies nouvelles ramenées au titre de leur article */
  data.alias = data.alias || {}; data.joueurs = data.joueurs || [];
  const inconnus = [...new Set(Object.values(r.noms).flat().filter(Boolean))]
    .filter(n => !data.joueurs.includes(n) && !data.alias[n]);
  if (inconnus.length) try {
    for (const [de, vers] of Object.entries(await redirections(inconnus))) data.alias[de] = vers;
  } catch (e) { console.log(`${s} ${an} : redirections non vérifiées (${e.message})`); }
  const joueursAvant = data.joueurs.length;
  const parc = parcoursVersData(data, parcoursEdition(r.noms, n => data.alias[n] || n));
  if (compteParcours(parc).join() !== r.n.map(v => v ?? 0).join()) {
    data.joueurs.length = joueursAvant;
    const msg = `${s} ${an} : parcours des joueurs incohérent avec les chiffres — chiffres de la veille gardés`;
    console.log('::warning::' + msg); alarmes.push(msg); continue;
  }
  const avant = JSON.stringify([ed[s], data.ouverts?.[an]?.[s] || null, data.parcours?.[an]?.[s] || null]);
  ed[s] = r.n;
  data.parcours = data.parcours || {};
  if (parc.length) (data.parcours[an] = data.parcours[an] || {})[s] = parc;
  else if (data.parcours[an]) { delete data.parcours[an][s]; if (!Object.keys(data.parcours[an]).length) delete data.parcours[an]; }
  data.ouverts = data.ouverts || {};
  if (clos) { if (data.ouverts[an]) delete data.ouverts[an][s]; }
  else (data.ouverts[an] = data.ouverts[an] || {})[s] = r.etat;
  if (data.ouverts[an] && !Object.keys(data.ouverts[an]).length) delete data.ouverts[an];
  if (JSON.stringify([ed[s], data.ouverts?.[an]?.[s] || null, data.parcours?.[an]?.[s] || null]) !== avant || data.joueurs.length !== joueursAvant) change = true;
  console.log(`${s} ${an} : ${r.n.map(v => v ?? '-').join(' ')}  [${r.etat}]${clos ? ' close' : ''}`);
}

/* 2 bis · dates des tournois de l'année (et de l'an passé) : lues une fois dans
   l'infobox de la page du tournoi, dès qu'elle les donne. Jamais bloquant. */
data.dates = data.dates || {};
for (const an of [AN - 1, AN]) for (const s of Object.keys(SLAMS)) {
  const v = data.editions[an]?.[s];
  if (v === undefined || v === 'C' || v === 'ND' || data.dates[an]?.[s]) continue;
  try {
    const d = lireDates(await wikitexte(titreTournoi(an, s)), an);
    if (d) { (data.dates[an] = data.dates[an] || {})[s] = d; change = true; console.log(`${s} ${an} : dates ${d.join(' → ')}`); }
  } catch (e) { console.log(`${s} ${an} : dates illisibles (${e.message})`); }
}

if (change && !DRY) {
  fs.writeFileSync(FICHIER, ecrireData(data));
  console.log('data.json réécrit.');
} else console.log(change ? '(dry-run) data.json aurait changé.' : 'Rien de neuf.');

if (alarmes.length) fs.writeFileSync(ALARME, alarmes.join('\n'));
