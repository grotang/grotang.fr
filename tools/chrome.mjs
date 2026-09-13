/* Chrome partagé du site : jeu de couleurs, barre de navigation, pied de page.
   Volontairement autonome — le CSS de la barre ne dépend d'aucun token de la page
   qui l'accueille, pour qu'on puisse l'injecter dans n'importe quelle page,
   y compris la page tennis qui a sa propre palette sombre. */

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..112,400..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">`;

/* Barre de navigation. `dark` force la variante sombre (page tennis). */
export const navCSS = `
.gnav{--gn-bg:#FBFCFE;--gn-ink:#0F141D;--gn-ink2:#78828F;--gn-rule:#D4DAE3;--gn-hi:#2a78d6;
  position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:18px;
  padding:0 clamp(14px,3vw,28px);height:46px;background:var(--gn-bg);
  border-bottom:1px solid var(--gn-rule);
  font-family:Archivo,system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased}
@media (prefers-color-scheme:dark){.gnav:not(.gnav--light){--gn-bg:#141A24;--gn-ink:#E8ECF3;--gn-ink2:#727D8C;--gn-rule:#28313F;--gn-hi:#5D9BF0}}
.gnav.gnav--dark{--gn-bg:#181826;--gn-ink:#e0e0e0;--gn-ink2:#6b6b80;--gn-rule:#2a2a3a;--gn-hi:#69f0ae}
.gnav a{color:inherit;text-decoration:none}
.gnav .gn-mark{font-size:13px;font-weight:800;letter-spacing:.06em;color:var(--gn-ink);
  font-family:'IBM Plex Mono',ui-monospace,monospace;white-space:nowrap}
.gnav .gn-mark span{color:var(--gn-ink2);font-weight:500}
.gnav nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.gnav nav a{font-size:12.5px;font-weight:600;color:var(--gn-ink2);
  padding:5px 10px;border-radius:6px;line-height:1.2;white-space:nowrap}
.gnav nav a:hover{color:var(--gn-ink);background:color-mix(in srgb,var(--gn-ink) 7%,transparent)}
.gnav nav a[aria-current="page"]{color:var(--gn-hi);
  background:color-mix(in srgb,var(--gn-hi) 12%,transparent)}
@media (max-width:520px){.gnav{height:auto;padding-block:8px;flex-wrap:wrap;gap:8px}
  .gnav nav{margin-left:0;width:100%;justify-content:flex-start}}
`;

export const PAGES = [
  { href: '/uefa/',   label: 'Coefficient UEFA', key: 'uefa' },
  { href: '/tennis/', label: 'Français en Grand Chelem', key: 'tennis' },
];

export function nav(current, variant = '') {
  const cls = 'gnav' + (variant ? ' gnav--' + variant : '');
  const links = PAGES.map(p =>
    `<a href="${p.href}"${p.key === current ? ' aria-current="page"' : ''}>${p.label}</a>`).join('');
  return `<div class="${cls}"><a class="gn-mark" href="/">GROTANG<span>.FR</span></a><nav>${links}</nav></div>`;
}

/* L'icône est incrustée dans chaque page plutôt que servie comme fichier : elle
   pèse 367 octets, et un fichier .svg qui transite par le pont vers le PC se voit
   greffer un manifeste de provenance C2PA qui le fait grossir à 8 Ko. */
export const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" rx="7" fill="%230F141D"/%3E%3Cpath d="M6 22V10h4.4c2.9 0 4.6 1.5 4.6 4 0 1.8-.9 3-2.5 3.6L15.4 22h-3l-2.3-4h-1.2v4H6zm2.9-6.3h1.3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6H8.9v3.2z" fill="%23FBFCFE"/%3E%3Ccircle cx="22.5" cy="19" r="4.2" fill="none" stroke="%235D9BF0" stroke-width="2"/%3E%3C/svg%3E">`;
