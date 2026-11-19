#!/usr/bin/env node
/* Race ATP : relit Wikipédia, recalcule la Race semaine par semaine et écrit
 * tools/atp/data-AAAA.json. Lancé chaque lundi par le robot (.github/workflows/atp.yml),
 * ou à la main : node tools/atp/refresh.mjs [--an 2026] [--dry-run]
 *
 * Sources : « AAAA ATP Tour », « AAAA ATP Challenger Tour » (+ celle de l'année
 * précédente : depuis 2026, ce qui se joue après Paris compte pour la Race
 * suivante), « AAAA United Cup », et toutes les pages de tableau de simple.
 * Contrôle avant écriture : le top 20 de la Race publié sur Wikipédia
 * (« Current tennis rankings »). Écart massif → rien n'est écrit, sortie en erreur. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogueATP, catalogueChallenger } from './moteur/catalogue.mjs';
import { calcule, regroupe, total } from './moteur/calcul.mjs';
import { lireUnitedCup, rangsA } from './moteur/uc.mjs';
import { FR, court } from './noms.mjs';
import { natDe } from '../tennis/wiki.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const AN = +(arg('--an') || process.env.ATP_AN || new Date().getUTCFullYear());
const DRY = process.argv.includes('--dry-run');
const UA = { 'User-Agent': 'grotang.fr-robot/1.0 (https://grotang.fr/; robot du site)' };
const API = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1';
const pause = ms => new Promise(o => setTimeout(o, ms));
const resume = [];
const note = s => { console.log(s); resume.push(s); };

async function api(params) {
  for (let e = 1; e <= 6; e++) {
    const r = await fetch(API + params, { headers: UA, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (r && r.ok) return r.json();
    await pause(3000 * e);
  }
  throw new Error('Wikipédia ne répond pas : ' + params.slice(0, 120));
}
/* wikitexte de plusieurs pages (par lots de 20), clé = titre demandé */
async function pages(titres) {
  const out = new Map();
  for (let i = 0; i < titres.length; i += 20) {
    const lot = titres.slice(i, i + 20);
    const j = await api('&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(lot.join('|')));
    const back = {};
    for (const x of j.query.normalized || []) back[x.to] = x.from;
    for (const x of j.query.redirects || []) back[x.to] = back[x.from] || x.from;
    for (const p of j.query.pages) { const c = p.revisions?.[0]?.slots?.main?.content; if (c) out.set(back[p.title] || p.title, c); }
    await pause(300);
  }
  return out;
}
/* nom d'article de chaque graphie (redirections), en cache dans alias.json */
async function aliases(noms) {
  const F = path.join(ICI, 'alias.json');
  const A = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
  const todo = noms.filter(n => !(n in A));
  for (let i = 0; i < todo.length; i += 50) {
    const lot = todo.slice(i, i + 50);
    const j = await api('&titles=' + encodeURIComponent(lot.join('|')));
    const norm = Object.fromEntries((j.query.normalized || []).map(x => [x.to, x.from]));
    for (const n of lot) A[n] = null;
    for (const x of j.query.redirects || []) A[norm[x.from] || x.from] = x.to.replace(/\s*\([^)]*\)\s*$/, '');
    await pause(300);
  }
  if (!DRY) fs.writeFileSync(F, JSON.stringify(Object.fromEntries(Object.entries(A).sort())));
  return n => A[n] || n;
}
const lundiApres = (d, n = 7) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/* 1. Calendriers. Depuis 2026, la Race s'arrête après Paris : ce qui se joue
   ensuite compte pour la Race suivante. Une Race va donc du lundi qui suit Paris
   l'an passé (DEBUT) au lundi qui suit Paris cette année (FIN). Vérifié pour 2026 :
   Challengers à partir du 3 novembre 2025 (Paris 2025 : semaine du 27 octobre). */
