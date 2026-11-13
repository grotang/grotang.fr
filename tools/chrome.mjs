/* Chrome partagé du site : jeu de couleurs, thème clair/sombre, barre de
   navigation, favicon.

   Un seul système de thème pour les trois pages. Avant, chacune faisait autre
   chose : l'accueil suivait `prefers-color-scheme` sans bouton, la page UEFA
   avait son bouton et démarrait en clair, la page tennis était sombre en dur.
   Sur une machine réglée en sombre, on passait donc d'un accueil sombre à une
   page UEFA claire d'un clic — et la page tennis restait sombre quoi qu'on
   fasse. C'est cette incohérence-là que les exports ci-dessous suppriment :
   mêmes jetons, même attribut `data-theme`, même bouton, même mémoire. */

/* Polices auto-hébergées (tools/fonts/, copiées dans public/fonts/ par build.mjs).
   Avant : feuille Google Fonts bloquante, deux domaines tiers à contacter avant le
   premier texte (≈ 2,5 s perdues sur mobile selon PageSpeed). Les trois fichiers
   du premier écran sont préchargés ; les autres (latin étendu, chasse fixe) ne
   viennent que si un caractère les demande. */
import fs from 'node:fs';
import { arbre, url, RUBRIQUES_A_VENIR, GAZETTE, estNouveau, finNouveau } from './site.mjs';

/* LA GAZETTE DANS LE MENU (06/11/2026, maquette B choisie par GT) : une ligne en
   retrait sous « Coefficient UEFA », qui mène à la DERNIÈRE gazette, avec sa date
   (« 5 nov. ») en étiquette. Elle dépend du coefficient, elle n'est pas une page
   de plus. Lue dans tools/uefa/archive/gazettes.json (rangé par gazettes.mjs) ;
   sans fichier, pas de ligne. Sur une page de gazette : nav('gazette'). */
const DERNIERE = (() => { try {
  const L = JSON.parse(fs.readFileSync(new URL('./uefa/archive/gazettes.json', import.meta.url), 'utf8')).liste || [];
  return L.length ? L.reduce((a, b) => (b.slug > a.slug ? b : a)) : null; } catch { return null; } })();
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const sousGazette = current => { if (!DERNIERE) return '';
  const [, m, j] = DERNIERE.slug.split('-').map(Number);
  return `<a class="gn-sub" href="${GAZETTE}${DERNIERE.slug}/" title="${String(DERNIERE.titre).replace(/"/g, '&quot;')}"${current === 'gazette' ? ' aria-current="page"' : ''}>La gazette de la semaine<span class="gn-date">${j} ${MOIS_C[m - 1]}</span></a>`; };

export const FONTS = `<link rel="preload" href="/fonts/carlito-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/carlito-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Carlito';font-style:normal;font-display:swap;font-weight:400;src:url(/fonts/carlito-latin-400-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Carlito';font-style:normal;font-display:swap;font-weight:400;src:url(/fonts/carlito-latin-ext-400-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Carlito';font-style:normal;font-display:swap;font-weight:700;src:url(/fonts/carlito-latin-700-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Carlito';font-style:normal;font-display:swap;font-weight:700;src:url(/fonts/carlito-latin-ext-700-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Newsreader';font-style:normal;font-display:swap;font-weight:600 700;src:url(/fonts/newsreader-latin-opsz-normal.woff2) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Newsreader';font-style:normal;font-display:swap;font-weight:600 700;src:url(/fonts/newsreader-latin-ext-opsz-normal.woff2) format('woff2-variations');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:400;src:url(/fonts/ibm-plex-mono-latin-400-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:400;src:url(/fonts/ibm-plex-mono-latin-ext-400-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:500;src:url(/fonts/ibm-plex-mono-latin-500-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:500;src:url(/fonts/ibm-plex-mono-latin-ext-500-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:600;src:url(/fonts/ibm-plex-mono-latin-600-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-display:swap;font-weight:600;src:url(/fonts/ibm-plex-mono-latin-ext-600-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}</style>`;

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
  --ink:#0F141D; --ink-2:#48525F; --ink-3:#626C79;
  --rule:#D4DAE3; --rule-soft:#E3E8EF;
  --fr:#2a78d6; --fr-soft:#E4EDFA;
  --good:#0F7040; --bad:#B02C2C;
  --n1:#2a78d6; --n2:#eb6834; --n3:#1baf7a; --n4:#eda100; --n5:#e87ba4; --n6:#008300; --n7:#4a3aa7; --n8:#e34948;
  --band:#F0F2F6;
  /* Les trois compétitions portent leurs couleurs UEFA : bleu nuit pour la Ligue
     des Champions, orange pour la Ligue Europa, vert pour la Ligue Conférence.
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
  --ink:#E8ECF3; --ink-2:#A0AAB9; --ink-3:#8A94A3;
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
/* Jeton de validation Google Search Console. Ce n'est pas un secret : il est
   visible dans le code source de chaque page, et c'est precisement a ca qu'il
   sert — Google le lit pour savoir que le proprietaire du site est bien celui
   qui a cree la propriete. Il est pose sur TOUTES les pages, y compris la
   racine, parce que c'est la racine que Google va chercher pour valider. */
