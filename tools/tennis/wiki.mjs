/* Lecture d'un tableau de simple messieurs de Grand Chelem sur Wikipédia (en).
 *
 * Entrée : le wikitexte brut d'une page « AAAA <tournoi> – Men's singles ».
 * Sortie : pour chaque tour, le nombre de Français présents, le nombre de
 *          places du tour et le nombre de places déjà remplies (un tour est
 *          « complet » quand toutes ses places portent un joueur ou un « Bye »).
 *
 * Les tableaux sont des modèles {{…Bracket…}} : un carré final (sous un titre
 * « Finals ») et des sections (« Section 1 »…). On ne se fie PAS aux noms de
 * tours (RD1=First round…) : ils manquent sur la moitié des pages, ou sont
 * faux. On compte depuis la fin, par la structure : dans le carré final, son
 * dernier tour est la finale ; chaque section alimente son premier tour.
 *
 * Un Français = une case dont le drapeau est FRA ({{flagicon|FRA}},
 * {{flagicon|FRA|…}}, {{flagathlete|…|FRA}}…). Le vainqueur d'un match est
 * en gras ('''…''') : le titre se lit dans la finale.
 *
 * Aucune dépendance : ce fichier se colle aussi tel quel dans un navigateur
 * (sans les « export ») pour un relevé à la main. */

/* Les colonnes de la page, dans l'ordre. T1-T3 se comptent depuis le début du
   tableau, H (8es) et la suite depuis la fin : sur un tableau de 64, le 3e
   tour EST le 8e de finale et les deux colonnes portent le même chiffre. */
export const TOURS = ['T1', 'T2', 'T3', 'H', 'Q', 'S', 'F', 'V'];

/* Découpe un modèle {{…}} commençant en i : renvoie [nom, params, fin]. Les
   barres verticales à l'intérieur d'un {{…}} ou d'un [[…]] imbriqué ne
   séparent pas les paramètres. */
function modele(t, i) {
  let prof = 0, lien = 0, j = i, debut = i + 2;
  const morceaux = [];
  for (; j < t.length; j++) {
    const a = t[j], b = t[j + 1];
    if (a === '{' && b === '{') { prof++; j++; continue; }
    if (a === '}' && b === '}') { prof--; if (prof === 0) { morceaux.push(t.slice(debut, j)); break; } j++; continue; }
    if (a === '[' && b === '[') { lien++; j++; continue; }
    if (a === ']' && b === ']') { lien--; j++; continue; }
    if (a === '|' && prof === 1 && lien === 0) { morceaux.push(t.slice(debut, j)); debut = j + 1; }
  }
  const nom = (morceaux.shift() || '').trim();
  const params = {};
  for (const m of morceaux) {
    const k = m.indexOf('=');
    if (k > 0) params[m.slice(0, k).trim()] = m.slice(k + 1).trim();
  }
  return [nom, params, j + 2];
}

