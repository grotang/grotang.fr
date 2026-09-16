# Recoupement hebdomadaire

## Pourquoi

Les contrôles de `refresh.mjs` vérifient que les chiffres de 5-jahres-wertung sont
cohérents **entre eux**. Une erreur de saisie cohérente avec elle-même les passe
tous au vert. Le recoupement confronte le résultat à **kassiesa.net**, qui
recalcule le même classement séparément à partir des mêmes résultats UEFA.

Ce n'est pas une seconde observation du réel — une erreur de l'UEFA passerait des
deux côtés. C'est un second calcul : il attrape une faute de saisie, une règle mal
appliquée, ou une erreur de notre propre reconstruction.

**Régime : signalant.** Un désaccord ne bloque jamais la publication, il s'affiche.

## Pourquoi c'est manuel

kassiesa.net n'est joignable ni depuis les runners GitHub ni depuis le bac à sable
de Claude. Le relevé passe par le navigateur du poste. D'où la cadence
hebdomadaire plutôt que quotidienne : mieux vaut un contrôle fiable une fois par
semaine qu'un contrôle quotidien qui échoue trois jours sur sept.

## Procédure

1. Ouvrir <https://kassiesa.net/uefa/data/method5/crank2027.html>
2. Extraire le tableau (Claude le fait via le navigateur intégré) au format :
   ```json
   { "upd": "Thu, 10 Sep 2026 22:58:37 CET",
     "rows": [ { "rank": 1, "name": "England", "tot": 103.13,
                 "y": [23, 17.375, 29.464, 28.68, 4.611] } ] }
   ```
3. Enregistrer sous `tools/uefa/snapshots/kassiesa-AAAA-MM-JJ.json`
4. `node tools/uefa/crosscheck.mjs tools/uefa/snapshots/kassiesa-AAAA-MM-JJ.json`
   (`--dry-run` pour voir sans écrire)
5. `node tools/build.mjs`
6. commit + push

## Seuils

| Écart | Verdict | Affichage |
|---|---|---|
| ≤ 0,0005 | arrondi d'affichage | ignoré — les deux publient au millième |
| ≤ 0,125 | mineur | pastille orange, ligne dans le tableau |
| > 0,125 | écart | pastille rouge, ligne en rouge |

Un rang qui diffère est toujours traité comme un écart.

Au-delà de **10 jours** sans relevé, la pastille passe au gris : un accord vieux de
trois semaines ne dit plus rien de la page du jour.

## Historique

| Date | Pays | Valeurs | Résultat |
|---|---|---|---|
| 2026-09-16 | 55 | 385 | accord complet |
