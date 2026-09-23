/* Chrome partagé du site : jeu de couleurs, thème clair/sombre, barre de
   navigation, favicon.

   Un seul système de thème pour les trois pages. Avant, chacune faisait autre
   chose : l'accueil suivait `prefers-color-scheme` sans bouton, la page UEFA
   avait son bouton et démarrait en clair, la page tennis était sombre en dur.
   Sur une machine réglée en sombre, on passait donc d'un accueil sombre à une
   page UEFA claire d'un clic — et la page tennis restait sombre quoi qu'on
   fasse. C'est cette incohérence-là que les exports ci-dessous suppriment :
   mêmes jetons, même attribut `data-theme`, même bouton, même mémoire. */

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&family=Newsreader:opsz,wght@6..72,400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">`;

/* Mesure d'audience — Umami Cloud, palier gratuit.
 *
 * Un seul endroit pour les trois pages. Umami ne pose pas de cookie et
 * n'empreinte pas le navigateur : pas de bandeau de consentement à afficher,
 * ce qui est exactement la raison de ne pas avoir pris Google Analytics.
 *
 * Tant que l'identifiant est vide, AUCUNE balise n'est émise : le site n'appelle
 * alors aucun tiers, et rien ne casse. Coller l'identifiant fourni à la création
 * du site dans Umami suffit à activer la mesure partout.
 *
 * `defer` plutôt que `async` : le script ne bloque pas le rendu et part après le
 * document. Une page de données n'a aucune raison d'attendre son compteur. */
const UMAMI_ID = 'b0764e0c-1476-483f-8a03-c180ba11e2d7';   // site grotang.fr dans Umami Cloud
export const ANALYTICS = UMAMI_ID
  ? `<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_ID}"></script>`
  : '<!-- mesure d\'audience : en attente de l\'identifiant Umami -->';

/* Les jetons, définis une fois. Le clair est le défaut : le sombre est un choix
   que le lecteur pose, pas un réglage système qu'on lui impose — c'était le
   travers de l'ancienne accueil. */
export const TOKENS = `
:root{
  color-scheme: light;
  --ground:#EBEEF3; --surface:#FBFCFE; --surface-2:#F3F5F9;
  --ink:#0F141D; --ink-2:#48525F; --ink-3:#78828F;
  --rule:#D4DAE3; --rule-soft:#E3E8EF;
  --fr:#2a78d6; --fr-soft:#E4EDFA;
  --good:#0F7040; --bad:#B02C2C;
  --n1:#2a78d6; --n2:#eb6834; --n3:#1baf7a; --n4:#eda100; --n5:#e87ba4; --n6:#008300; --n7:#4a3aa7; --n8:#e34948;
  --band:#F0F2F6;
  /* Les trois compétitions portent leurs couleurs UEFA : bleu nuit pour la Ligue
     des champions, orange pour la Ligue Europa, vert pour la Conference League.
     Les teintes de marque sont volontairement assombries en mode clair : la
     pastille du calendrier est remplie et le numéro de journée s'écrit en blanc
     dessus. L'orange de marque donnait 3,1:1, illisible ; ces valeurs tiennent
     toutes au-dessus de 5:1, mesuré. */
  --c1:#17368C; --c3:#C2410C; --c4:#0B7A38;
  --uefa:#2a78d6; --tennis:#0F7040;
  --shadow:0 1px 2px rgba(15,20,29,.05),0 8px 24px -12px rgba(15,20,29,.14);
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --ground:#0A0D13; --surface:#141A24; --surface-2:#1B222E;
  --ink:#E8ECF3; --ink-2:#A0AAB9; --ink-3:#727D8C;
  --rule:#28313F; --rule-soft:#1F2733;
  --fr:#5D9BF0; --fr-soft:#16233A;
  --good:#43BE83; --bad:#EE7A76;
  --n1:#3987e5; --n2:#d95926; --n3:#199e70; --n4:#c98500; --n5:#d55181; --n6:#008300; --n7:#9085e9; --n8:#e66767;
  --band:#111823;
  /* En sombre le rapport s'inverse — le chiffre s'écrit en sombre sur la pastille
     remplie — donc les mêmes teintes, éclaircies. 6,3:1 au pire. */
  --c1:#6E9CF0; --c3:#F07A42; --c4:#2FC97A;
  --uefa:#5D9BF0; --tennis:#43BE83;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.8);
}`;

/* Posé dans le <head>, avant tout rendu : sans ça une page choisie en sombre
   s'affiche une fraction de seconde en clair à chaque navigation. Le stockage
   peut être indisponible (navigation privée) — on retombe alors sur le clair
   sans rien casser. */
export const THEME_BOOT = `<script>(function(){try{if(localStorage.getItem('grotang-theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>`;

