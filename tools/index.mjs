/* Page d'accueil de grotang.fr — générée, pour que les chiffres des vignettes
   restent synchronisés avec les pages qu'elles annoncent. */
import { FONTS, FAVICON, navCSS, nav } from './chrome.mjs';

const nf = (v, d = 3) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const ord = n => n === 1 ? '1<sup>er</sup>' : n + '<sup>e</sup>';

/* Mini-barres : dernieres saisons. `live` marque la derniere comme en cours —
   remplissage efface plus un lisere plein en tete, sans trait (le SVG est etire
   en largeur, un contour se deformerait). */
function bars(vals, { live = false, hi = null, w = 232, h = 46, gap = 5 } = {}) {
  const max = Math.max(...vals, 1) * 1.12;
  const bw = (w - gap * (vals.length - 1)) / vals.length;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
    vals.map((v, i) => {
      const bh = Math.max(2, (v / max) * h), x = i * (bw + gap), y = h - bh;
      const last = live && i === vals.length - 1;
      const r = (yy, hh, op) => `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="1.5" fill="currentColor" opacity="${op}"/>`;
      return last ? r(y, bh, .2) + r(y, 2.2, .95)
                  : r(y, bh, hi != null && i === hi ? 1 : .5);
    }).join('') + `</svg>`;
}

