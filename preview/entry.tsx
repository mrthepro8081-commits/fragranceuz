// Standalone preview of the storefront and admin (no server).
// The catalog comes from catalog.json published next to the page; admin changes are kept in this
// browser's storage, and "add by link" reads posts from that saved copy of the channel.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '../app/globals.css';
import { LanguageProvider } from '../app/language';
import Storefront from '../app/storefront';
import Admin from '../app/admin/page';
import { defaultSettings, type StoreSettings } from '../lib/settings';
import type { Product } from '../lib/types';

type Local = { overrides: Record<string, Product>; removed: string[]; settings: StoreSettings | null };
const KEY = 'fragranceuz-preview-admin';
const load = (): Local => {
  try {
    return { overrides: {}, removed: [], settings: null, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { overrides: {}, removed: [], settings: null };
  }
};
const store = (next: Local) => {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
};
const snapshot: Promise<Product[]> = fetch('./catalog.json').then((r) => r.json());
// The three newest posts start outside the catalog, so "add by link" can be tried with real posts.
const arrivals = snapshot.then((list) => new Set([...list].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 3).map((p) => p.id)));
async function catalog(includeHidden: boolean) {
  const local = load();
  const waiting = await arrivals;
  const map = new Map((await snapshot).filter((p) => !waiting.has(p.id)).map((p) => [p.id, p]));
  for (const [id, p] of Object.entries(local.overrides)) map.set(id, p);
  return [...map.values()]
    .filter((p) => !local.removed.includes(p.id) && (includeHidden || p.active))
    .sort((a, b) => Number(b.id) - Number(a.id));
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  const path = url.pathname;
  if (!/\/api\//.test(path)) return realFetch(input, init);
  const local = load();
  const settings = local.settings || defaultSettings;
  if (/\/api\/demo\/import$/.test(path)) {
    const { url: link } = JSON.parse(String(init?.body || '{}'));
    const id = /^https:\/\/t\.me\/(?:s\/)?fragranceuz\/(\d+)\/?(?:\?.*)?$/.exec(String(link).trim())?.[1];
    if (!id) return json({ error: 'INVALID_POST_URL' }, 400);
    const product = (await snapshot).find((p) => p.id === id);
    if (!product) return json({ error: 'POST_NOT_FOUND' }, 400);
    await new Promise((r) => setTimeout(r, 700));
    return json({ product: { ...product, importedAt: new Date().toISOString().slice(0, 10) }, warnings: [] });
  }
  if (/\/api\/(demo|store)$/.test(path) && (init?.method || 'GET') === 'POST') {
    const input = JSON.parse(String(init?.body || '{}'));
    if (input.confirmed !== true) return json({ error: 'Please confirm your changes before saving.' }, 400);
    if (input.action === 'save') {
      const product: Product = { ...input.product, image: input.imageUpload || input.product.image };
      local.overrides[product.id] = product;
      local.removed = local.removed.filter((id) => id !== product.id);
    } else if (input.action === 'delete') {
      delete local.overrides[input.id];
      local.removed = [...new Set([...local.removed, input.id])];
    } else if (input.action === 'settings') {
      local.settings = input.settings;
    } else return json({ error: 'This action is unavailable in the demo.' }, 400);
    store(local);
    return json({ ok: true });
  }
  if (/\/api\/(demo|store)$/.test(path)) {
    const management = url.searchParams.get('management') === '1';
    return json({
      products: await catalog(management), settings, checkoutReady: false, viewerRole: 'demo', role: 'demo', demo: true, demoAvailable: false,
      orders: [], customers: [], statistics: { totalOrders: 0, newOrders: 0, confirmedOrders: 0, completedOrders: 0, cancelledOrders: 0, requestValue: 0, completedValue: 0, customers: 0 },
    });
  }
  return json({ error: 'Not found' }, 404);
};

// The preview frame blocks window.open; real links still open in a new tab.
window.open = (target?: string | URL) => {
  const a = document.createElement('a');
  a.href = String(target);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
};
// Links between the shop and the admin switch views inside the page.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest?.('a');
  const href = a?.getAttribute('href') || '';
  if (!a || !/^\/(\?demo=1)?$|^\/demo|^\/admin/.test(href)) return;
  e.preventDefault();
  location.hash = href.startsWith('/demo') || href.startsWith('/admin') ? 'admin' : '';
  window.scrollTo(0, 0);
}, true);

function App() {
  const [admin, setAdmin] = useState(location.hash === '#admin');
  useEffect(() => {
    const sync = () => setAdmin(location.hash === '#admin');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return admin ? <Admin demo key="admin" /> : <Storefront key="shop" />;
}

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
