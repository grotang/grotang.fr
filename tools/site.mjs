/* LE REGISTRE DU SITE : la seule liste des pages.

   Le menu, le sitemap, les adresses canoniques et les pages relais sont tous
   fabriqués à partir d'ici. Ajouter une page, renommer une rubrique, ranger une
   rubrique dans une autre : on ne touche qu'à ce fichier.

   LA RÈGLE : l'adresse d'une page décrit la PAGE, jamais sa rubrique.
   Forme : PÉRIMÈTRE-OBJET-ANGLE, en minuscules, sans accents, avec des tirets.
   Le périmètre est le sport ou le territoire dont parle la page (football,
   tennis, biathlon, france, europe…), TOUJOURS présent, même quand il semble
   redondant (`football-coefficient-uefa`) : une seule règle, aucune exception,
   et chaque adresse se comprend seule (« grand-chelem » seul, c'est aussi le
   golf ou le rugby). Pas d'année si la page est mise à jour d'une année sur
   l'autre. Le périmètre est une propriété du CONTENU, pas une rubrique du
   menu : le tennis reste du tennis s'il passe sous « Sport ».
   Exemple : `/football-coefficient-uefa/`, pas `/football/uefa/`. La rubrique ne vit que dans le menu, elle
   peut changer de nom ou de place autant de fois qu'on veut sans casser un
   seul lien ni perdre une position dans Google. Une adresse, elle, ne change
   plus une fois publiée — et si on doit vraiment la changer, l'ancienne va
   dans RELAIS ci-dessous.

   `rubrique` est un chemin : ['Économie'] aujourd'hui, ['Sport', 'Football']
   demain si on regroupe les sports. L'ordre du menu est l'ordre de ce tableau.
   Une rubrique qui ne contient qu'une page s'affiche comme un lien direct ;
   dès la deuxième page, elle devient un menu déroulant, sans rien d'autre à
   changer. */
export const PAGES = [
  { key: 'uefa',   url: '/football-coefficient-uefa/',   titre: 'Coefficient UEFA',         rubrique: ['Football'] },
  { key: 'tennis', url: '/tennis-grand-chelem-nations/', titre: 'Grand Chelem',             rubrique: ['Tennis'] },
  { key: 'eco',    url: '/france-comptes-publics/',      titre: 'Budget de la France',      rubrique: ['Économie'] },
  { key: 'b27',    url: '/france-simulateur-budget/',    titre: 'Faites votre budget 2027', rubrique: ['Économie'] },
];

/* Les adresses qui ont existé et n'existent plus : chacune reçoit une page
   relais qui envoie vers la nouvelle (GitHub Pages ne sait pas faire de 301 ;
   un `meta refresh` à 0 seconde avec `canonical` est traité par Google comme
   une redirection permanente). On n'en retire jamais : un vieux lien partagé
   doit marcher pour toujours. */
export const RELAIS = {
  '/uefa/':          '/football-coefficient-uefa/',     // de septembre au 31/10/2026
  '/tennis/':        '/tennis-grand-chelem-nations/',   // jusqu'au 31/10/2026
  '/grand-chelem/':  '/tennis-grand-chelem-nations/',   // le 31/10/2026, une heure
  '/economie/':      '/france-comptes-publics/',        // jusqu'au 31/10/2026
  '/budget-france/': '/france-comptes-publics/',        // le 31/10/2026, une heure
  '/budget-2027/':   '/france-simulateur-budget/',      // le 31/10/2026, une heure
};

export const DOMAINE = 'https://grotang.fr';

export const page = key => {
  const p = PAGES.find(x => x.key === key);
  if (!p) throw new Error(`registre : page inconnue « ${key} » (tools/site.mjs)`);
  return p;
};
export const url = key => page(key).url;
export const abs = key => DOMAINE + url(key);
/* chemin du fichier publié : '/tennis-grand-chelem-nations/' → 'tennis-grand-chelem-nations/index.html' */
export const fichier = u => u.replace(/^\//, '') + 'index.html';

/* Contrôles au chargement : une erreur ici arrête la fabrication du site avant
   qu'une page soit publiée à une adresse en double ou qu'un relais boucle. */
{
  const vues = new Set();
  for (const p of PAGES) {
    if (!/^\/[a-z0-9-]+\/$/.test(p.url)) throw new Error(`registre : adresse mal formée « ${p.url} »`);
    if (!/^\/(football|tennis|biathlon|rugby|cyclisme|france|europe|monde)-/.test(p.url))
      throw new Error(`registre : « ${p.url} » ne commence pas par un périmètre connu (football-, tennis-, france-…) ; en ajouter un ici si besoin`);
    if (vues.has(p.url)) throw new Error(`registre : adresse en double « ${p.url} »`);
    vues.add(p.url);
    if (!p.rubrique?.length) throw new Error(`registre : « ${p.key} » sans rubrique`);
  }
  for (const [de, vers] of Object.entries(RELAIS)) {
    if (vues.has(de)) throw new Error(`registre : « ${de} » est à la fois une page et un relais`);
    if (!vues.has(vers)) throw new Error(`registre : le relais « ${de} » mène à « ${vers} », qui n'est pas une page`);
  }
}

/* L'arbre du menu, tiré du registre :
   [{ nom, pages: [...], sous: [{ nom, pages, sous }] }] dans l'ordre d'apparition. */
export function arbre() {
  const racine = { sous: [] };
  for (const p of PAGES) {
    let n = racine;
    for (const nom of p.rubrique) {
      let s = n.sous.find(x => x.nom === nom);
      if (!s) { s = { nom, pages: [], sous: [] }; n.sous.push(s); }
      n = s;
    }
    n.pages.push(p);
  }
  return racine.sous;
}