export const VERIF = `<meta name="google-site-verification" content="BK3GerBr4zYq2lOucYbs99PLCkK4zzwYzuTYNaqtfZI">`;

export const THEME_BOOT = `<script>(function(){try{if(localStorage.getItem('grotang-theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();</script>`;

/* Le bouton vit dans la barre de navigation, donc sur les trois pages, au même
   endroit. Le choix est écrit dans le domaine : il suit le lecteur d'une page à
   l'autre. L'évènement permet aux pages qui dessinent en JS (graphiques UEFA,
   carte de chaleur tennis) de se redessiner aux nouvelles couleurs. */
export const THEME_JS = `<script>(function(){
  /* « new » périmé (data-fin, date de Paris) : retiré même si le site n'a pas été refabriqué depuis */
  try{var auj=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date());
    document.querySelectorAll('.gnav [data-fin]').forEach(function(e){ if(auj>=e.getAttribute('data-fin')) e.remove(); });}catch(e){}
  var dd=document.querySelectorAll('.gn-dd');
  var bar=document.querySelector('.gnav');
  /* place le panneau : sous sa rubrique, poussé vers la gauche s'il sortait
     de l'écran, la pointe au milieu de la rubrique ; et la hauteur de la barre
     pour que le fond ne la recouvre pas */
  function place(d){ var s=d.querySelector('summary'), p=d.querySelector('.gn-panel'); if(!s||!p) return;
    if(bar) document.documentElement.style.setProperty('--gn-h', bar.getBoundingClientRect().bottom+'px');
    p.classList.remove('gn-flip'); p.style.top='';
    /* téléphone : si la barre des rubriques passe sur deux lignes, le panneau
       se colle sous la ligne de SA rubrique, pas sous la barre entière */
    if(getComputedStyle(d).position==='static'){ var n=p.offsetParent; if(n){ p.style.top=(s.getBoundingClientRect().bottom-n.getBoundingClientRect().top+10)+'px'; } }
    /* s'il dépasse à droite, on le pousse vers la gauche juste ce qu'il faut
       (plutôt que de le retourner) : il reste au plus près de sa rubrique */
    p.style.marginLeft=''; var r=p.getBoundingClientRect(); if(r.right>innerWidth-8) p.style.marginLeft=(innerWidth-8-r.right)+'px';
    var sr=s.getBoundingClientRect(); r=p.getBoundingClientRect();
    p.style.setProperty('--cx', Math.max(16, Math.min(r.width-16, sr.left+sr.width/2-r.left))+'px'); }
  dd.forEach(function(d){d.addEventListener('toggle',function(){ if(d.open){ dd.forEach(function(o){ if(o!==d) o.open=false; }); place(d); } });});
  addEventListener('resize',function(){ dd.forEach(function(d){ if(d.open) place(d); }); });
  document.addEventListener('click',function(e){ dd.forEach(function(d){ if(d.open && !d.contains(e.target)) d.open=false; }); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') dd.forEach(function(d){ d.open=false; }); });
})();
(function(){
  var root=document.documentElement, btn=document.getElementById('gn-theme');
  var store={get:function(){try{return localStorage.getItem('grotang-theme');}catch(e){return null;}},
             set:function(v){try{localStorage.setItem('grotang-theme',v);}catch(e){}}};
  function apply(t,persist){
    if(t==='dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme');
    if(btn){ btn.setAttribute('aria-pressed', t==='dark');
             btn.querySelector('.gn-theme-t').textContent = t==='dark' ? 'Clair' : 'Sombre'; }
    if(persist) store.set(t);
    /* Les graphiques ne se redessinent que sur un VRAI changement de thème :
       au chargement, le thème est déjà posé avant qu'ils soient dessinés, et
       ce second passage coûtait près d'une demi-seconde sur téléphone. */
    if(persist) document.dispatchEvent(new CustomEvent('grotang:theme',{detail:{theme:t}}));
  }
  apply(store.get()==='dark'?'dark':'light', false);
  if(btn) btn.addEventListener('click', function(){
    apply(root.getAttribute('data-theme')==='dark'?'light':'dark', true); });
})();
/* Ancres (#projection, #jr…, 02/11) : la barre colle en haut et sa hauteur varie
   avec la largeur (46 px, 94 ou 131 au téléphone) ; on la mesure pour que la
   cible tombe juste dessous, avec 12 px d'air. Les pages se dessinent après le
   premier saut vers l'ancre et se décalent : on revise une fois tout chargé. */
(function(){
  var nav=document.querySelector('.gnav'), html=document.documentElement;
  function ajuste(){ if(nav) html.style.scrollPaddingTop=(nav.getBoundingClientRect().height+12)+'px'; }
  ajuste(); window.addEventListener('resize', ajuste);
  function vise(){ var t=location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if(t) t.scrollIntoView({block:'start'}); }
  if(document.readyState==='complete') vise(); else window.addEventListener('load', vise);
})();</script>`;

