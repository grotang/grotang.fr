#!/bin/bash
# Saisons closes (2021/22 à 2025/26) des blocs 1 et 2 : relevé unique, à relancer seulement
# si l'on veut refaire calendrier-saisons.json. Wikipédia EN, wikitexte brut (action=raw),
# une page à la fois, pause entre deux pages et reprise douce sur 429.
#   bash releve.sh                       -> raw/*.txt (non versionné)
#   python3 parse.py                     -> wiki-saisons.json (date, heure CET/CEST, clubs, score, tour)
#   python3 croise.py wiki-saisons.json ../matchs-saisons.json croise.json   (recoupement avec l'archive)
#   python3 pack.py croise.json ../vnd-saisons.json ../calendrier-saisons.json
cd "$(dirname "$0")"; mkdir -p raw
get(){ local t="$1"; local f="raw/$(echo "$t" | sed 's/[^A-Za-z0-9]\+/_/g').txt"
  [ -s "$f" ] && ! grep -q "^#REDIRECT" "$f" && return
  local u=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1].replace(' ','_')))" "$t")
  for e in $(seq 1 14); do
    c=$(curl -s -o "$f.tmp" -w "%{http_code}" -A "grotang.fr-robot/1.0 (https://grotang.fr/; releve unique des saisons passees)" "https://en.wikipedia.org/w/index.php?action=raw&title=$u")
    if [ "$c" = 200 ]; then mv "$f.tmp" "$f"; break; fi
    if [ "$c" = 404 ]; then echo "__MISSING__" > "$f"; rm -f "$f.tmp"; break; fi
    sleep $((e*5))
  done
  local r=$(grep -m1 -o -i "^#REDIRECT *\[\[[^]]*" "$f" | sed 's/^#REDIRECT *\[\[//I')
  [ -n "$r" ] && get "$r"
  sleep 2; }
while IFS= read -r t; do get "$t"; done < titres.txt
