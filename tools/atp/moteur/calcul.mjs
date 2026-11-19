/* Calcul de la Race ATP à partir des tableaux Wikipédia.
 *
 * Entrées : le catalogue des tournois (catalogue.mjs), une fonction qui rend le
 * wikitexte d'une page de tableau, les points de la United Cup, et une fonction
 * qui ramène chaque graphie de nom à l'article Wikipédia du joueur.
 * Sortie : pour chaque joueur, la liste de ses résultats
 *   { page, sorte: 'GS' | 'M' | 'O', sem, credit, p, paris?, forfait? }
 * et total(liste, date) donne ses points de Race à une date.
 *
 * Règles (validées le 19/11/2026 contre les fiches officielles ATP et
 * l'historique Wikipédia, voir le journal du projet) :
 * - 4 Grands Chelems + 8 Masters obligatoires + 6 meilleurs autres résultats ;
 * - une case Grand Chelem / Masters n'est occupée que par un joueur du tableau
 *   principal ou un forfait inscrit d'office (‡ †) ; chaque case non occupée
 *   donne un résultat « autre » de plus ; battu en qualifications = « autre » ;
 * - jusqu'à 3 Masters remplaçables par un meilleur « autre » ; un forfait
 *   (0 de pénalité) n'est pas remplaçable ; Paris n'est jamais remplacé ;
 * - forfait à un Masters qui suit de 2 semaines au plus un autre forfait : pas
 *   de case ;
 * - invité (WC) battu d'entrée : 0 ; joueur disqualifié : 0 ;
 * - qualifié : points de qualification + points du tableau ; repêché : points
 *   du dernier tour de qualification + points du tableau. */
import { lirePageTableau } from './tableau.mjs';
import { BAREME, pointsPrincipal, pointsQualif } from './points.mjs';
import { nomJoueur } from '../../tennis/wiki.mjs';