/* La barre lit les jetons partagés — plus de variante « sombre » à passer à la
   main, plus de palette parallèle qui dérive de celle des pages. */
/* Pied de page commun à toutes les pages (07/11/2026, GT : « aligne sur ce qu'il y a
   de mieux ») : celui de la page UEFA — filet, droits, mention légale. */
export const PIED = `<footer class="pied-site" id="droits"><p class="droits">© ${new Date().getFullYear()} Tanguy Drouin — grotang.fr. Tous droits réservés.</p><p class="legal">Site personnel non professionnel · Hébergeur : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis · +1 877 448 4820</p></footer>`;
export const navCSS = `
.pied-site{margin-top:36px;padding-top:14px;border-top:1px solid var(--rule);font-size:12px;line-height:1.5;color:var(--ink-3);text-align:left;
  font-family:Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif}
footer.pied-site p{margin:0;font-size:inherit;line-height:inherit;max-width:none;color:inherit}
/* surtitre de page, commun (07/11/2026) : le même que la page UEFA (.eyebrow) */
.surtitre{font-family:Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
.surtitre a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
.surtitre a:hover{color:var(--fr)}
/* numéro de bloc, commun (07/11/2026) : le carré noir de la page UEFA */
.no-bloc{display:inline-block;font-family:Carlito,Calibri,system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;line-height:1.35;color:var(--surface);background:var(--ink);border-radius:2px;padding:2px 6px;margin-right:9px;vertical-align:.3em}
footer.pied-site p.droits{color:var(--ink-2)}
footer.pied-site p.legal{margin-top:3px;font-size:11px}
html{scroll-padding-top:58px}
@media (max-width:560px){html{scroll-padding-top:106px}}
.gnav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:18px;
  padding:0 clamp(14px,3vw,28px);height:46px;background:var(--surface);
  border-bottom:1px solid var(--rule);
  font-family:Carlito,Calibri,system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased}
.gnav a{color:inherit;text-decoration:none}
.gnav .gn-mark{font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--ink);
  font-family:'IBM Plex Mono',ui-monospace,monospace;white-space:nowrap;
  display:inline-flex;align-items:center;gap:9px}
/* L'icône du site devant le nom : la même que l'onglet, pour qu'on relie l'un à
   l'autre. 26 px dans un bandeau de 46 : bien visible, sans écraser le texte. */
.gnav .gn-mark svg{width:26px;height:26px;flex:none;display:block}
.gnav .gn-mark span{color:var(--ink-3);font-weight:500}
.gnav nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.gnav nav a{font-size:12.5px;font-weight:600;color:var(--ink-3);
  padding:5px 10px;border-radius:6px;line-height:1.2;white-space:nowrap}
.gnav nav a:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 7%,transparent)}
.gnav nav a[aria-current="page"],.gn-dd summary.gn-ici{color:color-mix(in srgb,var(--fr) 70%,var(--ink));
  background:color-mix(in srgb,var(--fr) 12%,transparent)}
/* menu déroulant d'une rubrique */
.gn-dd{position:relative}
.gn-dd summary{list-style:none;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ink-3);
  padding:5px 10px;border-radius:6px;line-height:1.2;white-space:nowrap;display:flex;align-items:center;gap:6px}
.gn-dd summary::-webkit-details-marker{display:none}
.gn-dd summary::after{content:"";width:5px;height:5px;border:solid currentColor;border-width:0 1.5px 1.5px 0;
  transform:translateY(-2px) rotate(45deg);transition:transform .15s}
.gn-dd[open] summary::after{transform:translateY(1px) rotate(-135deg)}
.gn-dd summary:hover,.gn-dd[open] summary{color:var(--ink);background:color-mix(in srgb,var(--ink) 7%,transparent)}
.gn-dd summary:focus-visible{outline:2px solid var(--fr);outline-offset:2px}
/* Le texte des choix tombe pile sous le texte de la rubrique : décalage du
   panneau = bordure 1 + marge du panneau 6 + marge du lien 12 − marge de la rubrique 10. */
.gn-panel{position:absolute;left:-9px;top:calc(100% + 9px);min-width:210px;width:max-content;max-width:calc(100vw - 16px);z-index:60;display:flex;flex-direction:column;gap:2px;
  padding:6px;background:var(--surface);border:1px solid var(--rule);border-radius:10px;box-shadow:var(--shadow)}
/* la petite pointe qui relie le panneau à sa rubrique ; --cx est posé par le script */
.gn-panel::before{content:"";position:absolute;top:-6px;left:var(--cx,24px);width:10px;height:10px;margin-left:-5px;
  background:var(--surface);border-left:1px solid var(--rule);border-top:1px solid var(--rule);transform:rotate(45deg)}
.gn-panel.gn-flip{left:auto;right:-9px}
.gnav .gn-panel a{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:9px 12px;border-radius:7px;color:var(--ink-2)}
/* une seule colonne d'étiquettes à droite (date, new, bientôt, Preview), le point de
   la page en cours juste après son nom (13/11/2026) */
.gnav .gn-panel .gn-new,.gnav .gn-panel .gn-soon,.gnav .gn-panel .gn-date{margin-left:auto;order:2}
.gnav .gn-panel a[aria-current="page"]::after{order:1;content:"";margin-left:8px;width:6px;height:6px;border-radius:50%;background:var(--fr)}
.gnav .gn-panel a.gn-sub{position:relative;padding-left:30px;font-size:13px}
.gnav .gn-panel a.gn-sub::before{content:"";position:absolute;left:16px;top:6px;height:calc(50% - 6px);width:7px;border-left:1.5px solid var(--rule);border-bottom:1.5px solid var(--rule);border-bottom-left-radius:4px}
.gnav .gn-panel .gn-date{margin-left:auto;font:600 10px "IBM Plex Mono",monospace;letter-spacing:.04em;padding:2px 6px;border-radius:4px;background:var(--fr-soft);color:var(--fr);white-space:nowrap}
.gnav .gn-panel a.gn-sub[aria-current="page"]::after{margin-left:6px}
/* fond : un clic à côté ferme le menu sans rien déclencher dessous (c'est un
   clic sur la rubrique, donc sur le <summary>) ; voilé sur téléphone seulement */
.gn-dd[open] summary::before{content:"";position:fixed;left:0;right:0;bottom:0;top:var(--gn-h,46px);z-index:55;cursor:default}
.gn-avenir{font-size:12.5px;font-weight:600;color:var(--ink-3);padding:5px 10px;line-height:1.2;white-space:nowrap;cursor:default;opacity:.8}
.gn-ligne{display:flex;align-items:center;gap:8px}
.gnav .gn-ligne > a:first-child{flex:1 1 auto}
/* page en cours : toute la ligne est surlignée, pas seulement le nom */
.gnav .gn-panel .gn-ligne:has(> a[aria-current="page"]){border-radius:7px;background:color-mix(in srgb,var(--fr) 12%,transparent)}
.gnav .gn-panel .gn-ligne > a[aria-current="page"]{background:none}
.gnav .gn-panel a.gn-prev,.gnav nav a.gn-prev{flex:none;display:inline-flex;align-items:center;gap:6px;padding:4px 11px 4px 12px;margin-right:12px;border-radius:999px;
  background:var(--ink);color:var(--surface);font-size:12px;font-weight:700;line-height:1.2;box-shadow:var(--shadow);transition:background .15s}
.gnav .gn-panel a.gn-prev span{transition:transform .15s}
.gnav .gn-panel a.gn-prev:hover,.gnav nav a.gn-prev:hover{background:var(--fr);color:var(--surface)}
.gnav .gn-panel a.gn-prev:hover span{transform:translateX(2px)}
.gnav a.gn-prev:focus-visible{outline:2px solid var(--fr);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gnav a.gn-prev,.gnav a.gn-prev span{transition:none}}
.gn-soon{margin-left:7px;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-3);border:1px solid var(--rule);border-radius:4px;padding:1px 4px;vertical-align:1px}
/* « new » : page récente (nouveau: true dans site.mjs, 13/11/2026). Étiquette jaune canari
   de l'icône, légèrement de travers, fixe ; un point jaune sur la rubrique invite à l'ouvrir. */
.gn-new{display:inline-block;margin-left:8px;padding:1px 6px 2px;border-radius:4px;background:#FFD400;color:#0F141D;
  font-family:Newsreader,Georgia,serif;font-style:italic;font-weight:700;font-size:11.5px;line-height:1.2;letter-spacing:.02em;
  transform:rotate(-3deg);box-shadow:1.5px 1.5px 0 #0F141D;vertical-align:1px}
.gn-new::after{content:"✦";margin-left:3px;font-style:normal;font-size:9px;color:#1F5FD1}
.gn-new-pt{display:inline-block;width:7px;height:7px;border-radius:50%;background:#FFD400;box-shadow:0 0 0 1.5px #0F141D;
  margin-left:5px;vertical-align:5px}
:root[data-theme="dark"] .gn-new{box-shadow:1.5px 1.5px 0 #000} :root[data-theme="dark"] .gn-new-pt{box-shadow:0 0 0 1.5px #000}
.gn-grp{display:flex;flex-direction:column;gap:1px;padding-top:4px}
.gn-grp + .gn-grp,.gn-panel > a + .gn-grp{border-top:1px solid var(--rule-soft);margin-top:4px}
.gn-grp-t{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);padding:4px 10px 2px}
.gn-theme{display:inline-flex;align-items:center;gap:7px;cursor:pointer;flex:none;
  appearance:none;border:1px solid var(--rule);background:var(--surface-2);color:var(--ink-3);
  font:inherit;font-size:12px;font-weight:600;border-radius:6px;padding:4px 10px;line-height:1.3}
.gn-coq{display:inline-flex;flex:none;margin-left:-6px}
.gn-coq svg{width:36px;height:36px;display:block;transform:scaleX(-1)}  /* bec tourné vers les onglets */
.gn-theme:hover{border-color:var(--ink-3);color:var(--ink)}
.gn-theme:focus-visible{outline:2px solid var(--fr);outline-offset:2px}
.gn-theme .gn-theme-i{width:11px;height:11px;border-radius:50%;flex:none;
  border:1px solid var(--ink-3);background:linear-gradient(90deg,transparent 50%,var(--ink-3) 50%)}
.gn-theme[aria-pressed="true"] .gn-theme-i{background:var(--fr);border-color:var(--fr)}
@media (max-width:560px){.gnav{height:auto;padding-block:8px;flex-wrap:wrap;gap:8px}
  .gnav nav{margin-left:0;width:100%;justify-content:flex-start;order:3}
  .gn-coq{margin-left:auto}
  .gn-theme{margin-left:0;min-height:34px}
  .gnav nav{gap:2px}
  .gnav nav a,.gn-dd summary,.gn-avenir{padding:9px 9px}
  .gn-avenir .gn-soon{margin-left:5px}
  /* sur téléphone : même règle qu'à l'écran large, un panneau étroit accroché
     à sa rubrique, le texte des choix aligné sur celui de la rubrique
     (1 + 5 + 10 − 9 = 7 px de décalage), des choix assez hauts pour le pouce ;
     le reste de la page est légèrement voilé et un toucher à côté referme */
  .gn-panel{left:-7px;top:calc(100% + 8px);min-width:190px;padding:5px;border-radius:10px}
  .gn-panel.gn-flip{left:auto;right:-7px}
  .gnav .gn-panel a{font-size:15px;padding:11px 10px}
  .gn-dd[open] summary::before{background:rgb(10 13 19 / .2)}}
`;


