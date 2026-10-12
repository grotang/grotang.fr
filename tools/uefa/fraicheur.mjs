/* Alarme de fraîcheur : la source aurait-elle dû bouger ?

   Le site ne casse jamais : si la source (5-jahres-wertung) se tait, il garde
   les chiffres de la veille. C'est voulu, mais personne n'est prévenu. Ce
   contrôle, lancé en dernière étape du robot, fait ÉCHOUER le passage quand :
     - un soir de Coupe d'Europe est passé (calendrier de la page : qualifications,
       journées de ligue, phase finale, toutes compétitions),
     - et la source n'a toujours pas été mise à jour depuis ce soir-là.
   Un passage en échec déclenche l'e-mail habituel de GitHub (« Run failed »)
   au propriétaire du dépôt. Rien d'autre à configurer, aucun identifiant.

   UNE SEULE ALERTE PAR JOUR : le contrôle ne sonne qu'au passage de 7 h 12
   (heure de Paris), le lendemain matin d'un soir de match au plus tôt. Les
   passages du soir laissent à la source le temps de se mettre à jour (elle le
   fait d'habitude avant minuit), et les autres passages du matin ne répètent
   pas l'alerte. Lancé à la main (`--maintenant`), il vérifie sans condition d'heure.

   Le calendrier ne retient que le PREMIER soir de chaque journée (convention
   de la page) : c'est suffisant, la source doit au moins avoir bougé depuis. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(ICI, 'page.html'), 'utf8');
const bloc = nom => { const m = new RegExp(`const ${nom} = (\\{[\\s\\S]*?\\n\\});`).exec(page);
  if (!m) throw new Error(`calendrier ${nom} introuvable dans page.html`); return Function(`return (${m[1]});`)(); };
const D = JSON.parse(page.split('/*DATA_START*/')[1].split('/*DATA_END*/')[0].replace(/^const D\s*=\s*/, '').replace(/;\s*$/, ''));

/* heure de Paris, sans dépendance */
const paris = d => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).map(x => [x.type, x.value])); return { jour: `${p.year}-${p.month}-${p.day}`, h: +p.hour }; };
const maintenant = paris(new Date());
const force = process.argv.includes('--maintenant');

/* tous les soirs de match de la saison */
const soirs = new Set();
for (const nom of ['CAL', 'KO', 'QUAL']) for (const L of Object.values(bloc(nom))) for (const e of L)
  for (const x of e) if (/^\d{4}-\d{2}-\d{2}$/.test(x)) soirs.add(x);
/* le dernier soir de match strictement avant aujourd'hui (Paris) */
const dernier = [...soirs].filter(x => x < maintenant.jour).sort().pop();

const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(D.meta.lastUpdated || ''));
const source = m ? `${m[3]}-${m[2]}-${m[1]}` : null;

console.log(`Paris : ${maintenant.jour} ${maintenant.h} h · dernier soir de match : ${dernier || 'aucun'} · source arrêtée au ${D.meta.lastUpdated}`);
if (!force && maintenant.h !== 7) { console.log('Contrôle de fraîcheur : seul le passage de 7 h (Paris) peut alerter.'); process.exit(0); }
if (!dernier) { console.log('Pas encore de soir de match cette saison.'); process.exit(0); }
if (!source) { console.log(`::error title=Alarme de fraîcheur::Date de la source illisible (« ${D.meta.lastUpdated} »).`); process.exit(1); }
if (source >= dernier) { console.log('Source à jour : rien à signaler.'); process.exit(0); }
const jours = Math.round((Date.parse(maintenant.jour) - Date.parse(dernier)) / 864e5);
console.log(`::error title=Alarme de fraîcheur::La source n'a pas bougé depuis le ${D.meta.lastUpdated}, alors qu'il y a eu des matchs le ${dernier.split('-').reverse().join('/')} (il y a ${jours} jour${jours > 1 ? 's' : ''}). Le site affiche des chiffres en retard.`);
process.exit(1);
