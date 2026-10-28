// Standalone preview of the storefront (no server): the catalog comes from catalog.json
// published next to the page, and checkout runs in demo mode.
import { createRoot } from 'react-dom/client';
import '../app/globals.css';
import { LanguageProvider } from '../app/language';
import Storefront from '../app/storefront';
import { defaultSettings } from '../lib/settings';

const catalog = fetch('./catalog.json').then((r) => r.json());
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/api\/(store|demo)/.test(url)) {
    const products = await catalog;
    return new Response(
      JSON.stringify({ products, settings: defaultSettings, checkoutReady: false, viewerRole: null, demo: true, demoAvailable: false }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
  return realFetch(input, init);
};
// The preview frame blocks window.open; real links still open in a new tab.
window.open = (url?: string | URL) => {
  const a = document.createElement('a');
  a.href = String(url);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
};

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Storefront />
  </LanguageProvider>,
);
