/* Matchs de phase de ligue de la saison en cours, club par club (bloc 6b :
   une case de gaufre = un match, le match au survol).

   POURQUOI WIKIPÉDIA. La source du site (5-jahres-wertung, pages publiques)
   donne les bilans V/N/D de chaque club, jamais la liste des matchs ; celle-ci
   n'existe que dans son espace membres, qu'on ne lit pas. Les pages « league
   phase » de Wikipédia, elles, donnent chaque match (date, équipes, drapeau,
   score) et sont tenues à jour le soir même. Leur lecture par un robot est
   permise : on passe par l'API REST de Wikimédia, avec un User-Agent qui dit
   qui on est, trois pages par passage.

   ON NE FAIT PAS CONFIANCE AVEUGLE. La page ne montre un match que s'il recoupe
   le bilan officiel du club (voir suite() dans page.html) : si Wikipédia est en
   retard ou se trompe, la case reste sans détail, elle ne montre jamais un faux
   match.

   JAMAIS BLOQUANT. Un échec ici (réseau, page renommée, gabarit changé) est
   signalé dans le journal et laisse le fichier de la veille : le rafraîchissement
   du coefficient continue comme si de rien n'était.

   Sortie : wiki/ligue-AAAA-AA.json
     { "AAAA": { NAT: { club source: [[journée 0..7, compétition, club adverse, nation adverse, buts pour, buts contre, domicile]] } } }
   Le fichier n'est réécrit que si son contenu change (pas d'horodatage dedans :
   pas de commit parasite). */
import fs from 'node:fs';
import path from 'node:path';
import { DOMParser } from 'linkedom';

const COMPS = ['Champions League', 'Europa League', 'Conference League'];
const UA = 'grotang.fr-robot/1.0 (https://grotang.fr; coefficient UEFA, une lecture par soir de match)';
const ALIAS = { 'Bosnia and Herzegovina': 'Bosnia & Herzegovina', 'Georgia (country)': 'Georgia' };
const EGAL = { 'Red Star Belgrade': 'Crvena Zvezda', 'Dynamo Kyiv': 'Dinamo Kiev', 'Partizan': 'Partizan Belgrade' };
const VIDE = new Set('fc fk sc cf ac as sk nk afc cd club de fs ks sv bk if ff sp cs kf gks mfk pfc ofk hnk sd ud rc the united city 1 2'.split(' '));

const jetons = s => {
  const t = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const u = t.filter(x => !VIDE.has(x));
  return new Set(u.length ? u : t);
};
const norme = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
/* Même règle que sankey-clubs.py, plus un départage sur TOUS les mots : sans lui,
   « Manchester United » et « Manchester City » se réduisent tous deux à
   « manchester » (united et city sont des mots vides) et se confondent. */
const proche = (a, b) => {
  const A = jetons(a), B = jetons(b);
  let n = 0, pref = 0;
  for (const x of A) { if (B.has(x)) n++; for (const y of B) if (x !== y && x.length > 3 && y.length > 3 && (x.startsWith(y.slice(0, 4)) || y.startsWith(x.slice(0, 4)))) pref++; }
  const FA = new Set(norme(a)), FB = norme(b);
  return 2 * n + pref + 0.5 * FB.filter(x => FA.has(x)).length;
};

/* une page → [{ j, dom: {nom, pays}, ext: {nom, pays}, b: [a, b] }] pour les matchs joués */
export function lirePage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = []; let j = -1, vus = 0;
  const equipe = th => {
    const img = th.querySelector('.flagicon img');
    const a = [...th.querySelectorAll('a')].find(x => !x.closest('.flagicon'));
    return { nom: (a ? a.textContent : th.textContent).replace(/\s+/g, ' ').trim(), pays: img ? img.getAttribute('alt').trim() : null };
  };
  for (const el of doc.querySelectorAll('h3, .footballbox')) {
    if (el.tagName === 'H3') { const m = /^Matchday\s+(\d+)/.exec(el.textContent.trim()); if (m) j = +m[1] - 1; continue; }
    if (j < 0) continue;
    vus++;
    const h = el.querySelector('th.fhome'), a = el.querySelector('th.faway'), s = el.querySelector('th.fscore');
    if (!h || !a || !s) continue;
    const m = /^\s*(\d+)\s*[–-]\s*(\d+)/.exec(s.textContent);
    if (!m) continue;                                   // pas encore joué (« v », heure…)
    out.push({ j, dom: equipe(h), ext: equipe(a), b: [+m[1], +m[2]] });
  }
  return { matchs: out, cases: vus };
}

/* nom Wikipédia → nom source, nation par nation */
function rapprocheur(eff, carte) {
  return (nom, c, k) => {
    const rows = eff[c] || [];
    if (carte[c] && carte[c][nom] && rows.some(r => r[0] === carte[c][nom])) return carte[c][nom];
    if (EGAL[nom] && rows.some(r => r[0] === EGAL[nom])) return EGAL[nom];
    const exact = rows.find(r => norme(r[0]).join(' ') === norme(nom).join(' '));
    if (exact) return exact[0];
    const cand = rows.filter(r => r[1] === k).map(r => r[0]);
    const liste = cand.length ? cand : rows.map(r => r[0]);
    if (liste.length === 1) return liste[0];
    let best = null, sc = 0;
    for (const n of liste) { const v = proche(nom, n); if (v > sc) { sc = v; best = n; } }
    return sc > 0 ? best : null;
  };
}

