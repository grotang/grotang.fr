/* Lecture d'une page de tableau Wikipédia (simple messieurs) : le tableau
 * principal et, s'il y en a, les tableaux de qualification (un par place de
 * qualifié). Sortie : pour chaque joueur, son parcours. */
import { lireTableau, nomJoueur } from '../../tennis/wiki.mjs';

/* découpe en sections de niveau 2 (== Titre ==) */
function sections(t) {
  const re = /^==([^=].*?)==\s*$/gm, out = []; let m, prec = null;
  while ((m = re.exec(t))) { if (prec) prec.fin = m.index; prec = { titre: m[1].trim(), debut: m.index, fin: t.length }; out.push(prec); }
  return out.map(s => ({ titre: s.titre, texte: t.slice(s.debut, s.fin) }));
}
/* sous-sections de niveau 3 (=== Titre ===) */
function sousSections(t) {
  const re = /^={3,5}([^=].*?)={3,5}\s*$/gm, out = []; let m, prec = null;
  while ((m = re.exec(t))) { if (prec) prec.fin = m.index; prec = { titre: m[1].trim(), debut: m.index, fin: t.length }; out.push(prec); }
  return out.map(s => ({ titre: s.titre, texte: t.slice(s.debut, s.fin) }));
}
/* Un tableau lu → { joueurs: {nom: {best, first, gagne, lien}}, tours } ;
   best = plus petite étape atteinte (1 = finale), first = première étape jouée. */
function parcours(L) {
  const E = L.etapes, tours = Math.max(...Object.keys(E).map(Number));
  const j = {};
  for (const [e, X] of Object.entries(E)) for (const x of X.tous) {
    const o = j[x.nom] = j[x.nom] || { best: 99, first: 0, gagne: false, lien: x.lien };
    o.best = Math.min(o.best, +e); o.first = Math.max(o.first, +e);
  }
  for (const x of (E[1] || { tous: [] }).tous) if (x.gras && j[x.nom]) j[x.nom].gagne = true;
  for (const X of Object.values(E)) for (const x of X.tous) if (j[x.nom] && x.nat) j[x.nom].nat = x.nat;
  /* Même joueur écrit autrement dans le carré final (« Adolfo Daniel Vallejo » /
     « Daniel Vallejo », Båstad 2026) : on le rattache au joueur du même nom de
     famille arrivé en haut de sa section. */
  const haut = Object.keys(E).map(Number).filter(e => E[e].places <= 4).reduce((a, b) => Math.max(a, b), 0);
  for (const [n, o] of Object.entries(j)) {
    if (o.first > haut) continue;
    const fam = n.split(' ').pop();
    const autre = Object.entries(j).find(([m, p]) => m !== n && m.split(' ').pop() === fam && p.best === haut + 1);
    if (!autre) continue;
    const p = autre[1]; p.best = Math.min(p.best, o.best); p.gagne = p.gagne || o.gagne; delete j[n];
  }
  return { joueurs: j, tours, alertes: L.alertes };
}
export function lirePageTableau(t, qualifSeule = false) {
  const S = sections(t);
  const main = qualifSeule ? null : S.find(s => /^(main )?draw$/i.test(s.titre));
  const qual = qualifSeule ? S.find(s => /^draw$/i.test(s.titre)) : S.find(s => /qualif/i.test(s.titre));
  const res = { principal: null, qualifs: [] };
  if (main) { const L = lireTableau(main.texte); if (L) res.principal = parcours(L); }
  if (qual) for (const ss of sousSections(qual.texte)) {
    if (!/qualifier/i.test(ss.titre) || /^qualifiers$/i.test(ss.titre)) continue;
    const L = lireTableau(ss.texte); if (L) res.qualifs.push(parcours(L));
  }
  return res;
}
