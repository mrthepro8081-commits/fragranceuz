'use client';
import '../boutique/fonts';
import './admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, LockKeyhole, Moon, RefreshCw, Search, Send, Sun } from 'lucide-react';
import type { CustomerRecord, Product, StoreStats } from '../../lib/types';
import { defaultSettings, type StoreSettings } from '../../lib/settings';
import { errorText, formatMoney, formatBottle } from '../../lib/i18n';
import { useLanguage, LanguageSwitch } from '../language';
import { BottleMark, Shot } from '../boutique/ui';
import { tints, toneOf } from '../boutique/tone';
import { cheapest, displayName } from '../boutique/format';
import { ConfirmSheet, type AdminChange } from './confirm';
import { LinkImport, ProductEditor, blankProduct } from './editor';
import { CustomersPanel, OrdersPanel, SettingsPanel, type Order } from './panels';
import { StatsPanel } from './stats';
import { SheetsCard } from './sheets';

type Role = 'owner' | 'admin' | 'demo';
type Editing = { product: Product; before: Product | null; warnings: string[] };
type Tab = 'products' | 'orders' | 'stats' | 'customers' | 'settings';
const PAGE = 40;

function telegram() {
  return typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;
}

export default function Admin({ demo = false }: { demo?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statistics, setStatistics] = useState<StoreStats | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [sheets, setSheets] = useState<{ connected: boolean; hint: string | null; doc?: string | null }>({ connected: false, hint: null });
  const [tab, setTab] = useState<Tab>('products');
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmation, setConfirmation] = useState<{ change: AdminChange; done?: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'x-telegram-init-data': telegram()?.initData || '' }),
    [],
  );

  async function connect(openTarget = false) {
    setChecking(true);
    setError('');
    try {
      const r = await fetch(demo ? '/api/demo?management=1' : '/api/admin', { headers: headers(), signal: AbortSignal.timeout(15000) });
      if (r.status === 401) {
        setRole(null);
        return;
      }
      const d = (await r.json()) as {
        error?: string; role: Role; products: Product[]; orders: Order[]; statistics: StoreStats; customers: CustomerRecord[]; settings: StoreSettings; sheets?: { connected: boolean; hint: string | null; doc?: string | null };
      };
      if (!r.ok) throw new Error(d.error);
      setRole(d.role);
      setProducts(d.products);
      setOrders(d.orders);
      setStatistics(d.statistics);
      setCustomers(d.customers);
      setSettings(d.settings);
      setSheets(d.sheets || { connected: false, hint: null });
      if (openTarget) {
        const wanted = new URLSearchParams(location.search).get('tab');
        if (wanted === 'orders' || wanted === 'stats' || wanted === 'customers' || wanted === 'settings') setTab(wanted);
        const target = d.products.find((p) => p.id === new URLSearchParams(location.search).get('product'));
        if (target) setEditing({ product: target, before: target, warnings: [] });
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not connect');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const w = telegram();
    w?.ready();
    w?.expand?.();
    document.documentElement.classList.add('boutique');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- theme lives on <html>, set by the layout script
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    connect(true);
    return () => document.documentElement.classList.remove('boutique');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      telegram()?.setHeaderColor?.('#4f0f15');
      telegram()?.setBackgroundColor?.(theme === 'dark' ? '#140c0c' : '#f6efe4');
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    document.documentElement.classList.toggle('b-locked', Boolean(editing || confirmation));
  }, [editing, confirmation]);
  useEffect(() => {
    const w = telegram();
    if (!w?.initData || !w.BackButton) return;
    const back = () => {
      if (busy) return;
      if (confirmation) setConfirmation(null);
      else if (editing) setEditing(null);
      else location.href = demo ? '/?demo=1' : '/';
    };
    w.BackButton.show();
    w.BackButton.onClick(back);
    return () => w.BackButton?.offClick(back);
  }, [confirmation, editing, busy, demo]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('fragranceuz-theme', next); } catch {}
  }

  /* Every write goes through the confirmation sheet first; only "Confirm" sends it to the server. */
  function ask(change: AdminChange, done?: () => void) {
    setError('');
    setConfirmation({ change, done });
  }
  async function commit() {
    if (!confirmation || busy) return;
    const { change, done } = confirmation;
    setBusy(true);
    try {
      const payload =
        change.action === 'save' ? { action: 'save', product: change.product, imageUpload: change.imageUpload }
        : change.action === 'delete' ? { action: 'delete', id: change.id }
        : change.action === 'settings' ? { action: 'settings', settings: change.settings }
        : change.action === 'order-status' ? { action: 'order-status', id: change.id, status: change.status }
        : change.action === 'sheets-save' ? { action: 'sheets-save', link: change.link }
        : change.action === 'sheets-sync' ? { action: 'sheets-sync' }
        : { action: 'retry-notification', id: change.id };
      const r = await fetch(demo ? '/api/demo' : '/api/admin', {
        method: 'POST', headers: headers(), body: JSON.stringify({ ...payload, confirmed: true }), signal: AbortSignal.timeout(30000),
      });
      const d = (await r.json()) as { error?: string; sent?: number };
      if (!r.ok) {
        if (r.status === 401) setRole(null);
        throw new Error(d.error);
      }
      setConfirmation(null);
      done?.();
      setToast(
        change.action === 'delete' ? 'Fragrance deleted.'
          : change.action === 'save' && !change.before ? 'Published. It is now in the storefront.'
          : change.action === 'save' ? 'Product saved. The storefront now uses these details.'
          : change.action === 'sheets-save' ? (change.link ? 'Google Sheet connected.' : 'Google Sheet disconnected.')
          : change.action === 'sheets-sync' ? `${t('Uploaded to the sheet')}: ${d.sent ?? 0}`
          : 'Changes saved.',
      );
      try { telegram()?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
      await connect();
    } catch (e) {
      setConfirmation(null);
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadCustomers() {
    if (exporting || demo) return;
    setExporting(true);
    try {
      const r = await fetch('/api/admin/report?lang=' + lang, { headers: headers(), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fragranceuz-customers-' + new Date().toISOString().slice(0, 10) + '-' + lang + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Could not export customers. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function switchTab(next: Tab) {
    if (tab === 'settings' && settingsDirty && next !== 'settings') return setToast('Save or cancel your changes first.');
    setTab(next);
    setError('');
    window.scrollTo({ top: 0 });
  }

  const counts = useMemo(() => ({ visible: products.filter((p) => p.active).length, hidden: products.filter((p) => !p.active).length }), [products]);
  const q = query.trim().toLowerCase();
  const list = products.filter(
    (p) => (visibility === 'all' || p.active === (visibility === 'visible')) && (!q || `${p.name} ${p.brand} ${p.id}`.toLowerCase().includes(q)),
  );
  const newOrders = orders.filter((o) => o.status === 'new').length;

  return (
    <div className="bq ba">
      <header className="ba-header">
        <div className="ba-topbar">
          <a href={demo ? '/?demo=1' : '/'} className="ba-logo" aria-label={t('Back to store')}>
            <img src="/brand/fragranceuz-gold.svg" alt="FRAGRANCE UZ" width="70" height="55" />
          </a>
          <div className="b-top-actions">
            <button className="b-round" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'Use light mode' : 'Use dark mode')}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <LanguageSwitch lang={lang} setLang={setLang} />
          </div>
        </div>
        <h1>{t('Store management')}</h1>
        <div className="ba-header-meta">
          {role && (
            <span className="ba-role">
              <Check size={14} />
              {t(role === 'demo' ? 'Demo administrator' : role === 'owner' ? 'Store owner' : 'Store administrator')}
            </span>
          )}
          <a href={demo ? '/?demo=1' : '/'} className="ba-back">
            {t('Back to store')}
            <ArrowUpRight size={15} />
          </a>
        </div>
      </header>

      {checking && !role ? (
        <div className="ba-loading">
          <BottleMark className="b-empty-mark" />
        </div>
      ) : !role ? (
        <div className="b-empty ba-locked">
          <LockKeyhole size={40} strokeWidth={1.3} />
          <h2>{t('Access for owner and admins only')}</h2>
          <p>{t('Open the store through its Telegram bot using an authorized account.')}</p>
          <a className="b-btn" href="https://t.me/fragranceuz_bot?startapp" target="_blank" rel="noreferrer">
            <Send size={17} />
            {t('Open in Telegram')}
          </a>
          <button className="b-text-btn" onClick={() => connect()}>
            <RefreshCw size={15} />
            {t('Check access again')}
          </button>
          {error && <p className="b-error">{errorText(error, lang)}</p>}
        </div>
      ) : (
        <>
          <nav className="ba-tabs" aria-label={t('Store management')}>
            {(
              [
                ['products', 'Products', products.length],
                ['orders', 'Orders', newOrders || null],
                ['stats', 'Statistics', null],
                ['customers', 'Customers', customers.length || null],
                ['settings', 'Store settings', null],
              ] as [Tab, string, number | null][]
            ).map(([id, label, count]) => (
              <button key={id} className={tab === id ? 'on' : ''} onClick={() => switchTab(id)} aria-current={tab === id ? 'page' : undefined}>
                {t(label)}
                {count !== null && <small className={id === 'orders' ? 'hot' : ''}>{count}</small>}
              </button>
            ))}
          </nav>

          {demo && <p className="ba-demo-note">{t('Confirmed product and shop changes are saved in this demo. Real orders and customer records are kept separate.')}</p>}
          {error && <p className="b-error ba-error">{errorText(error, lang)}</p>}

          {tab === 'products' && (
            <section className="ba-panel">
              <LinkImport
                demo={demo}
                headers={headers}
                onImported={(product, warnings) => setEditing({ product, before: products.find((p) => p.id === product.id) || null, warnings })}
                onManual={() => setEditing({ product: blankProduct(), before: null, warnings: [] })}
              />
              <div className="ba-list-head">
                <h2>{t('Catalog')}</h2>
                <span className="b-count">{list.length}</span>
              </div>
              <label className="b-search small">
                <Search size={17} />
                <input id="product-search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder={t('Find a fragrance…')} aria-label={t('Find a fragrance')} />
              </label>
              <div className="b-pills ba-scroll-pills">
                {([['all', 'All products', products.length], ['visible', 'Shown', counts.visible], ['hidden', 'Hidden', counts.hidden]] as const).map(([id, label, n]) => (
                  <button key={id} className={visibility === id ? 'on' : ''} onClick={() => { setVisibility(id); setShown(PAGE); }}>
                    {t(label)} <small>{n}</small>
                  </button>
                ))}
              </div>
              <div className="ba-products">
                {list.slice(0, shown).map((p) => {
                  const v = p.variants[cheapest(p)];
                  return (
                    <button
                      key={p.id}
                      className={'ba-product ' + (p.active ? '' : 'hidden')}
                      style={{ '--niche': tints(toneOf(p.id, {}).tone).niche, '--niche-dark': tints(toneOf(p.id, {}).tone).nicheDark } as React.CSSProperties}
                      onClick={() => setEditing({ product: p, before: p, warnings: [] })}
                    >
                      <span className="ba-orb">
                        <Shot p={p} />
                      </span>
                      <span className="ba-product-copy">
                        <span className="b-house">{p.brand || '—'}</span>
                        <strong>{displayName(p.name)}</strong>
                        <small>
                          {p.variants.length > 1 ? `${p.variants.length} × ` : ''}
                          {formatBottle(v.label, lang)} · {formatMoney(v.price, lang)}
                        </small>
                      </span>
                      {!p.active && <span className="ba-chip">{t('Hidden')}</span>}
                      <ChevronRight size={18} className="ba-chevron" />
                    </button>
                  );
                })}
              </div>
              {list.length > shown && (
                <button className="b-btn ghost ba-more" onClick={() => setShown((n) => n + PAGE)}>
                  {t('Show more fragrances')}
                </button>
              )}
              {!list.length && <div className="b-empty"><p>{t('No fragrances found.')}</p></div>}
            </section>
          )}

          {tab === 'orders' && (
            <OrdersPanel
              orders={orders}
              total={statistics?.totalOrders ?? orders.length}
              busy={busy}
              changeStatus={(o, status) => ask({ action: 'order-status', id: o.id, status, from: o.status, customer: o.data.customer.name })}
              retry={(o) => ask({ action: 'retry-notification', id: o.id })}
            />
          )}
          {tab === 'stats' && <StatsPanel demo={demo} headers={headers} products={products} ordersTotal={statistics?.totalOrders ?? 0} />}
          {tab === 'customers' && <CustomersPanel customers={customers} demo={demo} download={downloadCustomers} exporting={exporting} />}
          {tab === 'settings' && (
            <SheetsCard demo={demo} busy={busy} sheets={sheets} ask={ask} orders={statistics?.totalOrders ?? 0} />
          )}
          {tab === 'settings' && (
            <SettingsPanel settings={settings} busy={busy} onDirtyChange={setSettingsDirty} save={(next) => ask({ action: 'settings', settings: next, before: settings })} />
          )}
        </>
      )}

      {editing && (
        <ProductEditor
          key={editing.product.id + (editing.before ? ':edit' : ':new') + editing.product.importedAt}
          initial={editing.product}
          before={editing.before}
          warnings={editing.warnings}
          exists={!editing.before && products.some((p) => p.id === editing.product.id)}
          demo={demo}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(product, upload) => ask({ action: 'save', product, before: editing.before, imageUpload: upload }, () => setEditing(null))}
          onDelete={(product) => ask({ action: 'delete', id: product.id, product }, () => setEditing(null))}
        />
      )}
      {confirmation && <ConfirmSheet change={confirmation.change} busy={busy} confirm={commit} cancel={() => !busy && setConfirmation(null)} />}
      {toast && (
        <div className="b-toast" role="status">
          <Check size={16} />
          {t(toast)}
        </div>
      )}
    </div>
  );
}
