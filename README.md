# grotang.fr

**L'observatoire du coefficient UEFA.** Décortiqué, comparé, projeté.

Un site statique, en français, qui suit le classement UEFA des associations (la course aux places européennes) et la place de la France dedans. Il se met à jour tout seul, chaque soir de match et chaque matin.

| Page | Adresse | Données |
|---|---|---|
| Coefficient UEFA | [grotang.fr/uefa/](https://grotang.fr/uefa/) | relues automatiquement, plusieurs fois par jour en période de match |
| Français en Grand Chelem | [grotang.fr/tennis/](https://grotang.fr/tennis/) | tour par tour, relues sur Wikipédia trois fois par jour |

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
| `uefa-soir.yml` « Soir de match UEFA » | Part vers 19 h 47 (Paris), second départ vers 21 h 47 | Si c'est un soir de match, reste éveillé : dès 20 h 35, relit la source et Wikipédia **toutes les dix minutes**, dépose et publie dès qu'il y a du neuf, s'arrête quand tout est à jour (source datée du soir **et** score de tous les matchs du soir), au plus tard à 3 h 30. |
| `uefa.yml` « Rafraîchissement UEFA » | 23 h 38 et 7 h 12 (Paris) | Passages à heure fixe, en filet. Porte l'**alarme de fraîcheur** (`tools/uefa/fraicheur.mjs`) : si un soir de match est passé et que la source n'a pas bougé, le passage de 7 h échoue et GitHub envoie un e-mail. |
| `tennis.yml` « Rafraîchissement tennis » | 7 h 47, 14 h 47, 20 h 47 UTC | Relit sur Wikipédia les tableaux de l'année en cours (`tools/tennis/refresh.mjs`), après un contrôle sur une édition close (Roland-Garros 2025). Ne dépose `tools/tennis/data.json` que si un chiffre a bougé, puis appelle `pages.yml`. |
| `pages.yml` « Publication GitHub Pages » | À chaque commit sur `tools/**`, ou appelé par les robots | Fabrique le site (`node tools/build.mjs`) et le publie. |

Pourquoi une veille plutôt qu'une heure fixe : GitHub ne garantit pas l'heure de départ d'une tâche planifiée. Le 13/10/2026, le passage prévu à 23 h 38 est parti à 2 h 33. Une tâche qui part tôt et reste éveillée couvre la soirée même partie en retard. Les minutes d'Actions sont gratuites pour un dépôt public, y compris celles où la tâche attend.

Cron ne parle qu'UTC et ignore le changement d'heure : chaque rendez-vous fixe a deux lignes, une pour l'été, une pour l'hiver ; celle qui tombe à côté ne trouve rien de neuf et sort sans rien écrire. La minute n'est jamais `00` (« High load times include the start of every hour »).

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
  tennis/
    data.json            Français par tour, chaque Grand Chelem depuis 1968 (réécrit par le robot)
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
npm run test:page                 # teste public/uefa/index.html
npm run refresh:dry               # relit la source sans rien écrire
```

Node 20 ou plus. Playwright sert à la projection et au test.

---

## Droits

© 2026 Tanguy Drouin — grotang.fr. **Tous droits réservés.**

Le dépôt est public pour être lisible, pas pour être repris. Le code, la mise en page, les graphiques et les textes sont protégés par le droit d'auteur ; aucune licence de réutilisation n'est accordée. Pour toute reprise, même partielle, demandez d'abord par écrit.

Les résultats de matchs et les coefficients sont des faits, ils ne sont à personne. Chiffres non officiels : l'UEFA fait foi.

Contact : voir le bloc « Une idée ? » sur [grotang.fr/uefa/](https://grotang.fr/uefa/).