export async function majLigue({ data, ici, log, pages = null }) {
  const m = /^(\d{4})\/(\d{4})$/.exec(data.meta.season || '');
  if (!m) throw new Error(`saison illisible : ${data.meta.season}`);
  const an = m[1], lab = `${an}–${m[2].slice(2)}`;
  const nations = JSON.parse(fs.readFileSync(path.join(ici, 'nations.json'), 'utf8'));
  const code = Object.fromEntries(nations.map(n => [n.n, n.c]));
  const fCarte = path.join(ici, 'wiki', `noms-${an}-${m[2].slice(2)}.json`);
  const carte = fs.existsSync(fCarte) ? JSON.parse(fs.readFileSync(fCarte, 'utf8')) : {};
  const eff = data.eff || {};
  const nomSource = rapprocheur(eff, carte);
  const res = {}, doutes = [];
  let total = 0;
  for (let k = 0; k < 3; k++) {
    const titre = `${lab}_UEFA_${COMPS[k].replace(/ /g, '_')}_league_phase`;
    let html;
    if (pages) html = pages[k];
    else {
      for (let i = 1; ; i++) {
        try {
          const ac = new AbortController(), to = setTimeout(() => ac.abort(), 30_000);
          /* trois portes, de la plus récente à la plus ancienne : si Wikimédia en
             ferme une, la suivante sert (toutes rendent les mêmes « footballbox ») */
          const t = encodeURIComponent(titre), H = { signal: ac.signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } };
          let err = '';
          for (const u of [`https://en.wikipedia.org/w/rest.php/v1/page/${t}/html`,
                           `https://en.wikipedia.org/api/rest_v1/page/html/${t}`,
                           `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&page=${t}`]) {
            const r = await fetch(u, H);
            if (!r.ok) { err += ` ${r.status}`; continue; }
            html = u.includes('api.php') ? (await r.json()).parse?.text : await r.text();
            if (html) break;
          }
          clearTimeout(to);
          if (!html) throw new Error(`HTTP${err}`);
          break;
        } catch (e) {
          if (i >= 3) throw new Error(`${titre} : ${e.message}`);
          await new Promise(r => setTimeout(r, 3000 * i));
        }
      }
    }
    if (!html) continue;
    const { matchs, cases } = lirePage(html);
    if (cases < 100) throw new Error(`${titre} : ${cases} matchs au calendrier, la page a changé de forme`);
    for (const x of matchs) {
      const cd = code[ALIAS[x.dom.pays] || x.dom.pays], ce = code[ALIAS[x.ext.pays] || x.ext.pays];
      if (!cd || !ce) { doutes.push(`pays inconnu : ${x.dom.pays} / ${x.ext.pays}`); continue; }
      const sd = nomSource(x.dom.nom, cd, k), se = nomSource(x.ext.nom, ce, k);
      if (!sd || !se) { doutes.push(`club non rapproché : ${!sd ? x.dom.nom + ' (' + cd + ')' : x.ext.nom + ' (' + ce + ')'}`); continue; }
      ((res[cd] = res[cd] || {})[sd] = res[cd][sd] || []).push([x.j, k, se, ce, x.b[0], x.b[1], 1]);
      ((res[ce] = res[ce] || {})[se] = res[ce][se] || []).push([x.j, k, sd, cd, x.b[1], x.b[0], 0]);
      total++;
    }
    log(`  Wikipédia ${COMPS[k].padEnd(17)} ${matchs.length} matchs joués sur ${cases}`);
  }
  for (const c in res) for (const n in res[c]) res[c][n].sort((a, b) => a[0] - b[0]);
  /* recoupement avec le bilan officiel : pour information ici, la page fait le tri */
  let accord = 0, ecart = 0;
  for (const c in eff) for (const r of eff[c]) {
    if (r.length < 10) continue;
    const t = [0, 0, 0]; for (const x of (res[c] || {})[r[0]] || []) t[x[4] > x[5] ? 0 : x[4] === x[5] ? 1 : 2]++;
    if (t[0] === r[7] && t[1] === r[8] && t[2] === r[9]) accord++;
    else { ecart++; if (t[0] + t[1] + t[2] > r[7] + r[8] + r[9]) log(`  · ${c} ${r[0]} : Wikipédia en avance sur la source (${t} contre ${r.slice(7, 10)})`);
           else if (t[0] + t[1] + t[2]) log(`  · ${c} ${r[0]} : Wikipédia ${t}, source ${r.slice(7, 10)}`); }
  }
  log(`  recoupement avec la source : ${accord} clubs d'accord, ${ecart} en attente ou en écart (sans détail affiché)`);
  for (const d of [...new Set(doutes)]) log('  ⚠ ' + d);
  const tri = o => Object.fromEntries(Object.keys(o).sort().map(c => [c, Object.fromEntries(Object.keys(o[c]).sort().map(n => [n, o[c][n]]))]));
  const texte = JSON.stringify({ [an]: tri(res) });
  const f = path.join(ici, 'wiki', `ligue-${an}-${m[2].slice(2)}.json`);
  const avant = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (texte === avant) { log(`  matchs de ligue : ${total}, inchangés`); return false; }
  fs.writeFileSync(f, texte);
  log(`  matchs de ligue : ${total}, fichier mis à jour`);
  return true;
}
