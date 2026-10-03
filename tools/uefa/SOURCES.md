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

## Dates de sortie des clubs, saison 2026/27

`tools/uefa/wiki/` — une ligne par club et par tour de qualification.

La source du classement publie l'effectif engagé et l'effectif encore en lice,
jamais la date de sortie. Les tableaux de confrontations des trois compétitions
la donnent : deux équipes, leur pays par le drapeau, le vainqueur en gras.

Chaîne : trois pages enregistrées à la main depuis le navigateur (les
qualifications de C1, C3 et C4) → `parse-wiki.py` → `qualifs-2026-27.json`
(430 participations) → `survie.py` → `survie-2026-27.json` et le bloc `QUAL`
de `page.html`.

Deux règles que les tableaux ne disent pas, et qui sont dans `survie.py` :
un club n'est éliminé qu'à sa **dernière** défaite toutes compétitions
confondues (sortir de C1 en juillet, c'est basculer en C3) ; et trois défaites
mènent directement à une phase de ligue, sans autre match — barrage de C1,
troisième tour de C1 côté League Path, barrage de C3.

Contrôle : `engagés − éliminés = encore en lice`, pour les 54 associations.
Il passe. C'est lui qui a révélé que le Monténégro manquait au décompte des
engagés, la source ne pouvant pas déduire son diviseur d'un coefficient de
saison nul.

Figé jusqu'en février : les qualifications sont terminées, il n'y a rien à
rafraîchir. Les sorties de phase finale demanderont le même relevé.

## Archive des saisons passées, 55 associations

`tools/uefa/archive/` — décomposition en quatre postes d'une saison close,
pour toutes les associations et non plus seulement les seize suivies.

Deux pages de la source, enregistrées à la main depuis le navigateur. Elles
vivent dans `/Memberbereich/DB/`, que le `robots.txt` du site déclare privé :
aucun robot n'ira les chercher, ni le nôtre ni moi.

    .../Memberbereich/DB/PktjeNat.php?parm1=AAAA   effectif, coefficient,
                                                   et par club : Q/H, bonus, total
    .../Memberbereich/DB/AvSpiele.php?parm1=AAAA   tous les matchs, tour par tour

`parm1` est l'année de DÉPART : 2025 = saison 2025/26.

Les deux sont nécessaires. « Pkt je Nat » ne découpe qu'en trois
(qualifications, Hauptrunde, bonus) ; séparer la phase de ligue de la phase
finale, et isoler le bonus d'entrée du reste, demande de savoir quel tour
chaque club a joué — c'est la liste des matchs qui le dit.

`lire-archive.py` produit `decomp-AAAA.json` et refuse d'écrire si la somme
des quatre postes ne retrouve pas le coefficient publié, association par
association. Une ligne par association, quatre valeurs déjà divisées par
l'effectif engagé : `[bonus d'entrée, qualifications, phase de groupes ou de
ligue, phase finale]`.

    python3 tools/uefa/archive/lire-archive.py <dossier> <annee> [prefixe]
    python3 tools/uefa/archive/lire-archive.py "GT for Claude" 2021 "2021 "

Cinq saisons relevées, toutes au vert :

    2021/22   55 associations   816 matchs
    2022/23   54 associations   804 matchs
    2023/24   54 associations   806 matchs
    2024/25   54 associations   957 matchs
    2025/26   54 associations   961 matchs

DEUX BARÈMES. Jusqu'à 2023/24 : phase de groupes, bonus d'entrée de 4 points
par club de C1, et aucun bonus de classement — tout bonus qui n'est pas le
bonus d'entrée est un bonus de tour, donc de la phase finale, sans rien à
deviner. À partir de 2024/25 : phase de ligue, bonus d'entrée de 6 points, et
un bonus de classement qu'il faut séparer des bonus de tour ; les bonus de
tour se déduisent des tours effectivement joués (1,5 en C1, 1 en C3, 0,5 en
C4, à partir des huitièmes), le reste est le classement.

DEUX PIÈGES DE LA SOURCE, tous deux écartés :
- les byes, inscrits comme une rencontre contre « Freilos » (pays « Leer ») ;
- les rencontres jamais disputées, laissées à 0:0 et annotées — Leipzig
  - Spartak, huitièmes de C3 2021/22, exclusion de la Russie. Un forfait, lui,
  porte un score attribué (0:3) et compte normalement : Tottenham - Rennes en
  2021/22 et Dnipro - Puskás en 2024/25 sont bien gardés.

RÉSERVE LEVÉE. Le relevé étape par étape fait à la main pour les seize nations
suivies (`HIST`) rangeait les bonus de tour avec la phase de ligue ; la saison
en cours, elle, les compte en phase finale. La reconstruction ci-dessus suit la
convention de la saison en cours — c'est ce qui permet de comparer une saison
close et la saison courante dans le même bloc. Les totaux et les deux premiers
postes sont identiques dans les deux méthodes, sur les cinq saisons. `HIST`
reste la source du bloc 1, qui trace le cumul et n'a pas ce découpage à faire.

## Puissance des clubs (infobulles « clubs » des blocs 1 et 7a)

`archive/puissance-clubs-brut.json` : pour chaque nation, les points d'équipe de
chaque club cumulés sur les cinq saisons archivées (2021/22 → 2025/26), lus dans
les pages « AV Pkt je Nat » enregistrées à la main. C'est la mesure que l'UEFA
retient pour classer ses clubs (sans le plancher de 20 % du coefficient
national). Injecté dans la page entre `/*POW_START*/` et `/*POW_END*/`, noms
passés par `club-aliases.json` pour coller aux noms du rafraîchissement.

L'effectif club par club des 55 nations (nom, compétition, éliminé, points de la
saison) vient du rafraîchissement quotidien : `extract.mjs` le lit dans la page
publique PktNat et le publie dans `D.eff`. Un club absent de POW n'a joué aucun
match européen sur la période : il s'affiche « — ».

Tour de sortie club par club (infobulle du bloc 7a) : `wiki/sorties-2026-27.json`,
produit par `sorties-clubs.py`, qui rapproche les noms du grand livre (Wikipédia)
de ceux de la source, nation par nation, parmi les seuls clubs éliminés. Contrôle :
129 sorties sur 129, et pour chaque nation le nombre de sorties par tour retrouve
exactement celui du bloc QUAL.
