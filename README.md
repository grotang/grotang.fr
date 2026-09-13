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

```
source publique  →  reconstruction  →  tools/uefa/page.html
                                            ↓  node tools/build.mjs
                                       public/**  →  commit  →  push
                                            ↓
                                    Netlify publie (~30 s)
```

La reconstruction du matin ne réécrit qu'un bloc de `tools/uefa/page.html`, délimité
par les sentinelles `/*DATA_START*/` … `/*DATA_END*/`. Le reste de la page — la
mise en page, les graphiques, l'historique des saisons closes dans
`/*HIST_START*/` … `/*HIST_END*/` — ne bouge pas. Des contrôles d'intégrité bloquants
tournent avant le commit : si un seul échoue, rien n'est poussé et la version de la
veille reste en ligne. Une page fausse est pire qu'une page datée.

## Arborescence

```
public/            ce qui est publié — ne pas éditer à la main
  index.html         accueil (générée)
  uefa/index.html    page UEFA (générée)
  tennis/index.html  page tennis (générée)
  404.html  favicon.svg  robots.txt  sitemap.xml
tools/
  build.mjs          génère tout public/
  index.mjs          gabarit de l'accueil
  chrome.mjs         barre de navigation et jeu de couleurs partagés
  uefa/page.html     source de la page UEFA (réécrite chaque matin)
  uefa/nations.json  chiffres des vignettes de l'accueil
  tennis.src.html    source de la page tennis, figée
netlify.toml       publication, redirections, en-têtes
```

## Régénérer à la main

```sh
node tools/build.mjs
git add -A && git commit -m "màj" && git push
```

Aucune dépendance : Node seul suffit (aucun `node_modules`).
