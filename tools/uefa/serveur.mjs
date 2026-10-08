/* Petit serveur http local pour ouvrir public/ dans un navigateur de test.
   En file://, les adresses absolues (/fonts/…) ne se résolvent pas : les polices
   auto-hébergées ne chargeraient jamais. Utilisé par carte.mjs et test-page.mjs. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

export async function servir(racine) {
  racine = path.resolve(racine);
  const srv = http.createServer((req, res) => {
    let f = path.join(racine, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(racine)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  return { url: p => `http://127.0.0.1:${srv.address().port}/${p.replace(/^\//, '')}`, fermer: () => srv.close() };
}