/* Le coq, dessiné pour le site (pas un logo existant) : queue dressée aux
   trois couleurs, crête rouge. Décoratif, donc caché aux lecteurs d'écran. */
const COQ_SVG = `<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"> <path d="M27 38 C 18 34, 12 22, 16 6 C 19 18, 24 26, 31 31 Z" fill="#d63a3a"/> <path d="M27 40 C 16 38, 8 28, 7 13 C 12 24, 19 31, 30 34 Z" fill="#f4f6f9" stroke="#b9c3d0" stroke-width=".7"/> <path d="M27 42 C 15 43, 6 36, 3 24 C 9 32, 17 37, 29 37 Z" fill="#2a4fa8"/> <path d="M26 36 C 27 29, 33 27, 38 28 C 40 24, 41 18, 42 13 C 43 9, 49 8, 51 12 C 52 15, 50 18, 49 21 C 49 24, 52 28, 52 33 C 52 42, 46 49, 38 50 C 30 51, 25 45, 26 36 Z" fill="#2a4fa8"/> <path d="M41 16 C 46 18, 48 24, 48 29 C 45 27, 42 26, 39 27 C 40 23, 40 19, 41 16 Z" fill="#3d63c4"/> <path d="M29 38 C 33 33, 42 32, 47 37 C 43 38, 41 43, 35 45 C 31 44, 28 42, 29 38 Z" fill="#f4f6f9"/> <path d="M33 41 C 37 39, 41 38, 44 38" stroke="#2a4fa8" stroke-width=".8" fill="none" opacity=".5"/> <path d="M42 11 C 40 6, 44 3, 45 7 C 45 2, 50 2, 49 7 C 51 3, 56 5, 53 10 C 51 12, 46 11, 42 11 Z" fill="#d63a3a"/> <path d="M51 12.5 L 57.5 14.5 L 51 16 Z" fill="#f2b705"/> <path d="M50 17 C 52.5 18, 52.5 22.5, 50 23.5 C 48 22.5, 48 19, 50 17 Z" fill="#d63a3a"/> <circle cx="47.6" cy="12.6" r="1.3" fill="#fff"/><circle cx="47.9" cy="12.6" r=".65" fill="#111"/> <path d="M36 50 L 35.5 57 L 32 59.5 M 35.5 57 L 38.5 59.5 M43 48.5 L 44 56.5 L 41 59.5 M 44 56.5 L 47.5 58.5" stroke="#f2b705" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/> </svg>`;

