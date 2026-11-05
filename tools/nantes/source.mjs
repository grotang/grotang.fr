/* Les données de la page FC Nantes : l'onglet « Historique » du Google Sheet
 * tenu à la main par GT (une ligne par saison).
 *
 * Le Sheet est la seule source : il est relu à CHAQUE fabrication du site
 * (export CSV public de l'onglet). Le Sheet a plusieurs éditeurs ; une saisie
 * de travers ne doit pas partir en ligne. D'où l'ordre :
 *   1. lire le Sheet, le décoder, le contrôler ;
 *   2. au moindre problème (réseau, colonne déplacée, code inconnu), on prend la
 *      photo commitée tools/nantes/historique.csv et on le dit dans le journal
 *      du build — la page reste en ligne, sur des données connues ;
 *   3. si la photo elle-même ne passe pas les contrôles, le build s'arrête.
 * Rafraîchir la photo : `npm run refresh:nantes` (tools/nantes/refresh.mjs).
 *
 * Conventions du Sheet (validées avec GT, 05/11/2026) :
 *   « - »    pas qualifié / pas engagé (la compétition existait)
 *   vide     la compétition n'existait pas cette saison-là
 *   « tp »   éliminé en tours préliminaires (avant les 1/32 en CdF, avant le
 *            tableau final ailleurs)
 *   « tbd »  saison en cours, résultat à venir
 *   « (s) »  même entraîneur toute la saison (colonne « Fin saison »)
 *   « V » vainqueur, « F » finaliste, « 1/2 »… tour de sortie
 *   Buts : toutes compétitions. Saison « 2027 » = saison 2026-27.
 *   Rang national (colonne « France ») : rang en D1, ou 20 + rang en D2 —
 *   recalculé ici à partir de H1/H2, la colonne n'est pas toujours remplie. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const SHEET_ID = '1Xkt7vgB-UwZ_DOc2NaIyF5MRm3hoaEskdoZSviQ7Ahc';
export const GID = 0;   // onglet « Historique »
export const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
export const PHOTO = path.join(ICI, 'historique.csv');

/* Colonnes, par position (B = 1). L'en-tête attendu sert de garde-fou : si
   quelqu'un insère une colonne dans le Sheet, la lecture refuse au lieu de
   décaler toutes les données d'un cran. */
