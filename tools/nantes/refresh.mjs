#!/usr/bin/env node
/* Remplace la photo tools/nantes/historique.csv par l'état actuel du Sheet,
 * après contrôle. À lancer quand on veut figer une nouvelle version de secours :
 *   npm run refresh:nantes */
import fs from 'node:fs';
import { CSV_URL, PHOTO, decode } from './source.mjs';

const r = await fetch(CSV_URL, { signal: AbortSignal.timeout(20000) });
if (!r.ok) { console.error('Sheet illisible : HTTP ' + r.status); process.exit(1); }
const txt = await r.text();
const s = decode(txt);   // lève une erreur si le Sheet ne passe pas les contrôles
const avant = fs.existsSync(PHOTO) ? fs.readFileSync(PHOTO, 'utf8') : '';
if (avant === txt) { console.log(`photo inchangée (${s.length} saisons)`); process.exit(0); }
fs.writeFileSync(PHOTO, txt);
console.log(`photo mise à jour : ${s.length} saisons, ${s[0].label} → ${s.at(-1).label}`);
