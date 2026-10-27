#!/usr/bin/env node
/* Rafraîchissement de la page tennis (/tennis/) : les joueurs de chaque nation
 * tour par tour dans les quatre Grands Chelems, simple messieurs.
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
 *      Chaque case du tableau donne un joueur et sa nation (le drapeau). On
 *      range, nation par nation, le dernier tour atteint par chaque joueur ;
 *      un nom inconnu est ramené au titre de son article Wikipédia, pour qu'un
 *      même joueur ne compte pas deux fois. Un joueur sans drapeau (bannière
 *      neutre, Russes et Biélorusses depuis 2022) est rendu à sa nation : celle
 *      de ses éditions précédentes, sinon celle de son article. Les dates de
 *      chaque tournoi sont lues une fois dans la page du tournoi.
 *   3. Contrôles de cohérence sur chaque édition relue (voir controle()). Une
 *      édition qui échoue garde ses chiffres de la veille.
 *   4. Réécrit tools/tennis/data.json SEULEMENT si un chiffre a bougé (pas
 *      d'horodatage dedans : pas de commit parasite).
 *
 * Sortie : code 0 dans tous les cas où la page reste juste (même datée). Un
 * contrôle en échec dépose une alarme dans le dossier temporaire ; le workflow
 * échoue en toute fin, après publication, pour que GitHub envoie son e-mail.
 *
 * Options : --annee AAAA (relire une autre année), --tout (relire toutes les
 * éditions depuis 1968), --dry-run (ne rien écrire). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireTableau, colonnes, nomsColonnes, nationsTableau, resoudreNeutres, unifierNations, natDe, parcoursEdition, parcoursVersData, compteParcours, lireDates, ecrireData, TOURS } from './wiki.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const FICHIER = path.join(ICI, 'data.json');
const ALARME = path.join(os.tmpdir(), 'grotang-tennis-alarme.txt');
const UA = 'grotang.fr-robot/1.0 (https://grotang.fr/tennis/; Grands Chelems par nation, quelques pages par jour)';
const SLAMS = { AO: 'Australian Open', RG: 'French Open', WIM: 'Wimbledon Championships', USO: 'US Open' };
/* 1977 : deux éditions de l'Open d'Australie, janvier (AO) et décembre (AOd) */
const titre = (an, s) => s === 'AOd' ? `${an} Australian Open (December) – Men's singles`
  : s === 'AO' && +an === 1977 ? `${an} Australian Open (January) – Men's singles`
  : `${an} ${SLAMS[s]} – Men's singles`;