export function buildIndex({ uefa, tennis }) {
  const css = `
:root{color-scheme:light;
  --ground:#EBEEF3;--surface:#FBFCFE;--surface-2:#F3F5F9;
  --ink:#0F141D;--ink-2:#48525F;--ink-3:#78828F;
  --rule:#D4DAE3;--rule-soft:#E3E8EF;
  --uefa:#2a78d6;--tennis:#0F7040;--shadow:0 1px 2px rgba(15,20,29,.05),0 8px 24px -12px rgba(15,20,29,.14)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;
  --ground:#0A0D13;--surface:#141A24;--surface-2:#1B222E;
  --ink:#E8ECF3;--ink-2:#A0AAB9;--ink-3:#727D8C;
  --rule:#28313F;--rule-soft:#1F2733;
  --uefa:#5D9BF0;--tennis:#43BE83;--shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.8)}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:Archivo,system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
${navCSS}
.wrap{max-width:1080px;margin:0 auto;padding:clamp(30px,7vw,72px) clamp(16px,4vw,32px) 56px}
.mast{margin-bottom:clamp(26px,5vw,44px)}
.mark{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:clamp(30px,7vw,52px);
  font-weight:600;letter-spacing:-.03em;line-height:1;margin:0}
.mark span{color:var(--ink-3)}
.sub{margin:12px 0 0;font-size:clamp(14px,2.2vw,16.5px);color:var(--ink-2);max-width:56ch;line-height:1.55}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(14px,2.4vw,22px)}
.card{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--rule);
  border-radius:14px;padding:clamp(20px,3vw,28px);text-decoration:none;color:inherit;
  box-shadow:var(--shadow);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;
  position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:var(--accent)}
.card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 45%,var(--rule));
  box-shadow:0 1px 2px rgba(15,20,29,.06),0 18px 40px -18px color-mix(in srgb,var(--accent) 55%,transparent)}
.card:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.card--uefa{--accent:var(--uefa)}
.card--tennis{--accent:var(--tennis)}
.kick{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:0 0 10px}
.card h2{margin:0;font-size:clamp(18px,2.6vw,21px);font-weight:700;letter-spacing:-.012em;line-height:1.25}
.card p{margin:9px 0 0;font-size:13.6px;line-height:1.6;color:var(--ink-2)}
.stats{display:flex;gap:22px;margin:20px 0 0;flex-wrap:wrap}
.stat{min-width:0}
.stat b{display:block;font-family:'IBM Plex Mono',ui-monospace,monospace;
  font-size:clamp(19px,3vw,23px);font-weight:600;letter-spacing:-.02em;line-height:1.1;color:var(--ink)}
.stat b sup{font-size:.55em;font-weight:600;top:-.55em;position:relative}
.stat i{display:block;font-style:normal;font-size:10.5px;letter-spacing:.045em;
  text-transform:uppercase;color:var(--ink-3);margin-top:5px;font-weight:600}
.spark{display:block;width:100%;height:46px;margin-top:18px;color:var(--accent)}
.sparkc{font-size:10.5px;color:var(--ink-3);margin:7px 0 0;letter-spacing:.02em}
.foot{margin-top:auto;padding-top:18px;display:flex;align-items:center;gap:8px;
  font-size:11.5px;color:var(--ink-3);white-space:nowrap}
.dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none}
.dot.stale{background:var(--ink-3)}
.go{margin-left:auto;font-weight:700;color:var(--accent);font-size:12.5px;flex:none}
.notes{margin:clamp(30px,5vw,48px) 0 0;padding-top:20px;border-top:1px solid var(--rule-soft);
  font-size:12.2px;line-height:1.75;color:var(--ink-3);max-width:78ch}
.notes a{color:var(--ink-2)}
.notes code{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.92em}
`;

  const uefaCard = `
<a class="card card--uefa" href="/uefa/">
  <p class="kick">Football · 55 associations</p>
  <h2>Coefficient UEFA, journée par journée</h2>
  <p>La course aux places européennes lue comme elle se joue : étape par étape, de l'entrée en lice à la finale, avec l'origine des points par compétition et le détail club par club.</p>
  <div class="stats">
    <div class="stat"><b>${ord(uefa.rank)}</b><i>France, 5 ans</i></div>
    <div class="stat"><b>${nf(uefa.total)}</b><i>Coefficient</i></div>
    <div class="stat"><b>${nf(uefa.season)}</b><i>Saison en cours</i></div>
  </div>
  ${bars(uefa.spark, { live: true })}
  <p class="sparkc">Coefficient de saison, ${uefa.sparkFrom} → ${uefa.sparkTo}. La dernière barre est en cours : source arrêtée au ${uefa.lastUpdated}.</p>
  <div class="foot"><span class="dot"></span><span>Actualisé chaque matin</span><span class="go">Ouvrir →</span></div>
</a>`;

  const tennisCard = `
<a class="card card--tennis" href="/tennis/">
  <p class="kick">Tennis · ${tennis.editions} éditions</p>
  <h2>🇫🇷 Français au tableau principal</h2>
  <p>Simple messieurs, ère Open. Le nombre de Français au premier tour de chaque Grand Chelem depuis 1968, en une seule grille lisible d'un coup d'œil.</p>
  <div class="stats">
    <div class="stat"><b>${tennis.peakVal}</b><i>Record, ${tennis.peakYear}</i></div>
    <div class="stat"><b>${tennis.lastVal}</b><i>Total ${tennis.lastYear}</i></div>
    <div class="stat"><b>1968</b><i>Début de série</i></div>
  </div>
  ${bars(tennis.spark, { hi: tennis.sparkHi })}
  <p class="sparkc">Total des quatre levées, ${tennis.sparkFrom} → ${tennis.sparkTo}. Barre pleine : le record.</p>
  <div class="foot"><span class="dot stale"></span><span>Données figées, saisie manuelle</span><span class="go">Ouvrir →</span></div>
</a>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>grotang.fr</title>
<meta name="description" content="Deux tableaux de bord tenus à jour : le coefficient UEFA des associations, journée par journée, et les Français au tableau principal des Grands Chelems depuis 1968.">
<meta property="og:title" content="grotang.fr">
<meta property="og:description" content="Coefficient UEFA journée par journée · Français en Grand Chelem depuis 1968">
<meta property="og:type" content="website">
${FAVICON}
${FONTS}
<style>${css}</style>
</head>
<body>
${nav(null)}
<div class="wrap">
  <header class="mast">
    <h1 class="mark">grotang<span>.fr</span></h1>
    <p class="sub">Deux tableaux de bord, tenus à jour. Des chiffres sourcés, la méthode assumée en bas de chaque page, et rien d’autre.</p>
  </header>
  <div class="cards">${uefaCard}${tennisCard}</div>
  <p class="notes">
    Le tableau UEFA est reconstruit chaque matin à partir de la source publique et republié automatiquement ; la date affichée sur sa vignette est celle de la dernière donnée disponible, pas celle de la publication. La grille tennis est saisie à la main et ne bouge qu'après un Grand Chelem — c'est le prochain chantier d'automatisation.
    Les méthodes de calcul et leurs limites sont détaillées en bas de chaque page.
  </p>
</div>
</body>
</html>`;
}
