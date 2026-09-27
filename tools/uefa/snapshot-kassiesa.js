/* Releve manuel du classement kassiesa.net — a coller dans la console du navigateur.
 *
 *   1. Ouvrir  https://kassiesa.net/uefa/data/method5/crank2027.html
 *   2. F12 -> onglet Console -> coller tout ce fichier -> Entree
 *   3. Le navigateur telecharge kassiesa-AAAA-MM-JJ.json
 *   4. Deplacer le fichier dans tools/uefa/snapshots/
 *   5. node tools/uefa/crosscheck.mjs tools/uefa/snapshots/kassiesa-AAAA-MM-JJ.json
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * kassiesa.net interdit les robots sur ses pages de donnees (robots.txt). Le
 * releve reste donc manuel : c'est le navigateur de GT qui lit la page, comme
 * un lecteur humain, et ce script ne fait que mettre en forme ce qu'il voit
 * deja a l'ecran. Il ne contourne rien — il evite juste de recopier 385
 * nombres a la main.
 *
 * Le reperage des colonnes n'est PAS code en dur. Le script cherche, dans
 * chaque ligne, cinq valeurs consecutives dont la somme tombe sur une sixieme
 * valeur de la meme ligne : ce sont les cinq saisons et le total. Si kassiesa
 * ajoute une colonne ou en deplace une, le script continue de marcher ; s'il
 * ne trouve rien, il le dit au lieu de produire un instantane faux.
 *
 * Format produit — celui qu'attend crosscheck.mjs :
 *   { upd: "...", rows: [ { rank, name, tot, y:[5] }, ... ] }
 */
(() => {
  const EPS = 0.011;                       // tolerance somme des 5 saisons vs total
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const num = s => {
    const m = String(s).replace(',', '.').match(/^-?\d+(\.\d+)?$/);
    return m ? parseFloat(m[0]) : null;
  };

  /* ---- 1. trouver la table du classement ---- */
  const cand = [...document.querySelectorAll('table')].map(t => {
    const rows = [...t.rows].filter(r => {
      const c = [...r.cells].map(txt);
      return c.length >= 7 && Number.isInteger(num(c[0])) && num(c[0]) >= 1 && num(c[0]) <= 60;
    });
    return { t, rows };
  }).sort((a, b) => b.rows.length - a.rows.length)[0];

  if (!cand || cand.rows.length < 40) {
    console.error('[kassiesa] table du classement introuvable (%d lignes candidates). '
      + 'La page a change de structure — previens Claude.', cand ? cand.rows.length : 0);
    return;
  }

  /* ---- 2. lire chaque ligne, colonnes deduites par la somme ---- */
  const rows = [], soucis = [];
  let colY = null, colT = null;            // memorise les colonnes du 1er succes

  for (const tr of cand.rows) {
    const c = [...tr.cells].map(txt);
    const rank = num(c[0]);
    const iNom = c.findIndex((v, i) => i > 0 && /[A-Za-z]{3}/.test(v) && num(v) === null);
    if (iNom < 0) { soucis.push(`rang ${rank} : pas de nom de pays`); continue; }
    const name = c[iNom].replace(/\s*\(\d+\)\s*$/, '').trim();

    /* indices numeriques apres le nom */
    const idx = [];
    for (let i = iNom + 1; i < c.length; i++) if (num(c[i]) !== null) idx.push(i);

    let y = null, tot = null;
    const essaie = (starts) => {
      for (const s of starts) {
        const p = idx.indexOf(s);
        if (p < 0 || p + 4 >= idx.length) continue;
        const win = idx.slice(p, p + 5).map(i => num(c[i]));
        const som = win.reduce((a, b) => a + b, 0);
        const cible = colT != null ? [colT] : idx.filter((_, q) => q < p || q > p + 4);
        for (const j of cible) {
          const v = num(c[j]);
          if (v !== null && Math.abs(v - som) <= EPS) return { y: win, tot: v, s, j };
        }
      }
      return null;
    };
    /* on rejoue d'abord les colonnes deja validees : une ligne ne doit pas
       choisir un decoupage different de ses 54 voisines */
    const r = (colY != null ? essaie([colY]) : null) || essaie(idx);
    if (!r) { soucis.push(`${name} : aucun quintuplet dont la somme tombe sur le total`); continue; }
    ({ y, tot } = r);
    if (colY == null) { colY = r.s; colT = r.j; }

    rows.push({ rank, name, tot: +tot.toFixed(3), y: y.map(v => +v.toFixed(3)) });
  }

  /* ---- 3. date de mise a jour affichee par la page ---- */
  const corps = document.body.innerText || document.body.textContent || "";
  const mUpd = corps.match(/(?:last\s*update|laatste\s*update|updated)\s*[:\-]?\s*([^\n]{6,48})/i);
  const upd = mUpd ? mUpd[1].trim() : document.lastModified;

  /* ---- 4. controles avant de rendre la copie ---- */
  const rangs = rows.map(r => r.rank);
  const contigus = rangs.every((v, i) => v === i + 1);
  console.log('[kassiesa] %d pays, colonnes saisons=%d..%d total=%d', rows.length, colY, colY + 4, colT);
  console.log('[kassiesa] maj page : %s', upd);
  console.log('[kassiesa] 1er : %o', rows[0]);
  console.log('[kassiesa] dernier : %o', rows[rows.length - 1]);
  if (!contigus) console.warn('[kassiesa] les rangs ne vont pas de 1 a %d sans trou', rows.length);
  if (rows.length !== 55) console.warn('[kassiesa] %d pays au lieu de 55', rows.length);
  for (const s of soucis) console.warn('[kassiesa] ignore — ' + s);
  if (rows.length < 50) { console.error('[kassiesa] trop peu de lignes, rien telecharge.'); return; }

  /* ---- 5. telechargement ---- */
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const jour = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const json = '{"upd":' + JSON.stringify(upd) + ',"rows":[\n'
    + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `kassiesa-${jour}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  console.log('[kassiesa] telecharge : kassiesa-%s.json', jour);
  return json;
})();
