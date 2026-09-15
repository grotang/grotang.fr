/* Page d'accueil de grotang.fr.
 *
 * Elle est générée, pas écrite à la main : les chiffres qu'elle affiche sont
 * ceux des pages qu'elle annonce, relus à chaque construction. Une accueil qui
 * décrit ses pages vieillit ; une accueil qui les CITE reste juste.
 *
 * Parti pris, après une première version en vignettes : pas de cartes, pas
 * d'ombres, pas de « Ouvrir → ». Deux entrées, pas deux produits alignés — le
 * suivi UEFA est vivant et le tableau tennis est figé, les présenter en deux
 * tuiles jumelles était un mensonge de mise en page. Ici chaque entrée s'ouvre
 * sur le chiffre qui la résume et une phrase qui dit ce qu'il signifie.
 */
import { FONTS, FAVICON, navCSS, nav, TOKENS, THEME_BOOT, THEME_JS } from './chrome.mjs';

const nf = (v, d = 3) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const ord = n => n === 1 ? '1<sup>er</sup>' : n + '<sup>e</sup>';

/* Les cinq saisons qui composent le coefficient, à l'échelle, avec leur année.
   Une vraie petite série lisible plutôt qu'une silhouette décorative : cinq
   valeurs méritent d'être lues, pas suggérées. */
function seasons(vals, labels, { live = true } = {}) {
  const max = Math.max(...vals, 1);
  return `<div class="yrs">` + vals.map((v, i) => {
    const last = live && i === vals.length - 1;
    return `<div class="yr${last ? ' yr--live' : ''}">
      <span class="yr-v">${nf(v, 1)}</span>
      <span class="yr-b" style="--h:${Math.max(4, (v / max) * 100).toFixed(1)}%"></span>
      <span class="yr-l">${labels[i]}</span>
    </div>`;
  }).join('') + `</div>`;
}