/* Le menu est tiré du registre (tools/site.mjs) : une rubrique d'une seule page
   est un lien direct, une rubrique de plusieurs pages un menu déroulant. Le
   déroulant est un <details> : il s'ouvre au clic ou au toucher, sans script ;
   le petit script de THEME_JS ne fait que refermer les autres et fermer au clic
   ailleurs ou sur Échap. */
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/* Page annoncée : « bientôt » ; si un aperçu existe déjà, le bouton noir
   « Preview » de la page d'attente, qui mène droit à l'aperçu (13/11/2026). */
const lien = (p, current, label = p.titre) => {
  const a = `<a href="${p.url}"${p.key === current ? ' aria-current="page"' : ''}>${esc(label)}${p.aVenir && !p.aVenir.apercu ? '<span class="gn-soon">bientôt</span>' : ''}${estNouveau(p) ? `<span class="gn-new" data-fin="${finNouveau(p)}">new</span>` : ''}</a>`;
  return p.aVenir?.apercu ? `<span class="gn-ligne">${a}<a class="gn-prev" href="${p.aVenir.apercu}">Preview<span aria-hidden="true">→</span></a></span>` : a;
};
const toutes = r => r.pages.concat(...r.sous.map(toutes));
function rubrique(r, current) {
  const pp = toutes(r);
  if (pp.length === 1) return lien(pp[0], current, r.nom).replace('<a ', `<a title="${esc(pp[0].titre)}" `);
  const ici = pp.some(p => p.key === current) || (current === 'gazette' && pp.some(p => p.key === 'uefa'));
  const groupe = (s, niv) => `<div class="gn-grp"><span class="gn-grp-t">${esc(s.nom)}</span>`
    + s.pages.map(p => lien(p, current)).join('') + s.sous.map(x => groupe(x, niv + 1)).join('') + '</div>';
  return `<details class="gn-dd"><summary${ici ? ' class="gn-ici"' : ''}>${esc(r.nom)}${pp.some(p => estNouveau(p)) ? `<i class="gn-new-pt" aria-hidden="true" data-fin="${pp.filter(p => estNouveau(p)).map(finNouveau).sort().pop()}"></i>` : ''}</summary><div class="gn-panel">`
    + r.pages.map(p => lien(p, current) + (p.key === 'uefa' ? sousGazette(current) : '')).join('') + r.sous.map(s => groupe(s, 1)).join('') + '</div></details>';
}