const T_ATP = a => `${a} ATP Tour`, T_CH = a => `${a} ATP Challenger Tour`;
const cal = await pages([T_ATP(AN), T_CH(AN), T_ATP(AN - 1), T_CH(AN - 1), `${AN} United Cup`]);
if (!cal.has(T_ATP(AN - 1))) { note(`Race ${AN} : page « ${T_ATP(AN - 1)} » absente de Wikipédia, rien à faire`); fin(0); }
const atpPrec = catalogueATP(cal.get(T_ATP(AN - 1)), AN - 1);
const atp = cal.has(T_ATP(AN)) ? catalogueATP(cal.get(T_ATP(AN)), AN) : [];
const ch = cal.has(T_CH(AN)) ? catalogueChallenger(cal.get(T_CH(AN)), AN) : [];
const parisDe = L => L.find(x => /Paris Masters/.test(x.page || ''));
const pPrec = parisDe(atpPrec), pAn = parisDe(atp);
if (!pPrec) throw new Error('Paris introuvable dans le calendrier ' + (AN - 1));
const DEBUT = lundiApres(pPrec.fin || pPrec.semaine);
const FIN = pAn ? lundiApres(pAn.fin || pAn.semaine) : `${AN}-12-31`;
/* fin de l'an passé : Challengers (la saison Challenger d'une année commence fin
   décembre de l'année d'avant : on s'arrête au 1er décembre) ; tournois ATP
   seulement si la règle s'appliquait déjà l'an passé (Race 2027 et suivantes) */
const finPrec = `${AN - 1}-12-01`;
const prec = [
  ...(cal.has(T_CH(AN - 1)) ? catalogueChallenger(cal.get(T_CH(AN - 1)), AN - 1) : []),
  ...(AN - 1 >= 2026 ? atpPrec : []),
].filter(x => x.semaine >= DEBUT && x.semaine <= finPrec);
const catalogue = [...atp, ...ch, ...prec].filter(x => x.page && x.semaine);   /* toute l'année : la Race s'arrête à FIN, la saison au 31 décembre */
note(`Race ${AN} : du ${DEBUT} au ${FIN}${pAn ? '' : ' (Paris ' + AN + ' pas encore au calendrier)'} ; ${atp.filter(x => x.page).length} tournois ATP, ${ch.filter(x => x.page).length} Challengers ${AN}, ${prec.length} tournois de fin ${AN - 1}`);

/* 2. Tableaux */
const titres = [...new Set(catalogue.map(x => x.page))];
for (const x of catalogue) if (x.cat === 'Grand Slam') titres.push(x.page + ' qualifying');
/* ATP_CACHE=dossier : relire des tableaux déjà téléchargés (mise au point hors ligne) */
const P = process.env.ATP_CACHE ? new Map(titres.map(t => [t, (f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)(process.env.ATP_CACHE + '/' + t.replace(/[\/\s]/g, '_') + '.txt')]).filter(x => x[1])) : await pages(titres);
note(`Tableaux lus : ${P.size} pages sur ${titres.length} demandées`);

/* 3. United Cup : classement de l'adversaire au lundi précédant le tournoi */
let uc = { points: {} }, ucCredit = null, ucSem = null;
const ucx = atp.find(x => x.cat === 'United Cup');   /* United Cup : lue quand le calendrier ATP de l'année existe */
if (cal.has(`${AN} United Cup`) && ucx) {
  const RF = path.join(ICI, `uc-rangs-${AN}.json`);
  const tu = cal.get(`${AN} United Cup`);
  const rg = fs.existsSync(RF) ? JSON.parse(fs.readFileSync(RF, 'utf8')) : await rangsA(lireUnitedCup(tu).atp, lundiApres(ucx.semaine, -14));
  if (!DRY && !fs.existsSync(RF)) fs.writeFileSync(RF, JSON.stringify(rg));
  uc = lireUnitedCup(tu, rg); ucSem = ucx.semaine; ucCredit = lundiApres(ucx.fin || ucx.semaine);
  if (uc.devines.length) note('United Cup, classement deviné : ' + uc.devines.join(', '));
}