/* Le bouton vit dans la barre de navigation, donc sur les trois pages, au même
   endroit. Le choix est écrit dans le domaine : il suit le lecteur d'une page à
   l'autre. L'évènement permet aux pages qui dessinent en JS (graphiques UEFA,
   carte de chaleur tennis) de se redessiner aux nouvelles couleurs. */
export const THEME_JS = `<script>(function(){
  var root=document.documentElement, btn=document.getElementById('gn-theme');
  var store={get:function(){try{return localStorage.getItem('grotang-theme');}catch(e){return null;}},
             set:function(v){try{localStorage.setItem('grotang-theme',v);}catch(e){}}};
  function apply(t,persist){
    if(t==='dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme');
    if(btn){ btn.setAttribute('aria-pressed', t==='dark');
             btn.querySelector('.gn-theme-t').textContent = t==='dark' ? 'Clair' : 'Sombre'; }
    if(persist) store.set(t);
    document.dispatchEvent(new CustomEvent('grotang:theme',{detail:{theme:t}}));
  }
  apply(store.get()==='dark'?'dark':'light', false);
  if(btn) btn.addEventListener('click', function(){
    apply(root.getAttribute('data-theme')==='dark'?'light':'dark', true); });
})();</script>`;

/* La barre lit les jetons partagés — plus de variante « sombre » à passer à la
   main, plus de palette parallèle qui dérive de celle des pages. */
export const navCSS = `
.gnav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:18px;
  padding:0 clamp(14px,3vw,28px);height:46px;background:var(--surface);
  border-bottom:1px solid var(--rule);
  font-family:Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased}
.gnav a{color:inherit;text-decoration:none}
.gnav .gn-mark{font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--ink);
  font-family:'IBM Plex Mono',ui-monospace,monospace;white-space:nowrap}
.gnav .gn-mark span{color:var(--ink-3);font-weight:500}
.gnav nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.gnav nav a{font-size:12.5px;font-weight:600;color:var(--ink-3);
  padding:5px 10px;border-radius:6px;line-height:1.2;white-space:nowrap}
.gnav nav a:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 7%,transparent)}
.gnav nav a[aria-current="page"]{color:var(--fr);
  background:color-mix(in srgb,var(--fr) 12%,transparent)}
.gn-theme{display:inline-flex;align-items:center;gap:7px;cursor:pointer;flex:none;
  appearance:none;border:1px solid var(--rule);background:var(--surface-2);color:var(--ink-3);
  font:inherit;font-size:12px;font-weight:600;border-radius:6px;padding:4px 10px;line-height:1.3}
.gn-theme:hover{border-color:var(--ink-3);color:var(--ink)}
.gn-theme:focus-visible{outline:2px solid var(--fr);outline-offset:2px}
.gn-theme .gn-theme-i{width:11px;height:11px;border-radius:50%;flex:none;
  border:1px solid var(--ink-3);background:linear-gradient(90deg,transparent 50%,var(--ink-3) 50%)}
.gn-theme[aria-pressed="true"] .gn-theme-i{background:var(--fr);border-color:var(--fr)}
@media (max-width:560px){.gnav{height:auto;padding-block:8px;flex-wrap:wrap;gap:8px}
  .gnav nav{margin-left:0;width:100%;justify-content:flex-start;order:3}
  .gn-theme{margin-left:auto}}
`;

export const PAGES = [
  { href: '/uefa/',   label: 'Coefficient UEFA', key: 'uefa' },
  { href: '/tennis/', label: 'Français en Grand Chelem', key: 'tennis' },
];

export function nav(current) {
  const links = PAGES.map(p =>
    `<a href="${p.href}"${p.key === current ? ' aria-current="page"' : ''}>${p.label}</a>`).join('');
  return `<div class="gnav"><a class="gn-mark" href="/">GROTANG<span>.FR</span></a>`
    + `<nav>${links}</nav>`
    + `<button type="button" class="gn-theme" id="gn-theme" aria-pressed="false" title="Basculer clair / sombre">`
    + `<span class="gn-theme-i" aria-hidden="true"></span><span class="gn-theme-t">Sombre</span></button></div>`;
}

/* L'icône est incrustée dans chaque page plutôt que servie comme fichier : elle
   pèse 367 octets, et un fichier .svg qui transite par le pont vers le PC se voit
   greffer un manifeste de provenance C2PA qui le fait grossir à 8 Ko. */
export const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="7" fill="%230F141D"/%3E%3Cpath d="M6 22V10h4.4c2.9 0 4.6 1.5 4.6 4 0 1.8-.9 3-2.5 3.6L15.4 22h-3l-2.3-4h-1.2v4H6zm2.9-6.3h1.3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6H8.9v3.2z" fill="%23FBFCFE"/%3E%3Ccircle cx="22.5" cy="19" r="4.2" fill="none" stroke="%235D9BF0" stroke-width="2"/%3E%3C/svg%3E">`;