const MAND = /BNP Paribas|Miami Open|Madrid|Italian Open|National Bank|Cincinnati|Shanghai|Paris Masters/;
const plus = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const jours = (a, b) => (new Date(b) - new Date(a)) / 864e5;
const TOUR = ['', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'];
/* tour atteint, à l'écriture ATP : W, F, SF… ; défaite au premier match après une
   exemption = premier tour du tableau */
const tourPrincipal = (o, tours) => o.gagne ? 'W' : TOUR[(o.first < tours && o.best === o.first) ? tours : o.best] || '?';

export function calcule({ catalogue, lire, unitedCup = {}, ucCredit = null, ucSem = null }) {
  const res = {}, LIEN = {}, NAT = {}, MANDS = [], alertes = [];
  const ajoute = (n, r) => (res[n] = res[n] || []).push(r);
  for (const x of catalogue) {
    const b = BAREME[x.cat + ' ' + x.taille]; if (!b || !x.page) continue;
    const txt = lire(x.page); if (!txt) continue;
    const R = lirePageTableau(txt); if (!R.principal) { alertes.push('tableau illisible : ' + x.page); continue; }
    let quals = R.qualifs;
    if (x.cat === 'Grand Slam') { const q = lire(x.page + ' qualifying'); if (q) quals = lirePageTableau(q, true).qualifs; }
    const credit = plus(x.fin || x.semaine, 7);   /* le lundi qui suit la dernière semaine */
    const sorte = x.cat === 'Grand Slam' ? 'GS' : (x.cat === 'ATP 1000' && MAND.test(x.page)) ? 'M' : 'O';
    const paris = /Paris Masters/.test(x.page);
    const acc = {}, rd = {};
    for (const P of [R.principal, ...quals]) for (const [n, o] of Object.entries(P.joueurs)) {
      if (o.lien && !LIEN[n]) LIEN[n] = o.lien.replace(/_/g, ' ').trim();
      if (o.nat) NAT[n] = o.nat;
    }
    for (const [n, o] of Object.entries(R.principal.joueurs)) { acc[n] = (acc[n] || 0) + pointsPrincipal(b, o, R.principal.tours); rd[n] = tourPrincipal(o, R.principal.tours); }
    for (const Q of quals) for (const [n, o] of Object.entries(Q.joueurs)) { acc[n] = (acc[n] || 0) + pointsQualif(b, o); if (!rd[n]) rd[n] = o.gagne ? 'Q' : 'Q' + (Q.tours - o.best + 1); }
    /* sans tableau de qualification (Challengers) : qualifiés (Q) et repêchés (LL)
       marqués dans le tableau ; un qualifié demi-finaliste apparaît aussi dans le
       carré final : on ne le compte qu'une fois */
    if (!quals.length) { const vus = new Set(); for (const m of txt.matchAll(/\|\s*RD1-seed(\d+)\s*=\s*(Q|LL)\s*\n\|\s*RD1-team\1\s*=([^\n]*)/g)) {
      const n = nomJoueur(m[3]); if (vus.has(n)) continue; vus.add(n); acc[n] = (acc[n] || 0) + (m[2] === 'Q' ? b.q[0] : b.q[1]); } }
    for (const m of txt.matchAll(/\|\s*RD1-seed(\d+)\s*=\s*WC\s*\n\|\s*RD1-team\1\s*=([^\n]*)/g)) {
      const n = nomJoueur(m[2]), o = R.principal.joueurs[n]; if (o && !o.gagne && o.best === o.first) acc[n] = 0; }
    for (const m of txt.matchAll(/^#[^\n]*\[\[([^\]|]+)[^\n]*defaulted/gim)) { const n = nomJoueur('[[' + m[1] + ']]'); if (n in acc) acc[n] = 0; }
    const dansTableau = new Set(Object.keys(R.principal.joueurs));
    for (const [n, p] of Object.entries(acc))
      ajoute(n, { page: x.page, cat: x.cat, sorte: sorte !== 'O' && !dansTableau.has(n) ? 'O' : sorte, sem: x.semaine, credit, p, paris, rd: rd[n] || (dansTableau.has(n) ? '?' : 'Q') });
    if (sorte !== 'O') {
      const aListe = /=+\s*Withdrawals\s*=+/.test(txt);
      MANDS.push({ sorte, credit, sem: x.semaine, page: x.page, paris, aListe, principal: dansTableau, quals: new Set(Object.keys(acc).filter(n => !dansTableau.has(n))) });
      if (aListe) for (const m of txt.slice(txt.search(/=+\s*Withdrawals\s*=+/)).matchAll(/^\*\s*([‡†§])[^\n]*?\[\[([^\]|]+)/gm)) {
        if (m[1] === '§') continue;   /* pas sur la liste d'entrée : pas de case */
        const n = nomJoueur('[[' + m[2] + ']]'); if (!(n in acc)) ajoute(n, { page: x.page, cat: x.cat, sorte, sem: x.semaine, credit, p: 0, paris, forfait: true, rd: 'forfait' });
      }
    }
  }
  /* Page sans liste de forfaits (souvent le dernier Masters, pas encore remplie) :
     on suppose inscrit d'office tout joueur du tableau principal du Masters précédent. */
  for (const M of MANDS) {
    if (M.aListe) continue;
    const prec = MANDS.filter(z => z.sem < M.sem).sort((a, b) => a.sem < b.sem ? 1 : -1)[0]; if (!prec) continue;
    alertes.push('liste de forfaits absente, supposée : ' + M.page);
    for (const n of prec.principal) if (!M.principal.has(n) && !M.quals.has(n))
      ajoute(n, { page: M.page, cat: 'ATP 1000', sorte: M.sorte, sem: M.sem, credit: M.credit, p: 0, paris: M.paris, forfait: 'suppose', rd: 'forfait' });
  }
  for (const [n, p] of Object.entries(unitedCup)) ajoute(n, { page: 'United Cup', cat: 'United Cup', sorte: 'O', sem: ucSem, credit: ucCredit, p, rd: 'UC' });
  return { res, LIEN, NAT, mands: MANDS.map(m => m.credit), alertes };
}

/* Fusionne les graphies d'un même joueur et applique la règle des forfaits enchaînés. */
export function regroupe(res, canon) {
  const R2 = {};
  for (const [n, l] of Object.entries(res)) { const c = canon(n); (R2[c] = R2[c] || []).push(...l); }
  for (const [n, L] of Object.entries(R2)) {
    const f = L.filter(x => x.sorte === 'M' && x.forfait).sort((a, b) => a.sem < b.sem ? -1 : 1);
    for (let i = 1; i < f.length; i++) if (jours(f[i - 1].sem, f[i].sem) <= 14) f[i].libre = true;
    /* une même page comptée deux fois (graphies fusionnées) : on garde le meilleur résultat */
    const vu = {};
    for (const x of L.filter(x => !x.libre)) if (!vu[x.page] || x.p > vu[x.page].p || (x.sorte !== 'O' && vu[x.page].sorte === 'O')) vu[x.page] = x;
    R2[n] = Object.values(vu);
  }
  return R2;
}

/* Points de Race à une date (résultats crédités ce lundi-là compris). */
/* Points de Race à une date (résultats crédités ce lundi-là compris).
   detail = true : rend aussi la liste des résultats comptés. */
export function total(liste, date, mands, debut = '', detail = false) {
  const r = liste.filter(x => x.credit && x.credit <= date);
  const cases = new Set(r.filter(x => x.sorte === 'GS' || x.sorte === 'M').map(x => x.page)).size;
  const tenus = mands.filter(c => c <= date && c >= debut).length;
  const extra = Math.max(0, tenus - cases);
  const fixes = r.filter(x => x.sorte === 'GS' || (x.sorte === 'M' && (x.paris || x.forfait)));
  const m = r.filter(x => x.sorte === 'M' && !x.paris && !x.forfait).sort((a, b) => b.p - a.p);
  const autres = r.filter(x => x.sorte === 'O').sort((a, b) => b.p - a.p);
  const NB = 6 + extra;
  const pris = autres.slice(0, NB), reste = autres.slice(NB);
  const mm = m.slice(); let i = 0;
  for (let k = 0; k < 3 && i < reste.length; k++) {
    const bas = mm.length ? mm.reduce((a, b) => b.p < a.p ? b : a) : null;
    if (bas === null || reste[i].p <= bas.p) break;
    mm.splice(mm.indexOf(bas), 1, reste[i]); i++;
  }
  const comptes = [...fixes, ...mm, ...pris];
  const pts = comptes.reduce((s, x) => s + x.p, 0);
  return detail ? { pts, comptes: new Set(comptes) } : pts;
}
