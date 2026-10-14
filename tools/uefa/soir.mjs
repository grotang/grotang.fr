/* La veille du soir de match (workflow uefa-soir.yml).

   POURQUOI. Les tâches planifiées de GitHub partent en retard, parfois de
   plusieurs heures (13/10/2026 : le passage de 23 h 38 est parti à 2 h 33), et
   GitHub prévient qu'il peut en sauter. Plutôt que d'espérer qu'un passage
   tombe au bon moment, on lance la veille TÔT dans la soirée, et elle reste
   éveillée : elle relit la source et Wikipédia toutes les dix minutes, dépose
   dès qu'il y a du neuf, et s'arrête quand tout est à jour. Un départ en retard
   ne fait plus rater la soirée, il raccourcit seulement l'attente.

   Usage : node tools/uefa/soir.mjs <question>, réponse par le code de sortie
   (0 = oui, 1 = non), pour le script du workflow :
     match      ce soir (date de Paris d'il y a six heures) est-il un soir de match ?
     tot        est-il trop tôt pour relire (avant 20 h 35, Paris) ?
     tard       est-il trop tard pour continuer (après 3 h 30, Paris) ?
     fini       la source est-elle datée de ce soir, et Wikipédia a-t-il le score
                de tous les matchs de ce soir ? (lu dans le compte rendu laissé par
                ligue-wiki.mjs au dernier passage) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
const bloc = nom => { const m = new RegExp(`const ${nom} = (\\{[\\s\\S]*?\\n\\});`).exec(page);
  if (!m) throw new Error(`calendrier ${nom} introuvable dans page.html`); return Function(`return (${m[1]});`)(); };

const paris = d => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).map(x => [x.type, x.value])); return { jour: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute }; };
const now = paris(new Date());
const SOIR = paris(new Date(Date.now() - 6 * 3600e3)).jour;   // à 1 h du matin, on parle encore de la veille

/* tous les soirs de match : une journée de ligue s'étale sur le nombre de soirs
   que dit son libellé (« 8–10 sept. » = trois) ; en C1 chaque manche de phase
   finale et de qualification se joue sur deux soirs (mardi, mercredi). */
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const soirs = new Set();
const ajoute = (iso, n) => { for (let j = 0; j < n; j++) soirs.add(plus(iso, j)); };
for (const [k, L] of Object.entries(bloc('CAL'))) for (const [iso, lab] of L) {
  const m = /^(\d+)\s*[–-]\s*(\d+)/.exec(lab || ''); ajoute(iso, m && +m[2] >= +m[1] ? +m[2] - +m[1] + 1 : 1); }
for (const nom of ['KO', 'QUAL']) for (const [k, L] of Object.entries(bloc(nom))) for (const e of L)
  for (const x of e.slice(1)) if (/^\d{4}-\d{2}-\d{2}$/.test(x)) ajoute(x, +k === 0 ? 2 : 1);

const D = JSON.parse(page.split('/*DATA_START*/')[1].split('/*DATA_END*/')[0].replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));
const ms = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(D.meta.lastUpdated || ''));
const source = ms ? `${ms[3]}-${ms[2]}-${ms[1]}` : null;

const q = process.argv[2];
let oui;
if (q === 'match') { oui = soirs.has(SOIR); console.log(`Soir du ${SOIR} : ${oui ? 'soir de match' : 'pas de match'}`); }
else if (q === 'tot') oui = now.min >= 6 * 60 && now.min < 20 * 60 + 35;
else if (q === 'tard') oui = now.min >= 3 * 60 + 30 && now.min < 12 * 60;
else if (q === 'fini') {
  let w = null; try { w = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'grotang-soir.json'), 'utf8')); } catch {}
  const wikiOk = !!w && w.soir === SOIR && w.joues >= w.prevus;
  const srcOk = source != null && source >= SOIR;
  oui = wikiOk && srcOk;
  console.log(`Soir du ${SOIR} · source arrêtée au ${D.meta.lastUpdated} (${srcOk ? 'à jour' : 'pas encore'}) · Wikipédia : `
    + (w && w.soir === SOIR ? `${w.joues} score(s) sur ${w.prevus} match(s)` : 'pas de compte rendu') + (oui ? ' → tout est à jour' : ''));
}
else { console.error('question inconnue : match | tot | tard | fini'); process.exit(2); }
process.exit(oui ? 0 : 1);
