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

   Phase finale : les trois pages « knockout phase », lues de la même façon dès
   qu'elles existent (tirage de décembre) ; avant, on passe sans bruit.

   Sortie : wiki/affiches-AAAA-AA.json (bloc 0) : { "AAAA": [[compétition, étape, date, heure,
     club domicile, nation, club extérieur, nation, buts dom. | null, buts ext. | null]] },
     tous les matchs, joués ou à venir (bloc 0 : clubs français ; bloc 0b : la semaine).
   Sortie : wiki/ligue-AAAA-AA.json
     { "AAAA": { NAT: { club source: [[étape, compétition, club adverse, nation adverse, buts pour, buts contre, domicile]] } } }
     étape : 0…7 journées de ligue, 8 barrages KO, 9 huitièmes, 10 quarts, 11 demies, 12 finale
   Le fichier n'est réécrit que si son contenu change (pas d'horodatage dedans :
   pas de commit parasite). */
import fs from 'node:fs';
import os from 'node:os';
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

/* une page → [{ j, dom: {nom, pays}, ext: {nom, pays}, b: [a, b] }] pour les matchs joués.
   Phase de ligue : la journée se lit dans les intertitres « Matchday N » (j = 0…7).
   Phase finale : le tour se lit dans les titres de section (j = 8 barrages, 9 huitièmes,
   10 quarts, 11 demies, 12 finale). Score après prolongation ; les tirs au but, notés à
   part, ne comptent pas (nul). */
/* numéro UEFA du match, lu dans le lien « Report » de la boîte (direct, ou via
   la note de bas de page qui porte l'adresse uefa.com/…/match/NNNNNNN/) */