const FRA = /\{\{\s*flag[a-z]*\s*\|[^{}]*\bFRA\b[^{}]*\}\}|\{\{\s*FRA\s*[|}]/i;
/* La nation d'une case : le code du drapeau ({{flagicon|ESP}},
   {{flagicon|RSA|1928}}, {{flagathlete|[[…]]|SUI}}, {{flagicon|USSR}}, {{FRA}}…),
   celui de l'époque tel que Wikipédia l'affiche : un joueur naturalisé change
   de nation d'une édition à l'autre. null si la case n'a pas de drapeau
   (Russes et Biélorusses depuis 2022 : {{flagicon|}}). */
const DRAPEAU = /\{\{\s*flag[a-z]*\s*\|([^{}]*)\}\}/i;
/* Wikipédia mêle codes CIO, codes ISO et noms en toutes lettres : tout est
   ramené au code CIO. FRG (RFA) est rangée avec GER : même État. TCH, URS,
   YUG restent à part : leurs successeurs sont plusieurs. */
export const CODE = {
  CHE: 'SUI', SWI: 'SUI', DEU: 'GER', FRG: 'GER', ZAF: 'RSA', NLD: 'NED', CHL: 'CHI', DNK: 'DEN', GRC: 'GRE',
  PRY: 'PAR', URY: 'URU', ZWE: 'ZIM', NGA: 'NGR', CSK: 'TCH', BHS: 'BAH', HTI: 'HAI', PRI: 'PUR', PRT: 'POR',
  HRV: 'CRO', BGR: 'BUL', PHL: 'PHI', CRI: 'CRC', MCO: 'MON', SVN: 'SLO', LIT: 'LTU', SER: 'SRB', SPA: 'ESP',
  ROM: 'ROU', UAR: 'EGY', FRY: 'SCG', IRI: 'IRI', IRN: 'IRI', IDN: 'INA', TWN: 'TPE', LVA: 'LAT', MAR: 'MAR', DZA: 'ALG',
  Rhodesia: 'RHO', USSR: 'URS', 'Soviet Union': 'URS', Spain: 'ESP', Haiti: 'HAI', 'South Africa': 'RSA',
  'SFR Yugoslavia': 'YUG', Yugoslavia: 'YUG', Czechoslovakia: 'TCH', UK: 'GBR', 'Great Britain': 'GBR',
  'United Kingdom': 'GBR', NZ: 'NZL', 'New Zealand': 'NZL', Zimbabwe: 'ZIM', US: 'USA', 'United States': 'USA',
  Slovakia: 'SVK', Argentina: 'ARG', France: 'FRA', Australia: 'AUS', 'West Germany': 'GER', Germany: 'GER',
  Russia: 'RUS', Belarus: 'BLR', Italy: 'ITA', Sweden: 'SWE', Switzerland: 'SUI', Serbia: 'SRB',
};
const code = x => CODE[x] || (/^[A-Z]{3}$/.test(x) ? x : null);
export function natDe(v) {
  const m = DRAPEAU.exec(v);
  if (m) {
    const p = m[1].split('|').map(x => x.trim());
    const c = p.find(x => /^[A-Z]{3}$/.test(x)) || p.find(x => CODE[x]);
    if (c) return code(c);
  }
  const n = /\{\{\s*([A-Z]{3})\s*[|}]/.exec(v);
  return n ? code(n[1]) : null;
}
const BYE = /\bbye\b/i;
const GRAS = /'''/;
const rempli = v => !!v && (/\[\[|\{\{\s*flag/i.test(v) || BYE.test(v));

/* Nom d'un joueur : la cible du lien, sans la précision d'homonymie
   (« Gilles Simon (tennis) » → « Gilles Simon »). */
export function nomJoueur(v) {
  const m = /\[\[([^\]|]+)/.exec(v);
  if (m) return m[1].replace(/\s*\([^)]*\)\s*$/, '').replace(/_/g, ' ').trim();
  /* joueur sans article (lien absent) : le texte de la case */
  const x = v.replace(/\{\{[^{}]*\}\}/g, ' ').replace(/'''|<[^>]*>|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return x || '?';
}

/* Titre de section qui précède la position i (« === Finals === »…) */
function titreAvant(t, i) {
  const m = [...t.slice(0, i).matchAll(/^={2,}\s*([^=\n]+?)\s*={2,}\s*$/gm)].pop();
  return m ? m[1] : '';
}

/* Lit le tableau. Renvoie { etapes, prelim, alertes } :
   etapes[e] = { places, remplies, fra, gras, fraGras, noms, nomsGras } avec e compté
   depuis la fin (1 = finale, 2 = demies, 3 = quarts, 4 = 8es…).
   Certaines pages répètent les 8es : le dernier tour des sections a alors
   autant de places que le premier tour du carré final, et on ne compte que
   le carré final. */
export function lireTableau(t) {
  const re = /\{\{\s*[^{}|\n]*Bracket/gi;
  const bs = [];
  let m;
  while ((m = re.exec(t))) {
    const [nom, params, fin] = modele(t, m.index);
    const prof = Math.max(0, ...Object.keys(params).map(k => +((/^RD(\d+)-team/.exec(k) || [])[1] || 0)));
    if (prof) bs.push({ nom, params, prof, titre: titreAvant(t, m.index) });
    re.lastIndex = fin;
  }
  if (!bs.length) return null;
  const alertes = [];
  let iF = bs.findIndex(b => /final/i.test(b.titre));
  if (iF < 0) { iF = bs.length - 1; alertes.push('carré final deviné'); }
  const finale = bs[iF];
  const cle = d => new RegExp('^RD' + d + '-team\\d+$');
  const places = (b, d) => Object.keys(b.params).filter(k => cle(d).test(k)).length;
  const sections = bs.filter((_, i) => i !== iF);
  const dernier = sections.reduce((a, b) => a + places(b, b.prof), 0);
  const tete = places(finale, 1);
  const recouvre = sections.length > 0 && dernier === tete;
  if (sections.length && !recouvre && dernier !== 2 * tete) alertes.push(`sections ${dernier} / carré final ${tete}`);

  const etapes = {};
  const compter = (b, d, e) => {
    const E = etapes[e] = etapes[e] || { places: 0, remplies: 0, fra: 0, gras: 0, fraGras: 0, noms: [], nomsGras: [], tous: [] };
    for (const [k, v] of Object.entries(b.params)) {
      if (!cle(d).test(k)) continue;
      E.places++;
      if (rempli(v)) E.remplies++;
      if (BYE.test(v)) continue;
      const f = FRA.test(v), g = GRAS.test(v);
      if (rempli(v)) E.tous.push({ nom: nomJoueur(v), lien: (/\[\[([^\]|]+)/.exec(v) || [])[1] || null, nat: natDe(v), gras: g });
      if (f) { E.fra++; E.noms.push(nomJoueur(v)); }
      if (g) E.gras++;
      if (f && g) { E.fraGras++; E.nomsGras.push(nomJoueur(v)); }
    }
  };
  for (let d = 1; d <= finale.prof; d++) compter(finale, d, finale.prof - d + 1);
  for (const b of sections) {
    const dMax = recouvre ? b.prof - 1 : b.prof;
    for (let d = 1; d <= dMax; d++) compter(b, d, finale.prof + 1 + (dMax - d));
  }
  for (const [e, E] of Object.entries(etapes))
    if (E.places !== 2 ** +e) alertes.push(`étape ${e} : ${E.places} places au lieu de ${2 ** +e}`);

  /* tour préliminaire : le premier tour d'une section porte ce nom */
  const prelim = sections.some(b => /prelim|qualif/i.test(b.params.RD1 || ''));
  return { etapes, prelim, alertes };
}

/* Ramène le tableau aux huit colonnes de la page.
   Chaque colonne vaut [nombre de Français, état] ; état : 'c' tour complet,
   'p' commencé (des places restent vides), 'v' pas commencé. null si le tour
   n'existe pas dans ce tableau. */
export function colonnes(L) {
  if (!L) return null;
  const E = L.etapes;
  const plein = e => E[e] && E[e].places === 2 ** e;
  let t1 = Math.max(...Object.keys(E).map(Number));
  /* tour préliminaire (1968-1972) : le 1er tour est le plus haut tour complet */
  if (L.prelim) while (t1 > 1 && !plein(t1)) t1--;
  const etat = x => x.remplies === x.places ? 'c' : x.remplies === 0 ? 'v' : 'p';
  const de = e => E[e] ? [E[e].fra, etat(E[e])] : null;
  const c = { T1: de(t1), T2: de(t1 - 1), T3: de(t1 - 2), H: de(4), Q: de(3), S: de(2), F: de(1) };
  /* exemptés non dessinés (vieux tableaux à 48, 56, 96 joueurs) : un joueur
     exempté du 1er tour apparaît directement au 2e. Le 1er tour compte tous
     les Français du tableau : ceux du 1er tour, plus ceux du 2e qui n'en
     viennent pas (les vainqueurs du 1er tour sont en gras). */
  if (!L.prelim && !plein(t1) && E[t1 - 1])
    c.T1 = [E[t1].fra + E[t1 - 1].fra - E[t1].fraGras, c.T1[1]];
  /* titre : le Français en gras en finale ; la finale est jouée quand l'un des
     deux finalistes est en gras */
  c.V = E[1] ? [E[1].fraGras, E[1].gras >= 1 && E[1].remplies === 2 ? 'c' : 'v'] : null;
  return c;
}

/* Les Français de chaque colonne, par leur nom (même découpage que
   colonnes()). Le 1er tour d'un vieux tableau à exemptés réunit les deux
   premiers tours : un joueur présent aux deux n'est compté qu'une fois. */
export function nomsColonnes(L, nat = null) {
  if (!L) return null;
  const E = L.etapes;
  const plein = e => E[e] && E[e].places === 2 ** e;
  let t1 = Math.max(...Object.keys(E).map(Number));
  if (L.prelim) while (t1 > 1 && !plein(t1)) t1--;
  /* sans nation : les Français (noms relevés par le drapeau FRA) ; avec une
     nation : les joueurs dont le drapeau porte ce code */
  const noms = e => nat ? E[e].tous.filter(x => x.nat === nat).map(x => x.nom) : E[e].noms;
  const gras = e => nat ? E[e].tous.filter(x => x.nat === nat && x.gras).map(x => x.nom) : E[e].nomsGras;
  const de = e => E[e] ? [...noms(e)] : null;
  const c = { T1: de(t1), T2: de(t1 - 1), T3: de(t1 - 2), H: de(4), Q: de(3), S: de(2), F: de(1) };
  if (!L.prelim && !plein(t1) && E[t1 - 1]) c.T1 = [...new Set([...noms(t1), ...noms(t1 - 1)])];
  c.V = E[1] ? [...gras(1)] : null;
  return c;
}

/* Cases sans drapeau : depuis 2022, Russes et Biélorusses jouent sous bannière
   neutre ({{flagicon|}}). `f(nom)` rend leur nation (RUS, BLR) ou null ; la
   case reçoit alors 'NEU'. Modifie le tableau lu. */
export function resoudreNeutres(L, f) {
  for (const E of Object.values(L.etapes)) for (const x of E.tous)
    if (!x.nat && !BYE.test(x.nom)) x.nat = f(x.nom) || 'NEU';
  return L;
}

/* Une nation par joueur et par édition. Wikipédia n'est pas toujours d'accord
   avec lui-même : Lendl est TCH dans une case de 1989 et CZE dans la suivante.
   1. le code est ramené à l'époque (CZE, SVK avant 1993 → TCH ; RUS avant
      1992 → URS, et l'inverse) ;
   2. un joueur garde la nation qu'il porte le plus souvent dans le tableau
      (à égalité : celle de son premier tour). Modifie le tableau lu. */
export function natEpoque(c, an) {
  if ((c === 'CZE' || c === 'SVK') && an < 1993) return 'TCH';
  if (c === 'TCH' && an >= 1993) return 'CZE';
  if (c === 'RUS' && an < 1992) return 'URS';
  if (c === 'URS' && an >= 1992) return 'RUS';
  return c;
}
export function unifierNations(L, an, canon = x => x) {
  const vu = {};
  const etapes = Object.keys(L.etapes).map(Number).sort((a, b) => b - a);  /* du 1er tour à la finale */
  etapes.forEach((e, rang) => {
    for (const x of L.etapes[e].tous) {
      if (!x.nat || BYE.test(x.nom)) continue;
      x.nat = natEpoque(x.nat, +an);
      const v = vu[canon(x.nom)] = vu[canon(x.nom)] || {};
      v[x.nat] = v[x.nat] || [0, rang]; v[x.nat][0]++;
    }
  });
  const choix = {};
  for (const [n, v] of Object.entries(vu))
    choix[n] = Object.entries(v).sort((a, b) => b[1][0] - a[1][0] || a[1][1] - b[1][1])[0][0];
  for (const E of Object.values(L.etapes)) for (const x of E.tous) if (x.nat && choix[canon(x.nom)]) x.nat = choix[canon(x.nom)];
  return L;
}

/* Les nations présentes dans un tableau, et les cases sans drapeau lisible. */
export function nationsTableau(L) {
  const n = new Set(); let sans = 0;
  for (const E of Object.values(L.etapes)) for (const x of E.tous) {
    if (/\bbye\b/i.test(x.nom)) continue;
    if (x.nat) n.add(x.nat); else sans++;
  }
  return { nations: [...n].sort(), sans };
}

/* Dates d'un tournoi, lues dans l'infobox de sa page (« | date = 25 May –
   8 June 2025 »). Renvoie ['AAAA-MM-JJ', 'AAAA-MM-JJ'] ou null. */
const MOIS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12 };
export function lireDates(t, an) {
  const m = /^\s*\|\s*dates?\s*=\s*(.+)$/im.exec(t || '');
  if (!m) return null;
  const x = m[1].replace(/<[^>]*>/g, ' ').replace(/\{\{[^}]*\}\}/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/[–—−]|&ndash;/g, '-').replace(/\s+/g, ' ').trim();
  const f = (a, mo, j) => `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  const fin = (j1, m1, a1, j2, m2, a2) => {
    if (!m1 || !m2) return null;
    a2 = +(a2 || an); a1 = +(a1 || (m1 > m2 ? a2 - 1 : a2));
    return [f(a1, m1, +j1), f(a2, m2, +j2)];
  };
  const M = s => s ? MOIS[s.toLowerCase()] : undefined;
  /* « 25 May – 8 June 2025 », « 12–26 January 2025 » */
  let r = /^(\d{1,2})\s*([A-Za-z]+)?,?\s*(\d{4})?\s*-\s*(\d{1,2})\s*([A-Za-z]+),?\s*(\d{4})?/.exec(x);
  if (r && M(r[5])) return fin(r[1], M(r[2]) || M(r[5]), r[3], r[4], M(r[5]), r[6]);
  /* « August 27 – September 7, 2025 », « August 25–September 7 » */
  r = /^([A-Za-z]+)\s*(\d{1,2}),?\s*(\d{4})?\s*-\s*([A-Za-z]+)?\s*(\d{1,2}),?\s*(\d{4})?/.exec(x);
  if (r && M(r[1])) return fin(r[2], M(r[1]), r[3], r[5], M(r[4]) || M(r[1]), r[6]);
  return null;
}

/* data.json, écrit toujours de la même façon (une ligne par année, ordre
   fixe) : deux écritures du même contenu donnent les mêmes octets.
   editions : l'état de chaque édition ('J' jouée ou en cours, null pas
   ouverte aux pros, 'ND' non disputée, 'C' annulée, '?' à venir) ; dates :
   début et fin de chaque tournoi ; joueurs : tous les joueurs, dans l'ordre
   de leur première apparition (un numéro ne change jamais) ; neutres : la
   nation retenue pour un joueur sous bannière neutre ; alias : autre graphie
   d'un même joueur sur Wikipédia → nom retenu ; parcours : pour chaque
   édition et chaque nation, des paires [numéro du joueur, dernière colonne
   atteinte (0 = 1er tour … 7 = titre)]. Les chiffres de chaque case s'en
   déduisent (compteParcours). */
const ORDRE = ['AO', 'AOd', 'RG', 'WIM', 'USO'];
export function ecrireData(d) {
  const bloc = o => {
    const ans = Object.keys(o || {}).sort();
    const ligne = a => `    "${a}": {` + Object.keys(o[a]).sort((x, y) => ORDRE.indexOf(x) - ORDRE.indexOf(y))
      .map(k => `"${k}": ${JSON.stringify(o[a][k])}`).join(', ') + '}';
    return ans.length ? '{\n' + ans.map(ligne).join(',\n') + '\n  }' : '{}';
  };
  const alias = Object.keys(d.alias || {}).sort();
  return '{\n  "tours": ' + JSON.stringify(d.tours) + ',\n  "ouverts": ' + JSON.stringify(d.ouverts || {}) +
    ',\n  "editions": ' + bloc(d.editions) + ',\n  "dates": ' + bloc(d.dates) +
    ',\n  "joueurs": ' + JSON.stringify(d.joueurs || []) +
    ',\n  "neutres": ' + JSON.stringify(Object.fromEntries(Object.entries(d.neutres || {}).sort())) +
    ',\n  "alias": ' + (alias.length ? '{\n' + alias.map(k => `    ${JSON.stringify(k)}: ${JSON.stringify(d.alias[k])}`).join(',\n') + '\n  }' : '{}') +
    ',\n  "parcours": ' + bloc(d.parcours) + '\n}\n';
}

/* Le parcours d'une édition : pour chaque Français, la dernière colonne où il
   figure. Les colonnes sont emboîtées (un joueur du 3e tour est aussi au 1er
   et au 2e) : le nombre de Français à la colonne i = joueurs dont la dernière
   colonne est ≥ i. `canon` ramène une graphie à son nom retenu. */
export function parcoursEdition(nc, canon = x => x) {
  if (!nc) return null;
  const best = {};
  TOURS.forEach((k, i) => { for (const n of nc[k] || []) { const c = canon(n); best[c] = Math.max(best[c] ?? -1, i); } });
  return best;
}
/* Range un parcours dans data.json : numéros attribués aux nouveaux venus. */
export function parcoursVersData(d, best) {
  d.joueurs = d.joueurs || [];
  const out = [];
  for (const [n, k] of Object.entries(best)) {
    let id = d.joueurs.indexOf(n);
    if (id < 0) { d.joueurs.push(n); id = d.joueurs.length - 1; }
    out.push([id, k]);
  }
  return out.sort((a, b) => a[0] - b[0]).flat();
}
/* Le nombre de Français par colonne, recalculé depuis un parcours rangé. */
export function compteParcours(flat) {
  const n = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let j = 1; j < flat.length; j += 2) for (let i = 0; i <= flat[j]; i++) n[i]++;
  return n;
}