export function buildIndex({ uefa, tennis }) {
  const css = `
${TOKENS}

*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;line-height:1.55}
${navCSS}
.wrap{max-width:940px;margin:0 auto;padding:clamp(34px,7vw,76px) clamp(18px,5vw,32px) 64px}

/* masthead — la marque reste discrète, la phrase porte le propos */
.mark{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin:0}
.lede{font-family:'Newsreader',Georgia,'Times New Roman',serif;font-optical-sizing:auto;
  font-size:clamp(23px,4.2vw,34px);line-height:1.28;letter-spacing:-.012em;font-weight:400;
  margin:14px 0 0;max-width:24ch;color:var(--ink)}
.lede b{font-weight:600}
.standfirst{margin:16px 0 0;max-width:62ch;font-size:15px;color:var(--ink-2)}

/* entrées — un filet, un numéro, un chiffre, une phrase. Pas de boîte. */
.entry{display:grid;grid-template-columns:minmax(0,1fr);gap:0;
  border-top:1px solid var(--rule);margin-top:clamp(34px,5vw,54px);padding-top:18px}
.entry-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.entry-no{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;font-weight:600;
  color:var(--ink-3);letter-spacing:.08em}
.entry-head h2{margin:0;font-size:15.5px;font-weight:700;letter-spacing:.01em}
.entry-head h2 a{color:inherit;text-decoration:none;
  border-bottom:2px solid color-mix(in srgb,var(--accent) 45%,transparent);padding-bottom:1px}
.entry-head h2 a:hover{border-bottom-color:var(--accent);color:var(--accent)}
.entry-tag{margin-left:auto;font-size:11.5px;color:var(--ink-3);display:inline-flex;align-items:center;gap:7px}
.entry-tag i{width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none}
.entry-tag i.off{background:var(--ink-3);opacity:.5}
.entry--uefa{--accent:var(--uefa)}
.entry--tennis{--accent:var(--tennis)}

.body{display:grid;grid-template-columns:minmax(130px,190px) minmax(0,1fr);
  gap:clamp(18px,4vw,44px);align-items:start}
.figure{margin:0}
.figure b{display:block;font-family:'IBM Plex Mono',ui-monospace,monospace;
  font-size:clamp(38px,7vw,58px);font-weight:600;letter-spacing:-.04em;line-height:.92;color:var(--accent)}
.figure b sup{font-size:.42em;top:-.9em;position:relative;letter-spacing:0}
.figure i{display:block;font-style:normal;margin-top:9px;font-size:12px;color:var(--ink-3);
  letter-spacing:.05em;text-transform:uppercase;font-weight:600;line-height:1.35}
.say{margin:0;font-size:16.5px;line-height:1.62;max-width:56ch;color:var(--ink)}
.say b{font-weight:700;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.94em}
.say + .say{margin-top:11px;font-size:14.5px;color:var(--ink-2)}
.meta{margin:18px 0 0;font-size:12.2px;color:var(--ink-3)}
.meta a{color:var(--accent);font-weight:600;text-decoration:none;white-space:nowrap}
.meta a:hover{text-decoration:underline}

/* les cinq saisons du coefficient, lisibles une par une */
.yrs{display:flex;gap:clamp(6px,1.4vw,14px);margin:22px 0 0;align-items:flex-end;max-width:420px}
.yr{flex:1 1 0;display:flex;flex-direction:column;align-items:stretch;gap:5px;min-width:0}
.yr-v{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;font-weight:600;
  color:var(--ink-2);text-align:center}
.yr-b{display:block;height:44px;position:relative;background:var(--rule-soft);border-radius:2px}
.yr-b::after{content:"";position:absolute;inset:auto 0 0 0;height:var(--h);
  background:color-mix(in srgb,var(--accent) 55%,transparent);border-radius:2px}
.yr--live .yr-v{color:var(--accent)}
.yr--live .yr-b::after{background:repeating-linear-gradient(135deg,
  color-mix(in srgb,var(--accent) 55%,transparent) 0 4px,transparent 4px 8px);
  box-shadow:inset 0 2px 0 var(--accent)}
.yr-l{font-size:10.5px;color:var(--ink-3);text-align:center;letter-spacing:.02em}

.colophon{margin:clamp(40px,6vw,64px) 0 0;padding-top:20px;border-top:1px solid var(--rule-soft);
  font-size:12.6px;line-height:1.8;color:var(--ink-3);max-width:74ch}
.colophon b{color:var(--ink-2);font-weight:600}
.colophon code{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.92em}

@media (max-width:640px){
  .body{grid-template-columns:1fr;gap:18px}
  .entry-tag{margin-left:0;flex-basis:100%}
}
`;

  /* La phrase d'accroche est un fait daté, pas une promesse marketing. */
  const lede = `La France est <b>${ord(uefa.rank)}</b> au coefficient UEFA, `
    + (uefa.behind
        ? `<b>${nf(uefa.behind.gap, 2)}</b> devant ${uefa.behind.name}.`
        : `au pied du classement européen.`);

  const uefaEntry = `
<section class="entry entry--uefa">
  <div class="entry-head">
    <span class="entry-no">01</span>
    <h2><a href="/uefa/">Coefficient UEFA, journée par journée</a></h2>
    <span class="entry-tag"><i></i>relevé deux fois par jour</span>
  </div>
  <div class="body">
    <p class="figure"><b>${uefa.rank}<sup>e</sup></b><i>sur ${uefa.nations}<br>associations</i></p>
    <div>
      <p class="say">La France pèse <b>${nf(uefa.total)}</b> points sur cinq ans.
        ${uefa.ahead ? `${uefa.ahead.cap} la précède de <b>${nf(uefa.ahead.gap, 2)}</b> ; ` : ''}
        ${uefa.behind ? `${uefa.behind.name} la suit à <b>${nf(uefa.behind.gap, 2)}</b>.` : ''}</p>
      <p class="say">Le rang ne bouge qu'une fois l'an, l'écart bouge à chaque soirée européenne.
        C'est lui que la page suit, tour par tour, de l'entrée en lice à la finale — avec l'origine
        des points par compétition et le détail club par club.</p>
      ${seasons(uefa.spark, uefa.years, { live: true })}
      <p class="meta">Cinq saisons glissantes ; la dernière, hachurée, est en cours
        (<b>${nf(uefa.season)}</b> acquis). Source arrêtée au ${uefa.lastUpdated}.
        &nbsp;·&nbsp; <a href="/uefa/">Lire la page</a></p>
    </div>
  </div>
</section>`;

  const tennisEntry = `
<section class="entry entry--tennis">
  <div class="entry-head">
    <span class="entry-no">02</span>
    <h2><a href="/tennis/">Français au tableau principal, depuis 1968</a></h2>
    <span class="entry-tag"><i class="off"></i>figé, saisie manuelle</span>
  </div>
  <div class="body">
    <p class="figure"><b>${tennis.lastVal}</b><i>Français<br>en ${tennis.lastYear}</i></p>
    <div>
      <p class="say">Sur les quatre Grands Chelems de ${tennis.lastYear}, <b>${tennis.lastVal}</b> Français
        au premier tour du simple messieurs — contre <b>${tennis.peakVal}</b> en ${tennis.peakYear},
        le sommet de l'ère Open.</p>
      <p class="say">${tennis.editions} années, quatre levées, une grille : l'effondrement
        des années 1980 et le pic des années 2000 se lisent sans commentaire.</p>
      <p class="meta">Données saisies à la main d'après Wikipédia ; elles ne bougent
        qu'après un Grand Chelem. L'automatisation viendra.
        &nbsp;·&nbsp; <a href="/tennis/">Lire la page</a></p>
    </div>
  </div>
</section>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>grotang.fr — coefficient UEFA et Français en Grand Chelem</title>
<meta name="description" content="La France est ${uefa.rank}e au coefficient UEFA des associations. Suivi étape par étape, relevé deux fois par jour, plus la série des Français au tableau principal des Grands Chelems depuis 1968.">
<meta property="og:title" content="grotang.fr">
<meta property="og:description" content="Coefficient UEFA journée par journée · Français en Grand Chelem depuis 1968">
<meta property="og:type" content="website">
${FAVICON}
${FONTS}
${THEME_BOOT}
<style>${css}</style>
</head>
<body>
${nav(null)}
<div class="wrap">
  <header>
    <p class="mark">grotang.fr</p>
    <h1 class="lede">${lede}</h1>
    <p class="standfirst">Deux séries de chiffres. La première est relue à la source et republiée
      sans que personne n'y touche ; la seconde est saisie à la main et l'assume. Les méthodes,
      les sources et leurs limites sont écrites en bas de chaque page.</p>
  </header>
  ${uefaEntry}
  ${tennisEntry}
  <p class="colophon">
    <b>Comment ça tient.</b> Le tableau UEFA est reconstruit à partir de
    <a href="https://www.5-jahres-wertung.de/">5-jahres-wertung.de</a>, site privé sans lien avec
    l'UEFA : les chiffres sont recalculés puis soumis à sept contrôles — dont le barème vérifié
    club par club sur les 463 engagés — et rien n'est publié si l'un d'eux échoue ; la page de la
    veille reste alors en ligne. La date affichée est celle de la dernière donnée disponible,
    pas celle de la publication.
  </p>
</div>
${THEME_JS}
</body>
</html>`;
}
