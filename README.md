# grotang.fr

**L'observatoire du coefficient UEFA.** Décortiqué, comparé, projeté.

Un site statique, en français, qui suit le classement UEFA des associations (la course aux places européennes) et la place de la France dedans. Il se met à jour tout seul, chaque soir de match et chaque matin.

| Page | Adresse | Données |
|---|---|---|
| Coefficient UEFA | [grotang.fr/football-coefficient-uefa/](https://grotang.fr/football-coefficient-uefa/) | relues automatiquement, plusieurs fois par jour en période de match |
| Grand Chelem | [grotang.fr/tennis-grand-chelem-nations/](https://grotang.fr/tennis-grand-chelem-nations/) | les Grands Chelems nation par nation (France par défaut, les 21 nations titrées depuis 1968), tour par tour, relus sur Wikipédia trois fois par jour |
| Budget de la France | [grotang.fr/france-comptes-publics/](https://grotang.fr/france-comptes-publics/) | comptes des administrations publiques, relus chez Eurostat chaque lundi |
| Faites votre budget 2027 | [grotang.fr/france-simulateur-budget/](https://grotang.fr/france-simulateur-budget/) | le simulateur du budget 2027 (leviers relevés à la main dans `tools/eco/leviers.json`) ; même source que la page précédente (`tools/eco/page.html`, blocs marqués `data-p`), fabriquée en deux pages par `tools/eco/page.mjs` |

**Le registre (`tools/site.mjs`)** est la seule liste des pages : adresse, titre, rubrique du menu. Le menu, le sitemap, les adresses canoniques et les pages relais en sont tirés. **Règle des adresses** : `périmètre-objet-angle` (`football-coefficient-uefa`, `tennis-grand-chelem-nations`, `france-comptes-publics`), périmètre toujours présent (sport ou territoire), jamais la rubrique du menu, pas d'année pour une page reconduite ; le build refuse une adresse qui ne respecte pas la forme. Une adresse abandonnée va dans `RELAIS` et reçoit pour toujours une page qui renvoie vers la nouvelle (`/uefa/`, `/tennis/`, `/economie/` et les adresses intermédiaires du 31/10/2026).

---

## La page UEFA, bloc par bloc

| Bloc | Ce qu'il montre |
|---|---|
| **0a** Où en est la saison | Calendrier réel des trois compétitions ; au survol, les matchs des clubs français (score, ou jour et heure s'ils sont à venir). |
| **0b** La semaine européenne | Une ligne par nation, rangée par coefficient gagné par les matchs de la semaine (C1 mardi-mercredi, C3 et C4 jeudi). |
| **1** Le classement | Saison en cours ou 5, 4, 3, 2 dernières saisons ; saison en cours au réel ou projetée à sa fin. |
| **2** Évolution journée par journée | Cumul ou écart au leader, étape par étape, avec le bandeau des trois phases. |
| **3a–3c** D'où viennent les points | Par compétition, par club, par type de point. |
| **4a–4b** Ce que rapporte chaque étape | Gain et cumul (deux axes), matrice avec le podium de chaque étape. |
| **5** Une idée ? | Contact. |
| **6a–6b** Sur le terrain | Rendement (points par match) et bilan V/N/D, club par club. |
| **7a–7d** Les clubs encore en vie | Qui reste, courbe de survie, écrémage, Sankey de la saison. |
| **8** La projection | Fourchettes de fin de phase de ligue et de fin de saison. |

Toutes les saisons depuis 2021/22 sont consultables ; un seul sélecteur de saison pilote tous les blocs.

---

## La page économie, bloc par bloc

« Où va l'argent public ? » : recettes et dépenses des administrations publiques (État et organismes centraux, Sécurité sociale, collectivités locales), de 1995 à la dernière année publiée. Un sélecteur d'année et un sélecteur d'unité (milliards €, % du PIB, € par habitant, sur 100 € de dépense) pilotent toute la page.

| Bloc | Ce qu'il montre |
|---|---|
| En-tête | Dépenses, recettes, déficit, dette ; la phrase « sur 100 € de dépense publique… ». |
| Hypothèse | « Plafonner les retraites » : curseur du plafond (pension nette), économie, retraités touchés, déficit ; les chiffres de toute la page passent sous l'hypothèse (2023 observé ; 2024 et 2025 estimés par proxy à partir de la Drees EACR 2024 et des revalorisations, signalés sur la page ; ni bouton ni panneau pour les autres années). Données : `tools/eco/retraites.json`, relevé à la main. |
| **1** Le circuit | Sankey recettes + emprunt → dépenses → niveau 1 (11 politiques : les 10 fonctions COFOG, intérêts de la dette à part) → niveau 2 (sous-postes ≥ 1 % de la dépense). Au survol : définition concrète du poste et ce qu'il paie par nature (salaires, achats, prestations, investissement…). Sur écran étroit (téléphone), le schéma complet garde sa largeur de lecture et défile horizontalement ; au toucher, l'infobulle reste affichée jusqu'au toucher suivant. |
| **2027** Votre budget | Bac à sable sur le budget 2027 du gouvernement (RESF du PLF 2027 : PIB 3 135 Md€, déficit 5,0 %, dette 121,7 %). Leviers : niches fiscales (12 plus coûteuses + les 445 autres, coûts 2027 du tome II des Voies et moyens), recul de l'âge légal (Cour des comptes 2025 / COR 2026), taxe Zucman (promoteurs / CAE), plafond des retraites (modèle Drees). Horizon effet en 2027 / à maturité, chiffrages prudents / centraux / favorables, cascade du déficit avec repères 3 % et solde stabilisant la dette, phrase de synthèse, lien partageable. Levier structurel « Converger vers nos voisins » : écart de dépense en points de PIB avec un pays ou une zone de référence (Eurostat COFOG 2024, retraites et reste de la protection sociale séparés, services généraux hors intérêts), curseur 0-100 % par politique, durée de convergence 1-10 ans, alerte de double compte avec âge légal et plafond. Défis : 3 % sans hausse d’impôts, 3 % sans baisse de dépenses, stabiliser la dette, zéro déficit (leviers exclus grisés, réussite « dès 2027 » ou « à maturité seulement »). Données : `tools/eco/leviers.json`, relevé à la main, contrôlé par `test-eco.mjs`. |
| **2** Impôt par impôt | TVA, IR-CSG, IS, cotisations, taxes foncières… |
| **3–4** Qui dépense | Les trois administrations ; les soldes empilés depuis 1995 (le déficit est celui de l'État). |
| **5–6** Trente ans | Dépenses et recettes en % du PIB ; ce qui a grossi ou fondu depuis 1995, par politique ou sous-poste. |
| **7–8** La France et ses voisins | Écart avec 11 comparaisons (zone euro, UE, 9 pays), par politique ou sous-poste ; la dépense en % du PIB depuis 1995. |

Sources : Eurostat `gov_10a_main`, `gov_10a_exp`, `gov_10a_taxag`, `gov_10dd_edpt1`, `nama_10_gdp`, `nama_10_pe` (API publique, JSON-stat). Trois « dernières années » coexistent : grands agrégats (`der`), ventilation par fonction (`derF`, environ un an plus tard), détail des impôts (`derT`). Contrôles bloquants dans `tools/eco/eurostat.mjs` : recettes = Σ composantes, dépenses = Σ natures, solde = R − D (31 ans × 4 secteurs), chaque fonction = Σ sous-fonctions, détail fiscal ≈ agrégat (< 1 %), ratio au PIB recalculé = ratio publié. Écart connu et toléré (≤ 0,5 %) : le tableau COFOG n'est pas republié à chaque révision des agrégats (2024 : 1 671,8 contre 1 672,7 Md€).

---

## D'où viennent les chiffres

| Source | Ce qu'on y prend | Comment |
|---|---|---|
| [5-jahres-wertung.de](https://www.5-jahres-wertung.de/) | Coefficients, bilans club par club, effectifs | Pages publiques uniquement, lues par le robot. L'espace membres (`/Memberbereich/` etc.) n'est jamais lu. |
| [Wikipédia (en)](https://en.wikipedia.org/) | La liste des matchs : date, heure, score | Pages « league phase » et « knockout phase », lues par l'API Wikimédia avec un User-Agent identifié ; l'été, pages de qualifications enregistrées à la main. |
| [kassiesa.net](https://kassiesa.net/uefa/) | Second calcul indépendant du classement, pour recouper | **Relevé manuel** : son `robots.txt` interdit les robots sur ses pages de données. Voir `tools/uefa/snapshot-kassiesa.js`. |
| Archive maison | 5 saisons closes, 55 nations, match par match | `tools/uefa/archive/` |

Un match Wikipédia n'est affiché dans les bilans que s'il recoupe le bilan officiel du club : si Wikipédia est en retard ou se trompe, la case reste sans détail, elle ne montre jamais un faux match.

Détail complet, pièges rencontrés et contrôles : [`tools/uefa/SOURCES.md`](tools/uefa/SOURCES.md).

---

## Comment le site se met à jour

```
5-jahres-wertung.de ─┐
                     ├─► GitHub Actions ─► tools/uefa/page.html + tools/uefa/wiki/*.json ─► commit
Wikipédia ───────────┘        (refresh.mjs)                                                    │
                                                                                               ▼
                                              GitHub Pages ◄── tools/build.mjs (pages.yml) ◄───┘
```

Rien n'est construit à la main : `public/` n'est **pas** dans le dépôt. Le robot ne touche qu'aux sources, et la page finie n'existe que le temps d'une publication.

### Les robots (`.github/workflows/`)

| Fichier | Quand | Rôle |
|---|---|---|
| `uefa-soir.yml` « Soir de match UEFA » | Mardi → jeudi (et samedi en mai-juin, finale de C1) : part vers 18 h 47 (Paris, hiver), second départ vers 20 h 47 | Si c'est un soir de match, reste éveillé : dès 20 h 35, relit la source et Wikipédia **toutes les dix minutes**, dépose et publie dès qu'il y a du neuf, s'arrête quand tout est à jour (source datée du soir **et** score de tous les matchs du soir), au plus tard à 3 h 30. |
| `uefa.yml` « Rafraîchissement UEFA » | Mercredi → vendredi (et dimanche en mai-juin), 6 h 12 et 7 h 12 (Paris, hiver) | Lendemains de match, en filet. Porte l'**alarme de fraîcheur** (`tools/uefa/fraicheur.mjs`) : si un soir de match est passé et que la source n'a pas bougé, le passage de 7 h échoue et GitHub envoie un e-mail. |
| `tennis.yml` « Rafraîchissement tennis » | Janvier, 1er-3 février, mai → septembre : 7 h 47, 14 h 47, 20 h 47 UTC | Relit sur Wikipédia les tableaux de l'année en cours (`tools/tennis/refresh.mjs`), après un contrôle sur une édition close (Roland-Garros 2025). Ne dépose `tools/tennis/data.json` que si un chiffre a bougé, puis appelle `pages.yml`. Toutes les éditions depuis 1968 : `node tools/tennis/refresh.mjs --tout` (≈ 1 min). |
| `eco.yml` « Rafraîchissement économie » | Lundi 6 h 23 UTC | Relit Eurostat (`tools/eco/refresh.mjs`), contrôle, ne dépose `tools/eco/data.json` que si un chiffre a bougé, puis appelle `pages.yml`. |
| `pages.yml` « Publication GitHub Pages » | À chaque commit sur `tools/**`, ou appelé par les robots | Fabrique le site (`node tools/build.mjs`) et le publie. |

Pourquoi une veille plutôt qu'une heure fixe : GitHub ne garantit pas l'heure de départ d'une tâche planifiée. Le 13/10/2026, le passage prévu à 23 h 38 est parti à 2 h 33. Une tâche qui part tôt et reste éveillée couvre la soirée même partie en retard. Les minutes d'Actions sont gratuites pour un dépôt public, y compris celles où la tâche attend.

Les robots ne partent que les jours où il peut se passer quelque chose (calendrier 2026/27 : 78 soirs de match UEFA, tous mardi-jeudi sauf la finale de C1 un samedi ; tennis pendant les mois de Grand Chelem) : environ 1 270 départs par an au lieu de 3 340. Cron ne parle qu'UTC et ignore le changement d'heure : chaque rendez-vous fixe a deux lignes, une pour l'été, une pour l'hiver ; celle qui tombe à côté ne trouve rien de neuf et sort sans rien écrire. La minute n'est jamais `00` (« High load times include the start of every hour »).

### Les garde-fous

Une page fausse est pire qu'une page en retard. Le pire scénario voulu est un site daté, jamais un site cassé.

- **`npm run test:extract`** : la lecture de la source doit redonner les chiffres d'une capture validée à la main. Si la source change de forme, le rafraîchissement ne tourne même pas.
- **Contrôles de `refresh.mjs`** : somme des clubs ÷ clubs engagés = coefficient, barème des bonus, recollement des cinq saisons. Un contrôle en échec : rien n'est écrit.
- **`npm run test:page`** : ouvre la page fabriquée dans un vrai navigateur et vérifie une quinzaine de faits (aucune erreur JavaScript, tous les blocs remplis, aucun « NaN », total à 5 ans = somme des saisons, engagés − éliminés = encore en lice). Un échec bloque le dépôt.
- **Alarme de fraîcheur** : voir plus haut.
- **Recoupement kassiesa** : signalant, jamais bloquant. Un désaccord s'affiche sur la page.

### La projection

200 000 saisons rejouées sur le runner GitHub (`tools/uefa/projette.mjs`), avec le code de simulation de la page elle-même : une seule version du modèle. La graine est la date des données, donc à données égales le résultat est identique et ne crée pas de commit parasite. La page ne reçoit que six nombres par nation et par horizon.

---

## Carte du dépôt

```
tools/
  build.mjs              fabrique public/ à partir des sources (pages, icônes, sitemap, données injectées)
  chrome.mjs             barre de navigation, thème clair/sombre, favicon, communs aux pages
  tennis.src.html        page tennis (données injectées depuis tennis/data.json)
  eco/
    page.html            page économie (données injectées depuis eco/data.json)
    page.mjs             fabrication de la page (appelée par build.mjs)
    eurostat.mjs         lecture de l'API Eurostat et contrôles
    refresh.mjs          relit Eurostat, contrôle, réécrit data.json
    format.mjs           mise en forme de data.json (une série par ligne)
    test-eco.mjs         test sans réseau de data.json
    data.json            comptes publics 1995 → dernière année (réécrit par le robot)
  tennis/
    data.json            joueurs de toutes les nations, parcours par édition depuis 1968 (réécrit par le robot)
    nations.mjs          noms, adjectifs et drapeaux des nations proposées sur la page
    wiki.mjs             lecture d'un tableau Wikipédia (sans dépendance)
    refresh.mjs          relit l'année en cours, contrôle, réécrit data.json
    test-tennis.mjs      test sans réseau (tableau fabriqué + faits historiques)
  icons/, fonts/         icônes du site, polices auto-hébergées
  uefa/
    page.html            LA page UEFA : HTML, CSS, JS et blocs de données entre sentinelles
    refresh.mjs          relit la source, contrôle, réécrit le bloc DATA de page.html
    extract.mjs          lecture des pages de 5-jahres-wertung
    ligue-wiki.mjs       lecture des pages Wikipédia (matchs, affiches)
    soir.mjs             questions de la veille du soir de match (est-ce un soir de match ? tout est-il à jour ?)
    fraicheur.mjs        alarme de fraîcheur
    projette.mjs         projection sur le runner
    crosscheck.mjs       recoupement avec un relevé kassiesa
    snapshot-kassiesa.js relevé kassiesa, à coller dans la console du navigateur
    test-extract.mjs     test de lecture de la source
    test-page.mjs        test de non-régression de la page
    wiki/                matchs et affiches de la saison en cours (relus par le robot)
    archive/             saisons closes
    SOURCES.md           sources, pièges, contrôles
```

### Les blocs de données dans `page.html`

Les données vivent dans la page, entre sentinelles `/*NOM_START*/ … /*NOM_END*/`. Le robot ne réécrit que `DATA` (et `PRJ` pour la projection) ; `build.mjs` remplit au moment de publier ceux qui dérivent des fichiers `wiki/` (`KOV`, `JEX`, `AFF`, `SEM`, `SANKEY`). Les autres (`HIST`, `JOUR`, `VND`…) sont l'archive des saisons closes et ne bougent pas.

### Conventions d'affichage

- Coefficients : un entier à partir de 30, une décimale de 5 à 30, deux décimales sous 5. Seuls les totaux en infobulle sont exacts (au millième).
- Une couleur par nation, la même dans tous les blocs ; la France en bleu.
- Une valeur acquise est pleine, une valeur à venir est plus claire.

---

## Travailler en local

```
npm ci
npm run build                     # fabrique public/
npm run test:page                 # teste la page UEFA (adresse lue dans tools/site.mjs)
npm run refresh:dry               # relit la source sans rien écrire
```

Node 20 ou plus. Playwright sert à la projection et au test.

---

## Droits

© 2026 Tanguy Drouin — grotang.fr. **Tous droits réservés.**

Le dépôt est public pour être lisible, pas pour être repris. Le code, la mise en page, les graphiques et les textes sont protégés par le droit d'auteur ; aucune licence de réutilisation n'est accordée. Pour toute reprise, même partielle, demandez d'abord par écrit.

Les résultats de matchs et les coefficients sont des faits, ils ne sont à personne. Chiffres non officiels : l'UEFA fait foi.

Contact : voir le bloc « Une idée ? » sur [grotang.fr/football-coefficient-uefa/](https://grotang.fr/football-coefficient-uefa/).
