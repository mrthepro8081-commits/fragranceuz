// Inlines the built JS and CSS into one HTML file, keeping only Latin and Cyrillic font faces.
import fs from 'node:fs';
const dir = new URL('../dist-preview/', import.meta.url);
let html = fs.readFileSync(new URL('index.html', dir), 'utf8');
// The logo is referenced by absolute path in the app; inline it so the page needs no other files.
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(new URL('../public/brand/fragranceuz-gold.svg', import.meta.url)).toString('base64');
const withLogo = (text) => text.split('/brand/fragranceuz-gold.svg').join(logo);
const asset = (p) => withLogo(fs.readFileSync(new URL(p.replace(/^\.?\//, ''), dir), 'utf8'));
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = asset(href).replace(/@font-face\{[^}]*\}/g, (face) =>
    /U\+\?\?,|U\+301,U\+400-45F|U\+460-52F|U\+100-2BA/.test(face) ? face : '');
  return `<style>${css}</style>`;
});
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) =>
  `<script type="module">${asset(src).replace(/<\/script/g, '<\\/script')}</script>`);
fs.writeFileSync(new URL('page.html', dir), html);
console.log('page.html', (html.length / 1024).toFixed(0), 'KB');
// The publishing skeleton supplies <html>/<head>/<body>; keep only their contents.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const fragment = head.replace('<title>', '<meta name="claude:viewport-fit-sides" content="cover">\n<title>') + body;
fs.writeFileSync(new URL('fragranceuz-boutique.html', dir), fragment);