/* 4. Calcul */
const C = calcule({ catalogue, lire: t => P.get(t) || null, unitedCup: uc.points, ucCredit, ucSem });
C.alertes.forEach(a => note('⚠ ' + a));
const ctrl = await pages(['Current tennis rankings']);
const cr = ctrl.get('Current tennis rankings') || '';
const sR = cr.slice(cr.indexOf('ATP singles race />'), cr.indexOf('section end', cr.indexOf('ATP singles race />')));
const asof = /As of\|(\d+)\|(\d+)\|(\d+)/.exec(sR);
const wiki = [...sR.matchAll(/\|(\d+)\n\|(.*?)\n\|([\d,]+)\n\|(\d+)/g)].map(m => ({ rang: +m[1], nom: (/\[\[([^\]|]+)/.exec(m[2]) || [])[1]?.replace(/\s*\([^)]*\)\s*$/, ''), pts: +m[3].replace(/,/g, '') }));
const canon0 = await aliases([...new Set([...Object.keys(C.res).map(n => C.LIEN[n] || n), ...wiki.map(w => w.nom)])]);
const canon = n => canon0(C.LIEN[n] || n).replace(/\s*\([^)]*\)\s*$/, '');
const res = regroupe(C.res, canon);
const NAT = {}; for (const [n, c] of Object.entries(C.NAT)) NAT[canon(n)] = c;

/* 5. Semaines : chaque lundi, du premier crédit de points à la fin de la Race (ou aujourd'hui) */
const auj = new Date().toISOString().slice(0, 10);
const sem = []; for (let s = lundiApres(DEBUT); s <= FIN && s <= auj; s = lundiApres(s)) sem.push(s);
if (!sem.length) { note(`Race ${AN} : pas encore commencée (début le ${lundiApres(DEBUT)}), rien à écrire`); fin(0); }
const der = sem.at(-1);
const tot = {}; for (const [n, L] of Object.entries(res)) tot[n] = sem.map(s => total(L, s, C.mands, DEBUT));
/* joueurs retenus : le top 100 de la dernière semaine, plus tout joueur passé par le top 20 */
const rangs = sem.map((_, k) => Object.keys(tot).sort((a, b) => tot[b][k] - tot[a][k] || a.localeCompare(b)));
const garde = new Set(rangs.at(-1).slice(0, 100)); rangs.forEach(r => r.slice(0, 20).forEach(n => garde.add(n)));

/* 6. Contrôle : top 20 Wikipédia, à sa date */
let ok = 0, n = 0; const ecarts = [];
const dw = asof ? `${asof[1]}-${asof[2].padStart(2, '0')}-${asof[3].padStart(2, '0')}` : null;
if (dw && dw <= FIN && dw >= sem[0]) {
  const k = sem.findLastIndex(s => s <= dw);
  for (const w of wiki) { n++; const nm = canon(w.nom); const v = tot[nm]?.[k] ?? null;
    if (v !== null && Math.abs(v - w.pts) <= 0.02 * w.pts) ok++; else ecarts.push(`${w.nom} : Wikipédia ${w.pts}, nous ${v}`); }
  note(`Contrôle Wikipédia (${dw}) : ${ok}/${n} à moins de 2 %`);
  ecarts.forEach(e => note('  ' + e));
  if (n >= 10 && ok < 0.7 * n) { note('✗ écart massif : data.json non modifié'); fin(1); }
} else note(`Contrôle Wikipédia : relevé du ${dw || '?'} hors de la saison ${AN}, pas de comparaison`);

/* 6 bis. Classement de la SAISON (choix de GT, 19/11/2026) : tout le monde part de 0
   au 1er janvier ; on additionne TOUS les points gagnés dans les tournois de l'année
   (circuit ATP, United Cup, Challengers), sans règle de meilleurs résultats. */
const pagesAn = new Set([...atp, ...ch].filter(x => x.page).map(x => x.page)); pagesAn.add('United Cup');
const semS = []; for (let d = new Date(Date.UTC(AN, 0, 1)); d.getUTCFullYear() === AN; d.setUTCDate(d.getUTCDate() + 1))
  if (d.getUTCDay() === 1) { const s = d.toISOString().slice(0, 10); if (s > auj) break; semS.push(s); }
const totS = {}; for (const [n, L] of Object.entries(res)) {
  const l = L.filter(x => pagesAn.has(x.page) && x.p > 0);
  if (l.length) totS[n] = semS.map(s => l.filter(x => x.credit <= s).reduce((a, x) => a + x.p, 0)); }
