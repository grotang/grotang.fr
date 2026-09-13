# Comment le bloc UEFA est alimenté

Tout vient de **5-jahres-wertung.de** (`https://www.5-jahres-wertung.de/APD/Online/`).
C'est la source de fait du milieu : eurocoeff.com, football-coefficient.eu et les
autres ne font que la reformater. Ce sont des pages HTML, pas une API : la lecture
se fait en analysant les tableaux. Elles sont injoignables depuis le conteneur
Claude (politique de sortie réseau) mais parfaitement accessibles depuis un runner
GitHub — c'est ce qui rend le rafraîchissement automatisable sans PC allumé.

## Les quatre pages et ce qu'on y prend

| Page | Table | Ce qu'on en tire |
|---|---|---|
| `5JW.php` | la table de 64 lignes | rang, les cinq coefficients annuels, total, points d'équipe, retard, clubs engagés par compétition, les trois listes d'accès, la date de la prochaine journée, la saison d'attribution |
| `PktNat.php` | table de ~460 lignes, un bloc par nation | chaque club : statut, V/N/D en qualification et en phase principale, bonus, points ; puis une ligne `Summe` qui redonne bonus, points d'équipe et coefficient de saison |
| `PktNat.php` | la table légende (15 lignes) | la correspondance statut → compétition, lue dans la page plutôt que codée en dur |
| `5JWSptgQ.php` | `#GrDatentabelle` | la phase qualificative, tour par tour |
| `5JWSptgG.php` | `#GrDatentabelle` | la phase de ligue, journée par journée |

Structure des deux tables « par étape » : onze colonnes fixes, puis huit blocs de
sept cellules `T-Pkt | N-Pkt | Ges | Dif | TP | Rang | séparateur`. On garde `Ges`
(total 5 ans à cette étape), `N-Pkt` (ce que l'étape a rapporté) et `Rang`. La
largeur des blocs est lue dans les `colspan` de l'en-tête, pas supposée.

## Pièges, tous payés au moins une fois

- **Le diviseur d'une nation** se déduit de `points d'équipe / coefficient de saison`,
  arrondi. Jamais d'un comptage de clubs : l'Irlande donnait 3 au lieu de 4.
- **La colonne `GT` de `5JW.php` compte les engagés du départ**, éliminés compris.
  Les clubs encore en lice, c'est `PktNat` qui les donne (« 4 von 5 Teams aktiv »).
  Les deux diffèrent pour 45 nations sur 55 dès la fin des qualifications.
- **La compétition d'un club est celle où il joue maintenant**, pas celle d'entrée.
  Lyon, entré en C1 et reversé en C3, porte le statut courant 55 et le statut de
  départ 23. Une fois éliminé (98 ou 99), c'est le statut de départ qui redevient
  la bonne réponse.
- **Les deux tables ne s'apparient pas par leur ordre.** `PktNat` numérote ses blocs
  autrement que le classement : s'y fier collait au Portugal les chiffres d'une
  autre nation. On les apparie par le nom allemand, présent des deux côtés.
- **Le bonus d'entrée n'est pas réservé au statut 19.** Fenerbahçe, statut 22, est
  bien en phase de ligue de C1 et touche ses 6 points. La chaîne précédente, qui
  passait par eurocoeff, sous-évaluait ce bonus pour six nations (TUR, GRE, NOR,
  AUT, AZE, SVK). Lire la colonne `Bonus` de la source règle la question.
- **Les nombres sont écrits tantôt `0.571` tantôt `0,000`** ; point et virgule sont
  tous deux décimaux, il n'y a jamais de séparateur de milliers.

## Contrôles bloquants

Rien n'est publié si l'un d'eux échoue — la page de la veille reste en ligne.

1. 55 nations dans le classement, 55 blocs de clubs, 55 séries dans chacune des
   deux tables par étape.
2. Pour chaque nation, les points d'équipe et le coefficient de saison lus dans le
   classement et dans la ligne `Summe` doivent coïncider. Deux lectures
   indépendantes qui doivent tomber d'accord.
3. Le total sur cinq ans égale la somme des cinq colonnes annuelles.
4. Le coefficient de saison égale les points d'équipe divisés par un entier.
5. La somme des points par compétition égale les points d'équipe.
6. **Le barème, vérifié club par club** : `points = V_quali + 0,5 × N_quali +
   2 × V_phase + 1 × N_phase + bonus`, sur les 463 clubs. Si l'UEFA ou la source
   change de barème, on l'apprend là.
7. La légende des statuts contient bien les codes 19, 39, 55, 89 et 98.

## Test de non-régression

`tools/uefa/fixtures/source.json.gz` est une capture réelle des quatre pages
(1,2 Mo compressés à 54 Ko) et `expected.json` la sortie validée correspondante.
`npm run test:extract` rejoue la lecture dessus et compare champ par champ ; il
tourne hors ligne en une seconde et passe avant chaque rafraîchissement
automatique. Modifier le collecteur sans mettre à jour `expected.json` fait
échouer le test, ce qui est le but.

Pour renouveler la capture, ouvrir une des pages du site dans un navigateur et,
depuis la console, récupérer les quatre pages en même origine puis les enregistrer
en JSON `{jw, pkt, sptgQ, sptgG}`.