export function nav(current) {
  const links = arbre().map(r => rubrique(r, current)).join('')
    + RUBRIQUES_A_VENIR.map(n => `<span class="gn-avenir" title="${esc(n)} : bientôt">${esc(n)}<span class="gn-soon">bientôt</span></span>`).join('');
  /* Le logo menait a une page d'accueil qui n'existe plus : le site, c'est le
     coefficient UEFA. Il y mene donc directement, sans passer par une redirection. */
  /* data-nosnippet : Google n'a pas le droit de piocher dans ce bandeau pour
     construire l'extrait sous le titre. Sans lui, une recherche contenant
     « grotang » donnait « GROTANG.FR Coefficient UEFAFrançais en Grand Chelem
     Sombre » — le logo, les onglets collés et le libellé du bouton de thème. */
  const icone = FAVICON_SVG.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
  return `<div class="gnav" data-nosnippet><a class="gn-mark" href="${url('uefa')}">${icone}<b style="font-weight:inherit">GROTANG<span>.FR</span></b></a>`
    + `<nav>${links}</nav>`
    + `<span class="gn-coq">${COQ_SVG}</span>`
    + `<button type="button" class="gn-theme" id="gn-theme" aria-pressed="false" title="Basculer clair / sombre">`
    + `<span class="gn-theme-i" aria-hidden="true"></span><span class="gn-theme-t">Sombre</span></button></div>`;
}