const rangsS = semS.map((_, k) => Object.keys(totS).sort((a, b) => totS[b][k] - totS[a][k] || a.localeCompare(b)));
if (semS.length) { const g = rangsS.at(-1).slice(0, 100); g.forEach(n => garde.add(n)); rangsS.forEach(r => r.slice(0, 20).forEach(n => garde.add(n))); }

/* 7. Écriture */
const T = [], iT = {};
const sorteT = x => x.cat === 'ATP Finals' ? 'F' : x.cat === 'Grand Slam' ? 'GS' : x.cat === 'United Cup' ? 'UC' : x.cat === 'ATP 1000' ? (/Monte-Carlo/.test(x.page) ? 'MC' : 'M') : x.cat === 'ATP 500' ? '500' : x.cat === 'ATP 250' ? '250' : 'CH';
const tIdx = (page, cat, semaine) => {
  if (!(page in iT)) { const x = catalogue.find(c => c.page === page) || { page, cat, semaine };
    iT[page] = T.push({ n: FR[court(page)] || court(page), c: sorteT(x), s: x.semaine || semaine, f: x.fin || x.semaine || semaine }) - 1; }
  return iT[page];
};
const J = [...garde].sort((a, b) => (totS[b]?.at(-1) || 0) - (totS[a]?.at(-1) || 0) || tot[b].at(-1) - tot[a].at(-1)).map(nm => {
  const L = res[nm], d = total(L, der, C.mands, DEBUT, true);
  return { n: nm, c: NAT[nm] || null, pts: tot[nm], rg: rangs.map(r => r.indexOf(nm) + 1),
    sp: totS[nm] || semS.map(() => 0), sr: rangsS.map(r => r.indexOf(nm) + 1 || null),
    r: L.filter(x => x.p > 0 || x.forfait).sort((a, b) => a.sem < b.sem ? -1 : 1)
      .map(x => [tIdx(x.page, x.cat, x.sem), x.rd, x.p, d.comptes.has(x) ? 1 : 0]) };
});
/* les ATP Finals figurent au calendrier de la page même avant d'avoir des points (bande dans le bloc 1) */
for (const x of atp.filter(x => x.cat === 'ATP Finals' && x.page)) tIdx(x.page, x.cat, x.semaine);
/* Joueurs sans drapeau dans les tableaux (Russes et Biélorusses jouent sous bannière
   neutre) : leur pays réel, lu dans l'infobox de leur article (« country = {{RUS}} »),
   gardé dans nations-joueurs.json (GT, 19/11/2026 : « mets le vrai pays du joueur »). */
{ const F = path.join(ICI, 'nations-joueurs.json');
  const NJ = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
  const manque = J.filter(j => !j.c && !(j.n in NJ)).map(j => j.n);
  if (manque.length) { const A = await pages(manque);
    for (const n of manque) { const c = A.get(n); const m = c && /\|\s*country\s*=\s*([^\n]*)/i.exec(c); NJ[n] = m ? natDe(m[1]) : null; }
    if (!DRY) fs.writeFileSync(F, JSON.stringify(Object.fromEntries(Object.entries(NJ).sort()), null, 1)); }
  for (const j of J) if (!j.c && NJ[j.n]) j.c = NJ[j.n];
  const reste = J.filter(j => !j.c).map(j => j.n); if (reste.length) note('⚠ pays introuvable : ' + reste.join(', ')); }
const data = { an: AN, maj: auj, debut: DEBUT, fin: FIN, close: !!pAn && auj >= FIN, semaines: sem, saison: semS, tournois: T, joueurs: J };
note(`${J.length} joueurs ; Race : ${sem.length} semaines (${sem[0]} → ${der}) ; saison : ${semS.length} semaines ; ${T.length} tournois`);
/* on n'écrit que si un chiffre a bougé (la date de mise à jour seule ne compte pas) */
const F = path.join(ICI, `data-${AN}.json`);
const avant = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : null;
const sans = d => JSON.stringify({ ...d, maj: null, close: null });
if (avant && sans(avant) === sans(data)) note('Aucun changement : data-' + AN + '.json non réécrit');
else if (!DRY) { fs.writeFileSync(F, JSON.stringify(data)); note('data-' + AN + '.json écrit'); }
fin(0);

function fin(code) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Race ATP\n\n' + resume.map(s => '- ' + s).join('\n') + '\n');
  process.exit(code);
}
