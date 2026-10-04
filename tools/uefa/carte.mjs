/* Carte de partage (og:image) : l'aperçu qui s'affiche quand on colle le lien
   dans WhatsApp, LinkedIn, Slack...  1200 x 630, refabriquee a chaque mise a
   jour a partir de la page publiee — memes chiffres que le bloc 8, memes
   couleurs, aucune donnee recopiee.

     node tools/uefa/carte.mjs            ->  public/uefa/carte.png (sombre)
     node tools/uefa/carte.mjs clair      ->  version claire, pour comparer

   Anti-churn : la carte est signee par le dessin qu'elle contient (le SVG,
   donc les chiffres et la date). Si la signature n'a pas bouge depuis la
   derniere fois, le PNG existant est garde tel quel — une image refaite a
   l'identique peut differer de quelques octets, et ce serait un commit pour
   rien chaque matin.   */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { servir } from './serveur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(ICI, '../../public/uefa/index.html');
const THEME = process.argv[2] === 'clair' ? 'light' : 'dark';
const SORTIE = path.join(ICI, '../../public/uefa', process.argv[3] || 'carte.png');
const SIG = SORTIE.replace(/\.png$/, '.sig');

const EXE = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
const nav = await chromium.launch(EXE ? { executablePath: EXE } : {});
const pg = await nav.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: THEME });
/* Servie en http local : les polices auto-hébergées (/fonts/) ne chargent pas en file://. */
const serveur = await servir(path.join(ICI, '../../public'));
await pg.goto(serveur.url('uefa/'));
await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, THEME);
await pg.waitForFunction(() => typeof PRJ !== 'undefined' && document.fonts.ready, null, { timeout: 15000 });
await pg.evaluate(() => document.fonts.ready);

const dessin = await pg.evaluate(() => {
  const W = 1200, H = 630, P = PRJ.q.tir;
  const rows = TOP8.filter(c => P[c]).map(c => ({ c, v: P[c] })).sort((a, b) => b.v[2] - a.v[2]);
  const lo = Math.floor(Math.min(...rows.map(r => r.v[0])) - 1), hi = Math.ceil(Math.max(...rows.map(r => r.v[4])) + 1);
  const mL = 250, mR = 120, x0 = mL, x1 = W - mR;
  const X = v => x0 + (x1 - x0) * (v - lo) / (hi - lo);
  const top = 236, pas = 44;
  const nf = v => v.toFixed(1).replace('.', ',');
  const saison = (D.meta && D.meta.season) || '';
  const maj = String((D.meta && D.meta.lastUpdated) || '').slice(0, 10);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" fill="var(--surface)"/>`;
  // en-tete
  s += `<text x="60" y="70" font-family="IBM Plex Mono, monospace" font-size="22" font-weight="600" letter-spacing="2" fill="var(--ink)">GROTANG<tspan fill="var(--fr)">.FR</tspan></text>`;
  s += `<text x="${W - 60}" y="70" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="18" fill="var(--ink-3)">mis à jour le ${maj}</text>`;
  s += `<text x="60" y="140" font-family="Newsreader, Georgia, serif" font-size="54" font-weight="600" style="font-optical-sizing:auto" fill="var(--ink)">Coefficient UEFA ${saison}</text>`;
  s += `<text x="60" y="184" font-family="Carlito, sans-serif" font-size="28" fill="var(--ink-2)">Où chaque nation peut finir la saison</text>`;
  s += `<text x="${W - 60}" y="184" text-anchor="end" font-family="Carlito, sans-serif" font-size="19" fill="var(--ink-3)">point : scénario médian · barre : 6 chances sur 10</text>`;
  // bande de la France
  const F = P.FRA, yb = top - pas / 2, hb = pas * rows.length;
  if (F) s += `<rect x="${X(F[0])}" y="${yb}" width="${X(F[4]) - X(F[0])}" height="${hb}" fill="var(--fr)" opacity=".08" rx="6"/>`;
  // graduations
  const pasG = (hi - lo) > 16 ? 5 : 2;
  for (let g = Math.ceil(lo / pasG) * pasG; g <= hi; g += pasG) {
    s += `<line x1="${X(g)}" x2="${X(g)}" y1="${yb}" y2="${yb + hb}" stroke="var(--rule-soft)" stroke-width="1"/>`;
    s += `<text x="${X(g)}" y="${yb + hb + 28}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="17" fill="var(--ink-3)">${g}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * pas, fr = r.c === 'FRA', c0 = `var(${SLOT[r.c] || '--ink-3'})`, v = r.v;
    s += `<text x="${mL - 22}" y="${y + 9}" text-anchor="end" font-family="Carlito, sans-serif" font-size="27" font-weight="${fr ? 700 : 400}" fill="${fr ? 'var(--fr)' : 'var(--ink)'}">${name(r.c)}</text>`;
    s += `<line x1="${X(v[0])}" x2="${X(v[4])}" y1="${y}" y2="${y}" stroke="${c0}" stroke-width="6" stroke-linecap="round" opacity=".3"/>`;
    s += `<line x1="${X(v[1])}" x2="${X(v[3])}" y1="${y}" y2="${y}" stroke="${c0}" stroke-width="20" stroke-linecap="round" opacity=".55"/>`;
    s += `<circle cx="${X(v[2])}" cy="${y}" r="${fr ? 11 : 9}" fill="${c0}" stroke="var(--surface)" stroke-width="3"/>`;
    s += `<text x="${X(v[4]) + 16}" y="${y + 8}" font-family="IBM Plex Mono, monospace" font-size="23" font-weight="${fr ? 700 : 500}" fill="${fr ? 'var(--fr)' : 'var(--ink-2)'}">${nf(v[2])}</text>`;
  });
  s += `</svg>`;
  document.body.innerHTML = s;
  document.body.style.cssText = 'margin:0;padding:0;background:var(--surface);overflow:hidden';
  document.documentElement.style.cssText = 'margin:0;padding:0';
  return s;
});
const sig = crypto.createHash('sha1').update(THEME + dessin).digest('hex');
const ancienne = fs.existsSync(SIG) && fs.readFileSync(SIG, 'utf8').trim();
if (ancienne === sig && fs.existsSync(SORTIE)) {
  await nav.close(); console.log('carte inchangee, gardee telle quelle'); process.exit(0);
}
/* Une police n'est chargee que lorsqu'un texte l'emploie : on les demande
   explicitement, sinon le titre partait dans la police de secours. */
await pg.evaluate(() => Promise.all(['600 54px Newsreader', '400 27px Carlito', '700 27px Carlito',
  '500 23px "IBM Plex Mono"', '600 22px "IBM Plex Mono"'].map(f => document.fonts.load(f))));
await pg.waitForTimeout(300);
await pg.screenshot({ path: SORTIE, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await nav.close(); serveur.fermer();
fs.writeFileSync(SIG, sig + '\n');
console.log('carte ->', SORTIE);
