/* Catalogue d'une saison : chaque tournoi de simple messieurs (ATP et
 * Challenger), avec sa semaine, sa catégorie, la taille du tableau et la page
 * Wikipédia de son tableau. Entrées : wikitexte de « AAAA ATP Tour » et de
 * « AAAA ATP Challenger Tour ». */
const MOIS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
/* une date de décembre avant toute date de janvier : semaine de l'année d'avant
   (« 30 Dec » en tête de la saison 2025 = 30 décembre 2024) */
const lundiSaison = (an, txt, vu) => { const d = lundi(an, txt); if (!d) return d;
  if (d.slice(5, 7) === '01') vu.jan = true;
  return d.slice(5, 7) === '12' && !vu.jan ? `${an - 1}${d.slice(4)}` : d; };
const lundi = (an, txt) => {
  const m = /(\d{1,2})\s+([A-Za-z]+)|([A-Za-z]+)\s+(\d{1,2})/.exec(txt); if (!m) return null;
  const j = +(m[1] || m[4]), mo = MOIS[(m[2] || m[3]).toLowerCase()]; if (mo === undefined) return null;
  return new Date(Date.UTC(an, mo, j)).toISOString().slice(0, 10);
};
export function catalogueATP(t, an) {
  const out = [], vu = {}; let sem = null, fin = null;
  const corps = t.slice(t.indexOf('==Schedule=='), t.indexOf('== Statistical information =='));
  for (const ligne of corps.split(/\n\|-[^\n]*\n/)) {
    /* cellule de semaine : « 5 Jan », ou « 3 Aug<br>10 Aug » pour un tournoi sur deux semaines */
    const w = /^\|\s*rowspan="?\d+"?\s*\|\s*([^|\n]+?)\s*(?:\|\||\n|$)/.exec(ligne);
    if (w) { const ds = w[1].split(/<br\s*\/?>/i).map(x => lundiSaison(an, x, vu)).filter(Boolean); if (ds.length) { sem = ds[0]; fin = ds[ds.length - 1]; } }
    const dl = /\{\{dl2\|([^|}]+)\|([^}]*)\}\}/.exec(ligne);
    const cat = /(Grand Slam|ATP Masters 1000|ATP 1000|ATP 500|ATP 250|United Cup|ATP Finals|Next Gen[^<]*)/.exec(ligne);
    if (!cat) continue;
    const taille = +((/(\d+)S\//.exec(ligne) || [])[1] || 0);
    let page = null;
    if (dl) page = dl[1] + (/\bMS=1/.test(dl[2]) ? " – Men's singles" : /\bS=1/.test(dl[2]) ? ' – Singles' : '');
    /* saison terminée : lien écrit en clair, « [[2025 Rolex Paris Masters – Singles|Singles]] » */
    else page = (/\[\[(\d{4} [^\]|]*[–-] (?:Men's )?[Ss]ingles)\|/.exec(ligne) || [])[1] || null;
    const tourn = (/\[\[(\d{4} [^|\]]+)/.exec(ligne) || [])[1];
    out.push({ circuit: 'ATP', semaine: sem, fin, tournoi: tourn, page, cat: cat[1].replace('ATP Masters 1000', 'ATP 1000'), taille });
  }
  return out;
}
export function catalogueChallenger(t, an) {
  const out = [], vu = {}; let sem = null;
  const corps = t.slice(t.indexOf('== Schedule =='));
  for (const ligne of corps.split(/\n\|-[^\n]*\n/)) {
    const w = /^\|\s*rowspan="?\d+"?\s*\|\s*([A-Za-z]+ \d{1,2})(?:\{\{efn[^]*?\}\})?\s*(?:\|\||\n|$)/.exec(ligne); if (w) { const d = lundiSaison(an, w[1], vu); if (d) sem = d; }
    const cat = /Challenger (175|125|100|75|50) – (\d+)S/.exec(ligne); if (!cat) continue;
    const page = (/\[\[(\d{4} [^\]|]*[–-] (?:Men's )?[Ss]ingles)\|/.exec(ligne) || [])[1] || null;
    const tourn = (/\[\[([^|\]]+)/.exec(ligne) || [])[1];
    out.push({ circuit: 'CH', semaine: sem, fin: sem, tournoi: tourn, page, cat: 'CH ' + cat[1], taille: +cat[2] });
  }
  return out;
}