/* la page du tournoi (dates dans l'infobox) ; « US Open » seul est une page d'homonymie */
const titreTournoi = (an, s) => `${an} ${SLAMS[s]}${s === 'USO' ? ' (tennis)' : ''}`;

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const TOUT = args.includes('--tout');
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
    let r;
    for (let essai = 1; ; essai++) {
      r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(lot.join('|'))}`,
        { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      /* trop de requêtes : on patiente et on réessaie */
      if (r.status === 429 && essai < 5) { await new Promise(ok => setTimeout(ok, 5000 * essai)); continue; }
      break;
    }
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
  return { L, n: TOURS.map(k => c[k] ? c[k][0] : null), etat: TOURS.map(k => c[k] ? c[k][1] : 'c').join(''), alertes: L.alertes,
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
  /* --tout : les vieux tableaux à exemptés (48, 56, 96 joueurs…) n'ont pas
     2^n places par tour ; leurs chiffres français ont été validés à la main,
     et le contrôle des parcours (plus bas) les redemande à l'identique. */
  return pb.concat(r.alertes.filter(a => !/deviné/.test(a) && !(TOUT && /places au lieu de/.test(a))));
}

const data = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
data.neutres = data.neutres || {}; data.parcours = data.parcours || {};
/* ancien format (Français seuls, jusqu'au 27/10/2026) : chiffres dans editions,
   parcours sans nation. Converti à la lecture. */
for (const e of Object.values(data.editions)) for (const s of Object.keys(e)) if (Array.isArray(e[s])) e[s] = 'J';
for (const e of Object.values(data.parcours)) for (const s of Object.keys(e)) if (Array.isArray(e[s])) e[s] = { FRA: e[s] };
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

/* Nation d'un joueur sous bannière neutre : la dernière nation russe ou
   biélorusse où il figure déjà, sinon le drapeau RUS / BLR de son article. */
async function nationNeutre(nom) {
  if (data.neutres[nom]) return data.neutres[nom];
  const id = data.joueurs.indexOf(nom);
  if (id >= 0) for (const an of Object.keys(data.parcours).sort().reverse()) for (const p of Object.values(data.parcours[an]))
    for (const nat of ['RUS', 'BLR']) { const f = p[nat] || []; for (let j = 0; j < f.length; j += 2) if (f[j] === id) return (data.neutres[nom] = nat); }
  try {
    const t = await wikitexte(nom + ' (tennis)') || await wikitexte(nom);
    const m = t && /^\s*\|\s*(?:country|nationality)\s*=\s*(.+)$/im.exec(t);
    if (m) {
      const codes = [...m[1].matchAll(/\{\{[^{}]*\}\}/g)].map(x => natDe(x[0]));
      const nat = codes.find(c => c === 'RUS' || c === 'BLR');
      if (nat) return (data.neutres[nom] = nat);
    }
  } catch (e) { console.log(`${nom} : article illisible (${e.message})`); }
  return null;
}

/* 2 · éditions à relire */
const aRelire = [];
if (TOUT) for (const an of Object.keys(data.editions).sort()) for (const s of Object.keys(data.editions[an])) {
  const v = data.editions[an][s];
  if (v === null || v === 'C' || v === 'ND') continue;
  aRelire.push([an, s]);
}
else for (const an of [AN - 1, AN]) {
  for (const s of Object.keys(SLAMS)) {
    const v = data.editions[an]?.[s];
    const ouvert = data.ouverts?.[an]?.[s];
    if (an === AN - 1 && !ouvert && v !== '?') continue;
    if (an === AN && v === 'J' && !ouvert) continue;        /* close */
    if (typeof v === 'string' && v !== '?') continue;        /* annulé, non disputé */
    aRelire.push([an, s]);
  }
}

let change = false;
for (const [an, s] of aRelire) {
  if (TOUT) await new Promise(ok => setTimeout(ok, 400));
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
  /* les joueurs sans drapeau rendus à leur nation */
  const sansDrapeau = [...new Set(Object.values(r.L.etapes).flatMap(E => E.tous).filter(x => !x.nat && !/\bbye\b/i.test(x.nom)).map(x => x.nom))];
  const neutres = {};
  for (const n of sansDrapeau) neutres[n] = await nationNeutre(data.alias[n] || n);
  resoudreNeutres(r.L, n => neutres[n]);
  /* les joueurs : graphies nouvelles ramenées au titre de leur article */
  data.alias = data.alias || {}; data.joueurs = data.joueurs || [];
  /* la requête porte sur la cible du lien, précision d'homonymie comprise :
     « Andrei Medvedev (tennis) » renvoie vers « Andriy Medvedev », alors que
     « Andrei Medvedev » seul est une autre page */
  const lienDe = {};
  for (const x of Object.values(r.L.etapes).flatMap(E => E.tous)) if (x.lien && !lienDe[x.nom]) lienDe[x.nom] = x.lien.replace(/_/g, ' ').trim();
  const inconnus = [...new Set(Object.values(r.L.etapes).flatMap(E => E.tous).map(x => x.nom).filter(n => n && !/\bbye\b/i.test(n)))]
    .filter(n => !data.joueurs.includes(n) && !data.alias[n]);
  if (inconnus.length) try {
    const cibles = [...new Set(inconnus.map(n => lienDe[n] || n))];
    const red = await redirections(cibles);
    for (const n of inconnus) { const v = red[lienDe[n] || n]; if (v && v !== n) data.alias[n] = v; }
  } catch (e) { console.log(`${s} ${an} : redirections non vérifiées (${e.message})`); }
  const canon = n => data.alias[n] || n;
  unifierNations(r.L, an, canon);
  const { nations } = nationsTableau(r.L);
  if (nations.includes('NEU')) console.log(`${s} ${an} : joueurs sans nation (${sansDrapeau.filter(n => !neutres[n]).join(', ')})`);
  const joueursAvant = data.joueurs.length;
  const parc = {}, total = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const nat of nations) {
    const f = parcoursVersData(data, parcoursEdition(nomsColonnes(r.L, nat), canon));
    if (f.length) { parc[nat] = f; compteParcours(f).forEach((v, i) => total[i] += v); }
  }
  /* contrôles : les Français retombent sur leurs chiffres ; aucune colonne ne
     dépasse ses places, toutes nations réunies ; un seul titre */
  const pbP = [];
  if (compteParcours(parc.FRA || []).join() !== r.n.map(v => v ?? 0).join()) pbP.push('parcours des Français ≠ chiffres');
  const plafondT = [256, 128, 64, 16, 8, 4, 2, 1];
  total.forEach((v, i) => { if (v > plafondT[i]) pbP.push(`${TOURS[i]} : ${v} joueurs toutes nations`); });
  if (clos && total[7] !== 1) pbP.push(`${total[7]} vainqueur(s)`);
  if (pbP.length) {
    data.joueurs.length = joueursAvant;
    const msg = `${s} ${an} : ${pbP.join(' ; ')} — chiffres de la veille gardés`;
    console.log('::warning::' + msg); alarmes.push(msg); continue;
  }
  const avant = JSON.stringify([ed[s], data.ouverts?.[an]?.[s] || null, data.parcours?.[an]?.[s] || null]);
  ed[s] = 'J';
  data.parcours = data.parcours || {};
  if (Object.keys(parc).length) (data.parcours[an] = data.parcours[an] || {})[s] = Object.fromEntries(Object.keys(parc).sort().map(k => [k, parc[k]]));
  else if (data.parcours[an]) { delete data.parcours[an][s]; if (!Object.keys(data.parcours[an]).length) delete data.parcours[an]; }
  data.ouverts = data.ouverts || {};
  if (clos) { if (data.ouverts[an]) delete data.ouverts[an][s]; }
  else (data.ouverts[an] = data.ouverts[an] || {})[s] = r.etat;
  if (data.ouverts[an] && !Object.keys(data.ouverts[an]).length) delete data.ouverts[an];
  if (JSON.stringify([ed[s], data.ouverts?.[an]?.[s] || null, data.parcours?.[an]?.[s] || null]) !== avant || data.joueurs.length !== joueursAvant) change = true;
  console.log(`${s} ${an} : ${Object.keys(parc).length} nations, Français ${r.n.map(v => v ?? '-').join(' ')}  [${r.etat}]${clos ? ' close' : ''}`);
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
