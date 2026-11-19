/* Barème ATP 2026 (page « ATP rankings » de Wikipédia).
 * principal : [titre, finale, demie, quart, 8e, 16e, 32e, 64e] depuis la fin.
 * qualif : [qualifié, perdant du dernier tour, perdant de l'avant-dernier…]. */
export const BAREME = {
  'Grand Slam 128': { p: [2000, 1300, 800, 400, 200, 100, 50, 10], q: [30, 16, 8, 0] },
  'ATP 1000 96':   { p: [1000, 650, 400, 200, 100, 50, 30, 10], q: [20, 10, 0] },
  'ATP 1000 56':   { p: [1000, 650, 400, 200, 100, 50, 10], q: [30, 16, 0] },
  'ATP 500 48':    { p: [500, 330, 200, 100, 50, 25, 0], q: [16, 8, 0] },
  'ATP 500 32':    { p: [500, 330, 200, 100, 50, 0], q: [25, 13, 0] },
  'ATP 250 48':    { p: [250, 165, 100, 50, 25, 13, 0], q: [8, 4, 0] },
  'ATP 250 32':    { p: [250, 165, 100, 50, 25, 0], q: [13, 7, 0] },
  'ATP 250 28':    { p: [250, 165, 100, 50, 25, 0], q: [13, 7, 0] },
  'CH 175 32': { p: [175, 90, 50, 25, 13, 0], q: [6, 3, 0] },
  'CH 125 32': { p: [125, 64, 35, 16, 8, 0], q: [5, 3, 0] },
  'CH 100 32': { p: [100, 50, 25, 14, 7, 0], q: [4, 2, 0] },
  'CH 75 32':  { p: [75, 44, 22, 12, 6, 0], q: [4, 2, 0] },
  'CH 50 32':  { p: [50, 25, 14, 8, 4, 0], q: [3, 1, 0] },
};
/* points du tableau principal pour un parcours ; exempté puis battu d'entrée =
   points du perdant du premier tour */
export function pointsPrincipal(b, o, tours) {
  if (o.gagne) return b.p[0];
  if (o.first < tours && o.best === o.first) return b.p[Math.min(tours, b.p.length - 1)];
  return b.p[Math.min(o.best, b.p.length - 1)] ?? 0;
}
export function pointsQualif(b, o) { return o.gagne ? b.q[0] : (b.q[o.best] ?? 0); }
/* Challengers à 28 joueurs (4 exemptés) : même barème qu'à 32 */
BAREME['CH 175 28'] = BAREME['CH 175 32'];
BAREME['CH 125 28'] = BAREME['CH 125 32'];