const COLS = [
  ['an', 1, /^Saison/], ['nat', 2, /^France$/], ['h1', 3, /^H1/], ['h2', 4, /^H2/],
  ['cdf', 5, /^CdF$/], ['cdl', 6, /^CdL$/], ['tdc', 7, /^TdC$/],
  ['c1', 8, /^C1/], ['c2', 9, /^C2/], ['c3', 10, /^C3/], ['c4', 11, /^C4/],
  ['it', 12, /^Inter ?toto$/i], ['sc', 13, /^Super ?Coupe$/i], ['ci', 14, /^Coupe\s*Intercon/], ['cmc', 15, /^CdMdC$/],
  ['buteur', 16, /^Joueur$/], ['buts', 17, /^#$/], ['passeur', 18, /^Joueur$/], ['passes', 19, /^#$/],
  ['nEnt', 20, /^#$/], ['entDebut', 21, /^Début/], ['entFin', 22, /^Fin/],
];
export const COUPES = ['cdf', 'cdl', 'tdc', 'c1', 'c2', 'c3', 'c4', 'it', 'sc', 'ci', 'cmc'];
const CODES = new Set(['', '-', 'tp', '1/32', '1/16', '1/8', '1/4', '1/2', 'F', 'V', 'tbd']);

/* Orthographe uniformisée (le Sheet a parfois deux graphies du même nom). */
const NOMS = {
  'Angel Marcos': 'Ángel Marcos',
  'Vahid Halilhodzic': 'Vahid Halilhodžić',
  'Miroslav Blazevic': 'Miroslav Blažević',
  'Eric Carrière': 'Éric Carrière',
};
const nom = s => { const t = (s || '').replace(/\s+/g, ' ').trim(); return NOMS[t] || t; };

/* CSV au sens RFC 4180 (guillemets, retours à la ligne dans une cellule). */
export function parseCSV(txt) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const ent = v => { if (v === '' || v === '-') return null; const n = Number(v); return Number.isInteger(n) ? n : NaN; };

/* Décode et contrôle. Lève une erreur au premier défaut, avec la saison en cause. */
export function decode(txt) {
  const err = m => { throw new Error('FC Nantes : ' + m); };
  const rows = parseCSV(txt.replace(/^﻿/, ''));
  const iH = rows.findIndex(r => /^Saison/.test((r[1] || '').trim()));
  if (iH < 0) err('en-tête « Saison » introuvable');
  const H = rows[iH].map(x => (x || '').replace(/\s+/g, ' ').trim());
  for (const [k, j, re] of COLS) if (!re.test(H[j])) err(`colonne ${String.fromCharCode(65 + j)} : « ${H[j]} » au lieu de ${re} (${k})`);

  const saisons = [];
  for (const r of rows.slice(iH + 1)) {
    const an = (r[1] || '').trim();
    if (!an) continue;
    if (!/^\d{4}$/.test(an)) err(`saison illisible « ${an} »`);
    const g = {}; for (const [k, j] of COLS) g[k] = (r[j] || '').replace(/\s+/g, ' ').trim();
    const S = { an: +an, label: `${+an - 1}-${an.slice(2)}` };
    const h1 = ent(g.h1), h2 = ent(g.h2);
    if (Number.isNaN(h1) || Number.isNaN(h2)) err(`${S.label} : rang illisible (H1 « ${g.h1} », H2 « ${g.h2} »)`);
    if (h1 && h2) err(`${S.label} : classé à la fois en D1 et en D2`);
    if (h1 && (h1 < 1 || h1 > 22) || h2 && (h2 < 1 || h2 > 24)) err(`${S.label} : rang hors limites`);
    /* D1 si un rang en H1 ; sinon D2 (le club n'a connu que ces deux divisions).
       Saison en cours : pas encore de rang, la division se lit au « - » en H1. */
    S.div = h1 ? 1 : h2 ? 2 : g.h1 === '-' ? 2 : g.h2 === '-' ? 1 : null;
    if (!S.div) err(`${S.label} : division introuvable`);
    S.rang = h1 || h2 || null;
    S.nat = S.rang == null ? null : S.div === 1 ? S.rang : 20 + S.rang;
    S.coupes = {};
    for (const k of COUPES) {
      if (!CODES.has(g[k])) err(`${S.label} : code « ${g[k]} » inconnu en ${k}`);
      S.coupes[k] = g[k];
    }
    S.enCours = S.rang == null || COUPES.some(k => g[k] === 'tbd');
    S.buteur = g.buteur ? { nom: nom(g.buteur), n: ent(g.buts) } : null;
    S.passeur = g.passeur ? { nom: nom(g.passeur), n: ent(g.passes) } : null;
    if (S.buteur && Number.isNaN(S.buteur.n) || S.passeur && Number.isNaN(S.passeur.n)) err(`${S.label} : nombre de buts / passes illisible`);
    S.nEnt = ent(g.nEnt);
    if (!(S.nEnt >= 1 && S.nEnt <= 6)) err(`${S.label} : nombre d'entraîneurs « ${g.nEnt} »`);
    const deb = nom(g.entDebut), fin = g.entFin === '(s)' ? null : nom(g.entFin);
    if (!deb) err(`${S.label} : entraîneur de début de saison manquant`);
    if (S.nEnt === 1 && fin) err(`${S.label} : un seul entraîneur annoncé mais un entraîneur de fin de saison`);
    if (S.nEnt > 1 && !fin && !S.enCours) err(`${S.label} : ${S.nEnt} entraîneurs annoncés mais « (s) » en fin de saison`);
    S.ent = fin ? [deb, fin] : [deb];
    saisons.push(S);
  }
  saisons.sort((a, b) => a.an - b.an);
  if (saisons.length < 80) err(`${saisons.length} saisons seulement`);
  saisons.forEach((S, i) => { if (i && S.an !== saisons[i - 1].an + 1) err(`saison manquante avant ${S.label}`); });
  const enCours = saisons.filter(S => S.enCours);
  if (enCours.length > 1 || enCours.length && enCours[0] !== saisons.at(-1)) err('seule la dernière saison peut être en cours');
  return saisons;
}

/* Lecture au build : le Sheet d'abord, la photo sinon. */
export async function charge({ log = console.log } = {}) {
  try {
    const r = await fetch(CSV_URL, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    const saisons = decode(txt);
    return { saisons, source: 'sheet', csv: txt };
  } catch (e) {
    log(`FC Nantes : Sheet non utilisé (${e.message}) → photo tools/nantes/historique.csv`);
    const txt = fs.readFileSync(PHOTO, 'utf8');
    return { saisons: decode(txt), source: 'photo', csv: txt };
  }
}
