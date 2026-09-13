# grotang.fr

Deux tableaux de bord :

| Page | Adresse | Données |
|---|---|---|
| Coefficient UEFA, journée par journée | `/uefa/` | reconstruites chaque matin |
| Français au tableau principal (Grands Chelems) | `/tennis/` | figées, saisie manuelle |

## Comment ça marche

Il n'y a **aucune étape de build chez Netlify**. Netlify se contente de servir le
dossier `public/` tel qu'il est dans ce dépôt (`netlify.toml` → `publish = "public"`,
pas de `command`). Autrement dit : *ce qui est commité est ce qui est en ligne.*

C'est un choix, pas une facilité :

- un déploiement ne peut pas échouer pour une raison de build (pas de `npm install`,
  pas de version de Node qui change sous les pieds) ;
- le `git diff` d'un commit montre littéralement ce qui change sur le site — y compris
  les chiffres, puisqu'ils sont écrits dans le HTML ;
- revenir en arrière, c'est revenir à un commit. Netlify garde en plus chaque
  déploiement et sait en republier un ancien en un clic.

## Le cycle quotidien

Personne ne le déclenche : il tourne dans GitHub Actions, sans PC allumé et sans
intervention.

```
5-jahres-wertung.de  →  GitHub Actions, 10 h  →  tools/uefa/page.html
                                                       ↓  node tools/build.mjs
                                                  public/**  →  commit  →  push
                                                       ↓
                                               Netlify publie (~30 s)
```

Le rafraîchissement ne réécrit qu'un bloc de `tools/uefa/page.html`, délimité par
les sentinelles `/*DATA_START*/` … `/*DATA_END*/`. Le reste — mise en page,
graphiques, historique des saisons closes dans `/*HIST_START*/` … `/*HIST_END*/` —
ne bouge pas.

Trois issues possibles, et une seule écrit quelque chose :

| | |
|---|---|
| la source n'a pas bougé | rien n'est écrit, aucun commit |
| nouvelles données, contrôles passés | commit, Netlify publie |
| un contrôle échoue | **rien n'est écrit**, l'échec est visible dans l'onglet Actions, la page de la veille reste en ligne |

Les contrôles sont détaillés dans `tools/uefa/SOURCES.md`. Le plus parlant vérifie
le barème club par club sur les 463 engagés : `points = V_quali + 0,5 × N_quali +
2 × V_phase + 1 × N_phase + bonus`. Une page fausse est pire qu'une page datée.

L'horaire est doublé (08:00 et 09:00 UTC) parce que cron travaille en UTC et que
Paris change d'heure ; le passage inutile de l'autre saison sort immédiatement en
« inchangé ».

## Arborescence

```
public/            ce qui est publié — ne pas éditer à la main
  index.html         accueil (générée)
  uefa/index.html    page UEFA (générée)
  tennis/index.html  page tennis (générée)
  404.html  robots.txt  sitemap.xml   (l'icône est incrustée dans les pages)
tools/
  build.mjs          génère tout public/
  index.mjs          gabarit de l'accueil
  chrome.mjs         barre de navigation et jeu de couleurs partagés
  tennis.src.html    source de la page tennis, figée
  uefa/
    page.html        source de la page UEFA ; seul son bloc de données est réécrit
    refresh.mjs      va lire la source, contrôle, réécrit, relance le build
    extract.mjs      lecture pure des quatre pages → objet ; aucun accès réseau
    test-extract.mjs test de non-régression hors ligne
    names.json       code pays → nom de la nation
    club-aliases.json  quelques noms de clubs francisés
    nations.json     chiffres des vignettes de l'accueil
    fixtures/        capture réelle des pages sources + sortie attendue
    SOURCES.md       d'où vient chaque champ, et les pièges
.github/workflows/uefa.yml   la tâche de 10 h
netlify.toml       publication, redirections, en-têtes
```

## À la main

```sh
npm ci
npm run test:extract     # contrôle hors ligne, une seconde
npm run refresh:dry      # va lire la source, contrôle, n'écrit rien
npm run refresh          # écrit et régénère public/
npm run build            # régénère public/ sans toucher aux données
```

Une seule dépendance, `linkedom`, pour lire du HTML côté Node.
