# Sources amont du bloc UEFA

Tout vient de **5-jahres-wertung.de** (`https://www.5-jahres-wertung.de/APD/Online/`),
qui est aussi la source d'eurocoeff.com. Ce sont des pages HTML, pas une API : la
lecture se fait par analyse de tableau. Elles sont inaccessibles depuis le conteneur
Claude (politique de sortie réseau) mais parfaitement joignables depuis un runner
GitHub — c'est ce qui rend le rafraîchissement automatisable sans PC.

| Page | Contenu | Table utile |
|---|---|---|
| `5JW.php` | classement 5 ans, saison en cours, points d'équipe, participants | 3ᵉ table, 64 lignes ; en-tête `Platz…\|Kürzel\|…\|2022/2023…2026/2027\|Total\|Team-punkte\|…\|GT\|NACL\|NAEL\|NAECL` |
| `5JWSptgQ.php` | phase qualificative, journée par journée | `#GrDatentabelle` |
| `5JWSptgG.php` | phase de ligue / groupes, journée par journée | `#GrDatentabelle`, 65 lignes, groupes de colonnes `T-Pkt\|N-Pkt\|Ges\|Dif\|TP\|Rang` par journée |
| `5JWSptgH.php` | phase finale, tour par tour | `#GrDatentabelle` |
| `Teilnehmer.php` | clubs engagés, compétition d'entrée et compétition courante | — |
| `PktNat.php` | points par nation, sert au diviseur (clubs engagés) | — |

Pièges déjà rencontrés, à ne pas réintroduire :

- le diviseur d'une nation se déduit de `total_points / coefficient`, arrondi —
  ne jamais recompter les clubs à la main (l'Irlande donnait 3 au lieu de 4) ;
- la compétition d'un club est sa compétition **courante**, pas celle d'entrée
  (Lyon, reversé en C3, était compté en C1) ;
- l'intitulé des journées varie : `Lig`, `Grp`, `Gruppe`, avec ou sans espaces
  avant `.Sptg` ;
- le bonus de participation (6 points par club de C1) et le bonus de classement
  de la phase de ligue arrivent mélangés dans une seule colonne après la phase
  de ligue : il faut les séparer (plancher à 6,00 pour les 12 premiers, puis
  +0,25 par place au-dessus de la 25ᵉ) ;
- avant 2024/2025 le bonus de classement n'existe pas ; la présence d'une colonne
  `Start-B.` **quelque part dans la saison** détermine l'époque, pas sa présence
  dans une compétition donnée.

Contrôles bloquants avant publication : 55 nations, coefficient de saison de chaque
nation égal à `points d'équipe / diviseur` à 1e-3 près, et total 5 ans égal à la
somme des cinq colonnes annuelles. Si un seul échoue, on ne publie pas : la page de
la veille reste en ligne.
