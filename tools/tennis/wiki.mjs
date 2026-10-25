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
const BYE = /\bbye\b/i;
const GRAS = /'''/;
const rempli = v => !!v && (/\[\[|\{\{\s*flag/i.test(v) || BYE.test(v));

/* Titre de section qui précède la position i (« === Finals === »…) */
function titreAvant(t, i) {
  const m = [...t.slice(0, i).matchAll(/^={2,}\s*([^=\n]+?)\s*={2,}\s*$/gm)].pop();
  return m ? m[1] : '';
}

/* Lit le tableau. Renvoie { etapes, prelim, alertes } :
   etapes[e] = { places, remplies, fra, gras, fraGras, noms } avec e compté
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
    const E = etapes[e] = etapes[e] || { places: 0, remplies: 0, fra: 0, gras: 0, fraGras: 0, noms: [] };
    for (const [k, v] of Object.entries(b.params)) {
      if (!cle(d).test(k)) continue;
      E.places++;
      if (rempli(v)) E.remplies++;
      if (BYE.test(v)) continue;
      const f = FRA.test(v), g = GRAS.test(v);
      if (f) { E.fra++; E.noms.push((/\[\[([^\]|]+)/.exec(v) || [, '?'])[1]); }
      if (g) E.gras++;
      if (f && g) E.fraGras++;
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

/* data.json, écrit toujours de la même façon (une ligne par année, ordre
   fixe) : deux écritures du même contenu donnent les mêmes octets. */
const ORDRE = ['AO', 'AOd', 'RG', 'WIM', 'USO'];
export function ecrireData(d) {
  const ans = Object.keys(d.editions).sort();
  const ligne = a => {
    const e = d.editions[a];
    return `    "${a}": {` + Object.keys(e).sort((x, y) => ORDRE.indexOf(x) - ORDRE.indexOf(y))
      .map(k => `"${k}": ${JSON.stringify(e[k])}`).join(', ') + '}';
  };
  const ouv = d.ouverts || {};
  return '{\n  "tours": ' + JSON.stringify(d.tours) + ',\n  "ouverts": ' + JSON.stringify(ouv) +
    ',\n  "editions": {\n' + ans.map(ligne).join(',\n') + '\n  }\n}\n';
}
