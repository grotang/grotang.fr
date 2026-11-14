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
   changer.

   `nouveau` : date de PREMIÈRE PUBLICATION de la page (AAAA-MM-JJ). Étiquette « new »
   dans le menu (et un point sur la rubrique) pendant un mois, puis elle disparaît
   toute seule : le build ne l'écrit plus, et d'ici le build suivant un petit script
   l'enlève chez le lecteur à la date prévue (data-fin). Rien à retirer à la main.
   `aVenir` : page annoncée mais pas encore construite. Le build fabrique une
   page d'attente (titre, deux lignes, « à venir »), marquée « bientôt » dans le
   menu, en noindex et hors du sitemap : Google ne la voit pas tant qu'elle est
   vide. Le jour où la vraie page existe, on retire `aVenir` et on la branche
   dans tools/build.mjs.
   `aVenir.apercu` : adresse d'une préversion (travail en cours), en noindex,
   hors menu et hors sitemap, annoncée par un bouton sur la page d'attente. Le
   jour où la vraie page sort, l'adresse de l'aperçu part dans RELAIS. */
export const PAGES = [
  { key: 'uefa',   url: '/football-coefficient-uefa/',   titre: 'Coefficient UEFA',         rubrique: ['Football'] },
  { key: 'force',  url: '/football-force-des-clubs/',   titre: 'Force des clubs',          rubrique: ['Football'], nouveau: '2026-11-13' },
  { key: 'joueurs', url: '/football-joueurs-decisifs/',  titre: 'Joueurs décisifs',         rubrique: ['Football'],
    aVenir: { h1: 'Les joueurs les plus décisifs',
      texte: "Un but à la 68e qui débloque le 2-1 en finale de Ligue des champions ne vaut pas une passe décisive dans un 6-0 au premier tour d'une coupe nationale. Cette page classera les joueurs, saison par saison, selon ce que leurs actions ont réellement changé au résultat — et selon l'enjeu du match.",
      apercu: '/football-joueurs-decisifs-wip/' } },
  { key: 'nantes', url: '/football-fc-nantes-histoire/', titre: 'FC Nantes',                rubrique: ['Football'] },
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
  '/football-fc-nantes-histoire-wip/': '/football-fc-nantes-histoire/',   // aperçu du 05/11/2026
  '/football-clubs-francais-phase-de-ligue/': '/football-clubs-projection-uefa-phase-ligue/',   // page cachée, renommée le 14/11/2026
};

/* Rubriques annoncées, sans aucune page encore : elles apparaissent dans le menu
   (après les rubriques existantes, dans cet ordre) avec le macaron « bientôt »,
   sans lien. Aucune adresse n'est réservée tant que le contenu n'est pas défini.
   Le jour où la première page existe, on la met dans PAGES avec cette rubrique
   et on retire le nom d'ici. */
export const RUBRIQUES_A_VENIR = ['Énergie'];

/* Les pages CACHÉES : publiées, mais hors menu, hors sitemap, en noindex, et
   atteignables par un seul lien, posé à la main là où il a un sens. Pour un
   contenu qu'on veut montrer sans le mettre en avant (05/11/2026 : les probas
   de classement des clubs français, sorties d'un modèle encore « à la nation »,
   pas « au club » — une tendance, pas une vitrine). Même règle d'adresse que
   PAGES ; le lien qui y mène écrit l'adresse en toutes lettres (bloc 2 de la
   page UEFA, `semLien`). */
export const CACHEES = {
  clubsFR: '/football-clubs-projection-uefa-phase-ligue/',   // renommée le 14/11/2026 (GT) ; l'ancienne adresse est dans RELAIS
};

/* LA GAZETTE (06/11/2026) : une page par semaine européenne, sous une adresse
   racine qui suit la règle (périmètre-objet-angle) ; la semaine est un
   sous-dossier daté AAAA-MM-JJ (premier match de la semaine), qui ne change
   jamais. Indexées et dans le sitemap, hors menu (lien depuis le bloc 2c de la
   page UEFA). Fabriquées par tools/uefa/gazette-pages.mjs. */
export const GAZETTE = '/football-gazette-uefa/';

/* LA PROJECTION CLUB PAR CLUB (14/11/2026, C29) : « Qui va gagner les coupes d'Europe ? ».
   Page indexée, dans le sitemap ; dans le menu, une ligne en retrait sous « Coefficient
   UEFA », comme la gazette (choix de GT), avec l'étiquette « new » le premier mois.
   Fabriquée par tools/uefa/clubs-projection.mjs. */
export const CLUBS_PRJ = { key: 'clubsPrj', url: '/football-clubs-projection-uefa/', titre: 'Projection des clubs', nouveau: '2026-11-14' };

export const DOMAINE = 'https://grotang.fr';

/* « new » : jusqu'au même jour du mois suivant (13/11 → 13/12), date de Paris. */
export const finNouveau = p => { if (!p.nouveau) return null;
  const [a, m, j] = p.nouveau.split('-').map(Number), d = new Date(Date.UTC(a, m, j));
  if (d.getUTCDate() !== j) d.setUTCDate(0);   // 31/01 → 28 ou 29/02
  return d.toISOString().slice(0, 10); };
export const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
export const estNouveau = (p, jour = aujourdhui()) => !!p.nouveau && jour < finNouveau(p);

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
    if (p.nouveau !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.nouveau)) throw new Error(`registre : « ${p.key} » nouveau doit être la date de première publication AAAA-MM-JJ`);
    const ap = p.aVenir?.apercu;
    if (ap) {
      if (!/^\/[a-z0-9-]+\/$/.test(ap) || !ap.startsWith(p.url.slice(0, -1))) throw new Error(`registre : aperçu mal formé « ${ap} »`);
      if (vues.has(ap)) throw new Error(`registre : adresse en double « ${ap} »`);
      vues.add(ap);
    }
  }
  for (const u of Object.values(CACHEES)) {
    if (!/^\/(football|tennis|biathlon|rugby|cyclisme|france|europe|monde)-[a-z0-9-]*\/$/.test(u)) throw new Error(`registre : page cachée mal formée « ${u} »`);
    if (vues.has(u)) throw new Error(`registre : adresse en double « ${u} »`);
    vues.add(u);
  }
  if (!/^\/football-[a-z0-9-]+\/$/.test(GAZETTE) || vues.has(GAZETTE)) throw new Error(`registre : adresse de la gazette mal formée ou en double « ${GAZETTE} »`);
  vues.add(GAZETTE);
  if (!/^\/football-[a-z0-9-]+\/$/.test(CLUBS_PRJ.url) || vues.has(CLUBS_PRJ.url)) throw new Error(`registre : adresse de la projection des clubs mal formée ou en double « ${CLUBS_PRJ.url} »`);
  vues.add(CLUBS_PRJ.url);
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