/* L'icône. Elle était incrustée dans chaque page en data:URI, mais l'attribut
   href s'arrêtait au premier guillemet du SVG (xmlns="…") : l'icône était
   cassée, et les navigateurs comme Google affichaient le globe par défaut.
   C'est désormais un vrai fichier, /favicon.svg, écrit par le build : c'est
   aussi la seule forme que Google accepte pour l'icône de ses résultats.
   Le dessin : « gt. » noir sur jaune canari (#FFD400, liseré #E5BC00 pour
   ne pas se dissoudre sur un onglet blanc), le point en bleu France. Le bloc
   de lettres est centré et le point posé sur la ligne de base. */
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x=".5" y=".5" width="31" height="31" rx="7" fill="#FFD400" stroke="#E5BC00"/><g transform="translate(0 .6)"><g fill="none" stroke="#0F141D" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.6" cy="13.4" r="3.9"/><path d="M13.5 9.4 V20.3 a3.9 3.9 0 0 1 -3.9 3.9 H7.2"/><path d="M19.2 6.6 V15 a2.6 2.6 0 0 0 2.6 2.6 H22.6"/><path d="M16.6 10.2 H22.4"/></g><circle cx="26.4" cy="16.65" r="2.4" fill="#1F5FD1"/></g></svg>`;
/* Le jeu complet, chacun pour son public :
   - favicon.ico (16, 32, 48 px) : l'adresse que tout le monde essaie en premier, Google
     compris, qui demande un carré multiple de 48 px ;
   - favicon-96x96.png : la version nette pour Google et les écrans haute définition ;
   - favicon.svg : la version vectorielle, parfaite à toutes les tailles, pour les
     navigateurs qui la lisent ;
   - apple-touch-icon.png (180 px, fond plein) : l'icône d'un raccourci sur iPhone ;
   - site.webmanifest (192 et 512 px) : l'icône d'un raccourci sur Android.
   Les images sont tirées du SVG (tools/icons/), une seule source de dessin. */
export const FAVICON = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
export const MANIFEST = JSON.stringify({ name: "grotang.fr — l'observatoire du coefficient UEFA", short_name: 'grotang.fr',
  start_url: url('uefa'), display: 'browser', background_color: '#FFD400', theme_color: '#FFD400',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2);
