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

### Les horaires

Deux rendez-vous, en heure de Paris : **23 h 38**, quand les matchs européens sont
finis et que la source a recalculé, et **07 h 12**, pour que la page soit fraîche
au réveil.

Cron ne parle qu'UTC et ignore le changement d'heure, donc chaque rendez-vous
demande deux lignes — une par saison. En pratique :

| UTC | été | hiver |
|---|---|---|
| `38 21` | **23 h 38** | 22 h 38 |
| `38 22` | 00 h 38 | **23 h 38** |
| `12 5` | **07 h 12** | 06 h 12 |
| `12 6` | 08 h 12 | **07 h 12** |

La ligne qui tombe à côté ne coûte rien : elle relit la source, voit que rien n'a
bougé et sort sans écrire. Ça donne deux tentatives le soir et deux le matin, ce
qui n'est pas du luxe — GitHub documente que les tâches planifiées peuvent être
retardées et que « some queued jobs may be dropped ». C'est arrivé dès le premier
passage automatique. Pour la même raison la minute n'est jamais `00` : « High load
times include the start of every hour. »

### L'hébergement

Le site est servi par **GitHub Pages**, depuis le dossier `public/` de ce dépôt,
publié par `.github/workflows/pages.yml` à chaque commit qui touche ce dossier.
Il n'y a toujours aucune étape de build distante : *ce qui est commité est ce qui
est en ligne.*

Il a d'abord vécu chez Netlify. La bascule n'est pas un caprice : depuis leur
tarification au crédit, **un déploiement de production coûte 15 crédits** sur les
300 mensuels de l'offre gratuite, soit **20 déploiements par mois**, après quoi la
publication est suspendue. Un site conçu pour se republier deux fois par jour, plus
le travail de mise en forme, ne tient pas dans ce budget — la limite a été atteinte
en trois semaines, dont une seule journée de design. GitHub Pages ne compte pas les
déploiements d'un dépôt public.

Ce qu'on a perdu au change, et qu'il faut savoir :

- **les en-têtes HTTP personnalisés** (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`) : GitHub Pages ne permet pas de les
  définir. Sans formulaire ni cookie sur le site, la perte est théorique, mais elle
  est réelle ;
- **le contrôle du cache** : Pages sert le HTML avec `max-age=600`, donc une page
  peut rester dix minutes en cache après une publication. Pour une page rafraîchie
  deux fois par jour, c'est sans conséquence ;
- **le retour arrière en un clic** : Netlify gardait chaque déploiement et savait en
  republier un ancien. Ici on revient en arrière par un `git revert`, ce qui est de
  toute façon la source de vérité.

`netlify.toml` reste dans le dépôt : il documente la configuration précédente et
permettrait de revenir sans rien réécrire.

### Le budget de déploiements (historique, Netlify)

Netlify facture au crédit : **un déploiement de production coûte 15 crédits**, et le
plan gratuit en donne 300 par mois. Soit **20 déploiements mensuels**, sans dépassement
possible — au-delà, les sites de l'équipe sont mis en pause et les visiteurs voient
« Site not available » jusqu'au cycle suivant. Ni le trafic ni la bande passante ne
pèsent quoi que ce soit à cette échelle : le compteur, ici, compte les commits publiés.

Deux garde-fous :

- `netlify.toml` porte une commande `ignore` qui compare le commit publié au commit
  courant. Si rien n'a changé sous `public/`, la construction est sautée — le signe de
  vie mensuel, une correction dans `tools/`, une note dans ce fichier ne coûtent donc
  rien. (La documentation Netlify ne dit pas explicitement qu'une construction sautée
  n'est pas facturée ; à vérifier sur le compteur au prochain signe de vie.)
- Le travail de mise en forme se pousse **groupé**, un commit par session, pas un par
  modification. Le robot, lui, ne dépose que lorsque les chiffres bougent : en pleine
  phase de ligue cela fait quatre à sept déploiements par mois, ce qui laisse de la
  marge à condition de ne pas la gaspiller à côté.

### Le signe de vie

GitHub désactive les tâches planifiées d'un dépôt public resté 60 jours sans
activité. Comme le robot ne dépose un commit que quand les chiffres bougent, la
trêve estivale suffirait à faire couper la tâche — juste avant la reprise. Au bout
de 30 jours de silence, il écrit donc la date du jour dans
`tools/uefa/last-checked.txt` et la dépose. Le compteur repart avec un mois de
marge et `public/` n'est pas touché : le site publié reste identique à l'octet
près. En pleine saison ce commit n'apparaît jamais.

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
