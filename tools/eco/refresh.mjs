#!/usr/bin/env node
/* Relit chez Eurostat les comptes des administrations publiques et réécrit
 * tools/eco/data.json, la source de la page /economie/.
 *
 *   node tools/eco/refresh.mjs            relit, contrôle, écrit si un chiffre a bougé
 *   node tools/eco/refresh.mjs --dry-run  relit et contrôle, n'écrit rien
 *
 * Une page fausse est pire qu'une page en retard : au moindre contrôle en
 * échec, rien n'est écrit et le script sort en erreur (le workflow échoue,
 * GitHub envoie son e-mail). Les contrôles sont dans eurostat.mjs.
 *
 * Écriture stable : data.json ne porte aucune date de lecture, seulement la
 * date de mise à jour annoncée par Eurostat. Tant qu'Eurostat ne publie rien,
 * le fichier ne bouge pas d'un octet et le robot ne dépose rien. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { construire, BASE } from './eurostat.mjs';
import { formate } from './format.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, 'data.json');
const sec = process.argv.includes('--dry-run');

/* Eurostat répond parfois 503 quelques minutes pendant ses mises en ligne :
   trois essais espacés, puis on abandonne (le passage suivant réessaiera). */
async function get(q) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + q, { headers: {
        'User-Agent': 'grotang.fr/1.0 (robot de mise a jour de https://grotang.fr/budget-france/)',
        Accept: 'application/json' } });
      if (r.ok) return await r.json();
      err = new Error(`HTTP ${r.status} sur ${q.slice(0, 80)}`);
    } catch (e) { err = e; }
    await new Promise(res => setTimeout(res, 20000 * (i + 1)));
  }
  throw err;
}

const { data, ctrl } = await construire(get);
for (const c of ctrl) console.log(c.ok ? '  ok ' : 'ÉCHEC', c.msg);
if (ctrl.some(c => !c.ok)) {
  console.error('\nUn contrôle a échoué : data.json n\'est pas réécrit.');
  process.exit(1);
}

/* Pas de marche arrière : une réponse tronquée d'Eurostat qui ferait reculer
   la dernière année publiée est refusée, même si ses sommes tombent juste. */
const avantTxt = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : null;
if (avantTxt) {
  const avant = JSON.parse(avantTxt);
  for (const k of ['der', 'derF', 'derT']) if (data[k] < avant[k]) {
    console.error(`\n${k} recule (${avant[k]} → ${data[k]}) : data.json n'est pas réécrit.`);
    process.exit(1);
  }
}

const txt = formate(data);
console.log(`\nAgrégats ${data.der} · fonctions ${data.derF} · impôts ${data.derT} · Europe ${data.ue.an} · Eurostat ${data.source.maj}`);
if (txt === avantTxt) { console.log('Aucun chiffre n\'a bougé : rien à écrire.'); process.exit(0); }
if (sec) { console.log('--dry-run : des chiffres ont bougé, rien n\'est écrit.'); process.exit(0); }
fs.writeFileSync(SORTIE, txt);
console.log('data.json réécrit (' + txt.length + ' octets).');
