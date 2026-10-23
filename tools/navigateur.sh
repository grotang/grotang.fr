#!/usr/bin/env bash
# Trouve un navigateur pour Playwright (projection, test de la page, carte de partage).
#
# Pourquoi ce fichier : `npx playwright install --with-deps chromium` télécharge
# Chromium ET installe des paquets système. Les 22 et 23/10/2026, cette seule
# étape a pris de 4 à plus de 10 minutes et fait expirer les tâches du robot
# (« The job has exceeded the maximum execution time »).
#
# 1. Le runner GitHub a déjà Google Chrome : on s'en sert, après avoir vérifié
#    que Playwright sait le piloter. Rien à télécharger, quelques secondes.
# 2. Sinon seulement, Chromium de Playwright, en deux essais de 5 minutes au plus.
#
# Le chemin retenu part dans PW_CHROMIUM, que lisent projette.mjs, test-page.mjs
# et carte.mjs.
set -u
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  exe=$(command -v "$c" 2>/dev/null) || continue
  if node -e "require('playwright').chromium.launch({ executablePath: process.argv[1] }).then(b => b.close()).catch(e => { console.error(e.message); process.exit(1); })" "$exe"; then
    echo "PW_CHROMIUM=$exe" >> "${GITHUB_ENV:-/dev/null}"
    echo "Navigateur du runner : $exe ($("$exe" --version 2>/dev/null))"
    exit 0
  fi
  echo "$exe présent mais non pilotable par Playwright"
done
echo "Pas de navigateur utilisable sur le runner : installation de Chromium (Playwright)."
for i in 1 2; do
  timeout 300 npx playwright install --with-deps chromium && exit 0
  echo "installation, essai $i en échec"
done
exit 1