function idUEFA(box, doc) {
  const lu = a => { const m = /uefa\.com\/[^"' ]*\/match\/(\d{5,})/.exec(a.getAttribute('href') || ''); return m ? m[1] : null; };
  for (const a of box.querySelectorAll('a[href]')) { const v = lu(a); if (v) return v; }
  for (const a of box.querySelectorAll('a[href*="cite_note"]')) {
    const id = decodeURIComponent((a.getAttribute('href') || '').split('#')[1] || '');
    const li = id && doc.getElementById(id);
    if (li) for (const b of li.querySelectorAll('a[href]')) { const v = lu(b); if (v) return v; }
  }
  return null;
}

const TOURS_KO = { 'Knockout phase play-offs': 0, 'Knockout round play-offs': 0, 'Round of 16': 1, 'Quarter-finals': 2, 'Semi-finals': 3, 'Final': 4 };
export function lirePage(html, ko = false) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [], affiches = []; let j = -1, vus = 0;
  const equipe = th => {
    const img = th.querySelector('.flagicon img');
    const a = [...th.querySelectorAll('a')].find(x => !x.closest('.flagicon'));
    /* le pays se lit sur le texte du drapeau ; certains gabarits (la finale) y mettent
       le nom de la fédération : on se rabat alors sur le fichier du drapeau */
    const f = img && /Flag_of_(.+?)\.svg/.exec(decodeURIComponent((img.getAttribute('resource') || '') + ' ' + (img.getAttribute('src') || '')));
    return { nom: (a ? a.textContent : th.textContent).replace(/\s+/g, ' ').trim(), pays: img ? img.getAttribute('alt').trim() : null,
             drapeau: f ? f[1].replace(/_/g, ' ').replace(/^the /, '') : null };
  };
  for (const el of doc.querySelectorAll(ko ? 'h2, .footballbox' : 'h3, .footballbox')) {
    if (el.tagName === 'H3') { const m = /^Matchday\s+(\d+)/.exec(el.textContent.trim()); if (m) j = +m[1] - 1; continue; }
    if (el.tagName === 'H2') { const t = el.textContent.trim(); j = t in TOURS_KO ? 8 + TOURS_KO[t] : -1; continue; }
    if (j < 0) continue;
    vus++;
    const h = el.querySelector('th.fhome'), a = el.querySelector('th.faway'), s = el.querySelector('th.fscore');
    if (!h || !a || !s) continue;
    /* le tiret du score varie selon qui a saisi la page : demi-cadratin « 2–1 »,
       trait d'union, ou signe moins « 0−2 » (U+2212, J2 de 2026/27 : les scores
       de Lens et Lille passaient pour « pas encore joués »). On les accepte tous. */
    const m = /^\s*(\d+)\s*[-–—−‒:]\s*(\d+)/.exec(s.textContent);
    /* l'affiche, jouée ou non : date (ISO caché du gabarit) et heure de Paris (la
       page les donne en CET/CEST, l'heure locale suit entre parenthèses) */
    const d = el.querySelector('.bday, .dtstart'), t = el.querySelector('.ftime');
    const hm = t && /(\d{1,2}):(\d{2})/.exec(t.textContent);
    affiches.push({ j, dom: equipe(h), ext: equipe(a), b: m ? [+m[1], +m[2]] : null, uefa: idUEFA(el, doc),
                    date: d ? d.textContent.trim().slice(0, 10) : null, heure: hm ? hm[1].padStart(2, '0') + ':' + hm[2] : null });
    if (!m) continue;                                   // pas encore joué (« v », heure…)
    out.push({ j, dom: equipe(h), ext: equipe(a), b: [+m[1], +m[2]] });
  }
  return { matchs: out, cases: vus, affiches };
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

/* une page, par l'API de Wikimédia ; null si elle n'existe pas (encore) */
async function telecharge(titre) {
  for (let i = 1; ; i++) {
    try {
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 30_000);
      /* trois portes, de la plus récente à la plus ancienne : si Wikimédia en
         ferme une, la suivante sert (toutes rendent les mêmes « footballbox ») */
      const t = encodeURIComponent(titre), H = { signal: ac.signal, headers: { 'User-Agent': UA, 'Api-User-Agent': UA } };
      let err = '', absente = 0, html = null;
      const portes = [`https://en.wikipedia.org/w/rest.php/v1/page/${t}/html`,
                      `https://en.wikipedia.org/api/rest_v1/page/html/${t}`,
                      `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&page=${t}`];
      for (const u of portes) {
        const r = await fetch(u, H);
        if (!r.ok) { err += ` ${r.status}`; if (r.status === 404) absente++; continue; }
        if (u.includes('api.php')) { const j = await r.json(); if (j.error && j.error.code === 'missingtitle') { absente++; continue; } html = j.parse && j.parse.text; }
        else html = await r.text();
        if (html) break;
      }
      clearTimeout(to);
      if (html) return html;
      if (absente === portes.length) return null;
      throw new Error(`HTTP${err}`);
    } catch (e) {
      if (i >= 3) throw new Error(`${titre} : ${e.message}`);
      await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
}

/* ---------- horaires officiels de l'UEFA (30/10/2026) ----------
   Rennes–Olympiakos (C3, J4) avancé du jeudi 5 novembre 18h45 au mercredi 4,
   16h30, à la demande de la préfecture : l'UEFA l'avait aussitôt, Wikipédia non.
   À chaque passage, on relit donc le calendrier officiel (match.uefa.com, les
   données de uefa.com ; une requête par compétition et par page de 100) et on
   corrige date et heure de chaque affiche qui s'en écarte. Chaque correction
   est gardée dans wiki/reprog-AAAA-AA.json avec l'horaire d'origine, pour que
   la page puisse dire « avancé, initialement … ». Rapprochement : numéro UEFA
   lu dans la boîte Wikipédia, sinon les deux noms d'équipes à ±10 jours.
   Jamais bloquant : si l'UEFA ne répond pas, on applique les corrections déjà
   connues et on continue. */
const COMP_UEFA = [1, 14, 2019];                       // C1, C3, C4
const paris = iso => { const d = new Date(iso);
  const j = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const h = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return [j, h.replace(/\s/g, '').replace('h', ':')]; };
async function calendrierUEFA(saison) {
  const out = [], de = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10), a = new Date(Date.now() + 240 * 864e5).toISOString().slice(0, 10);
  for (let k = 0; k < 3; k++) for (let off = 0; off < 1000; off += 100) {
    const u = `https://match.uefa.com/v5/matches?competitionId=${COMP_UEFA[k]}&seasonYear=${saison}&fromDate=${de}&toDate=${a}&limit=100&offset=${off}&order=ASC`;
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`UEFA HTTP ${r.status}`);
    const L = await r.json();
    if (!Array.isArray(L)) throw new Error('réponse UEFA illisible');
    for (const x of L) if (x && x.id && x.kickOffTime && x.kickOffTime.dateTime)
      out.push({ k, id: String(x.id), t: x.kickOffTime.dateTime, dom: (x.homeTeam || {}).internationalName || '', ext: (x.awayTeam || {}).internationalName || '' });
    if (L.length < 100) break;
  }
  return out;
}
export async function recaleUEFA({ aff, meta, an, suf, ici, log }) {
  const f = path.join(ici, 'wiki', `reprog-${an}-${suf}.json`);
  const avant = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const R = avant ? JSON.parse(avant) : {};
  const cle = x => `${x[0]}|${x[1]}|${x[4]}|${x[6]}`;
  let U = null;
  try { U = await calendrierUEFA(+an + 1); log(`  UEFA : ${U.length} horaires officiels relus`); }
  catch (e) { log(`  ⚠ calendrier UEFA indisponible (${e.message}) : corrections connues seulement`); }
  const parId = U ? Object.fromEntries(U.map(u => [u.id, u])) : {};
  let vus = 0, corr = 0; const neufs = [];
  aff.forEach((x, i) => {
    const mt = meta[i], kk = cle(x);
    let u = null;
    if (U) {
      u = mt.uefa && parId[mt.uefa];
      if (!u && x[2]) {                                  // repli : les deux noms, à ±10 jours
        const t0 = Date.parse(x[2] + 'T12:00:00Z');
        let best = null, sc = 0;
        for (const v of U) { if (v.k !== x[0] || Math.abs(Date.parse(v.t) - t0) > 10 * 864e5) continue;
          const s = Math.min(proche(mt.wd, v.dom), proche(mt.we, v.ext)); if (s > sc) { sc = s; best = v; } }
        u = sc >= 2 ? best : null;
      }
    }
    if (u) { vus++;
      const [d, h] = paris(u.t);
      if (!x[2] || !x[3]) { x[2] = d; x[3] = h; }         // horaire manquant sur Wikipédia : on complète, sans parler de reprogrammation
      else if (d !== x[2] || h !== x[3]) {
        const o = R[kk] ? [R[kk][0], R[kk][1]] : [x[2], x[3]];
        if (!R[kk]) neufs.push(kk);
        if (!R[kk] || R[kk][2] !== d || R[kk][3] !== h) log(`  ↺ reprogrammé : ${x[4]} – ${x[6]} : ${x[2]} ${x[3]} → ${d} ${h} (UEFA)`);
        R[kk] = [o[0], o[1], d, h]; x[2] = d; x[3] = h; corr++;
      }
    } else if (R[kk]) { x[2] = R[kk][2]; x[3] = R[kk][3]; }  // UEFA muette : on garde la correction connue
  });
  /* Garde-fou : une vraie reprogrammation est rare. Plus de 15 écarts nouveaux
     d'un coup, c'est un décalage systématique (fuseau, gabarit) : on garde
     l'horaire UEFA, mais sans annoncer de reprogrammation. */
  if (neufs.length > 15) { log(`  ⚠ ${neufs.length} écarts d'horaire nouveaux d'un coup : décalage systématique probable, pas de mention « reprogrammé »`); for (const kk of neufs) delete R[kk]; }
  /* l'horaire d'origine suit l'affiche, pour la page */
  for (const x of aff) { const r = R[cle(x)]; if (r && (r[0] !== x[2] || r[1] !== x[3])) x[10] = [r[0], r[1]]; }
  if (U) log(`  UEFA : ${vus} affiches rapprochées sur ${aff.length}, ${corr} horaire(s) corrigé(s)`);
  const txt = JSON.stringify(Object.fromEntries(Object.keys(R).sort().map(c => [c, R[c]])));
  if (txt !== (avant || '{}') && Object.keys(R).length) fs.writeFileSync(f, txt);
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
  const res = {}, doutes = [], aff = [], meta = [];
  /* pour la veille du soir de match (soir.mjs) : combien de matchs de CE soir la
     page montre déjà avec leur score. Le « soir » est la date de Paris d'il y a
     six heures : à 1 h du matin, on parle encore de la veille. */
  const SOIR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - 6 * 3600e3));
  const soir = { soir: SOIR, prevus: 0, joues: 0 };
  let total = 0;
  for (let k = 0; k < 3; k++) for (const ko of [false, true]) {
    const titre = `${lab}_UEFA_${COMPS[k].replace(/ /g, '_')}_${ko ? 'knockout' : 'league'}_phase`;
    /* La page de phase finale n'existe qu'à partir du tirage de décembre : tant
       qu'elle manque, on passe sans bruit. Celle de la ligue, elle, est exigée. */
    let html = pages ? (Array.isArray(pages) ? (ko ? null : pages[k]) : (pages[k] || {})[ko ? 'ko' : 'ligue']) : await telecharge(titre);
    if (!html) { if (!ko && !pages) throw new Error(`${titre} : page introuvable`); continue; }
    const { matchs, cases, affiches } = lirePage(html, ko);
    if (!ko && cases < 100) throw new Error(`${titre} : ${cases} matchs au calendrier, la page a changé de forme`);
    if (ko && cases < 20) { log(`  ⚠ ${titre} : ${cases} matchs au calendrier, phase finale ignorée`); continue; }
    for (const x of matchs) {
      const pays = e => code[ALIAS[e.pays] || e.pays] || code[ALIAS[e.drapeau] || e.drapeau];
      const cd = pays(x.dom), ce = pays(x.ext);
      if (!cd || !ce) { doutes.push(`pays inconnu : ${x.dom.pays} / ${x.ext.pays}`); continue; }
      const sd = nomSource(x.dom.nom, cd, k), se = nomSource(x.ext.nom, ce, k);
      if (!sd || !se) { doutes.push(`club non rapproché : ${!sd ? x.dom.nom + ' (' + cd + ')' : x.ext.nom + ' (' + ce + ')'}`); continue; }
      ((res[cd] = res[cd] || {})[sd] = res[cd][sd] || []).push([x.j, k, se, ce, x.b[0], x.b[1], 1]);
      ((res[ce] = res[ce] || {})[se] = res[ce][se] || []).push([x.j, k, sd, cd, x.b[1], x.b[0], 0]);
      total++;
    }
    /* toutes les affiches, jouées ou à venir, avec leur date : le bloc 0 (survol,
       clubs français) et le bloc 0b (la semaine européenne, toutes nations) */
    for (const x of affiches) {
      const pays = e => code[ALIAS[e.pays] || e.pays] || code[ALIAS[e.drapeau] || e.drapeau];
      const cd = pays(x.dom), ce = pays(x.ext);
      if (!cd || !ce) continue;
      const nd = nomSource(x.dom.nom, cd, k) || x.dom.nom, ne = nomSource(x.ext.nom, ce, k) || x.ext.nom;
      aff.push([k, x.j, x.date, x.heure, nd, cd, ne, ce, ...(x.b || [null, null])]);
      meta.push({ uefa: x.uefa, wd: x.dom.nom, we: x.ext.nom });
    }
    log(`  Wikipédia ${(COMPS[k] + (ko ? ', phase finale' : '')).padEnd(31)} ${matchs.length} matchs joués sur ${cases}`);
  }
  /* dates et heures : l'UEFA fait foi (matchs avancés ou reportés, que
     Wikipédia peut mettre des jours à reporter) */
  try { await recaleUEFA({ aff, meta, an, suf: m[2].slice(2), ici, log }); }
  catch (e) { log(`  ⚠ horaires UEFA non vérifiés : ${e.message}`); }
  for (const x of aff) if (x[2] === SOIR) { soir.prevus++; if (x[8] != null) soir.joues++; }
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
  /* affiches : fichier à part, réécrit seulement s'il change */
  aff.sort((a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2])) || String(a[3]).localeCompare(String(b[3])) || a[4].localeCompare(b[4]));
  const fa = path.join(ici, 'wiki', `affiches-${an}-${m[2].slice(2)}.json`), ta = JSON.stringify({ [an]: aff });
  const affNeuf = ta !== (fs.existsSync(fa) ? fs.readFileSync(fa, 'utf8') : '');
  if (affNeuf) fs.writeFileSync(fa, ta);
  try { fs.writeFileSync(path.join(os.tmpdir(), 'grotang-soir.json'), JSON.stringify(soir)); } catch {}
  if (soir.prevus) log(`  ce soir (${SOIR}) : ${soir.joues} match(s) sur ${soir.prevus} avec leur score sur Wikipédia`);
  log(`  affiches (toutes nations) : ${aff.length}${affNeuf ? ', fichier mis à jour' : ', inchangées'}`);
  const texte = JSON.stringify({ [an]: tri(res) });
  const f = path.join(ici, 'wiki', `ligue-${an}-${m[2].slice(2)}.json`);
  const avant = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (texte === avant) { log(`  matchs de ligue : ${total}, inchangés`); return affNeuf; }
  fs.writeFileSync(f, texte);
  log(`  matchs de ligue : ${total}, fichier mis à jour`);
  return true;
}
