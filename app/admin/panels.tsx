'use client';
import { useEffect, useState } from 'react';
import { Download, Loader2, MessageCircle, Phone, RefreshCw, Search } from 'lucide-react';
import type { CustomerRecord, OrderData } from '../../lib/types';
import { settingsInput, type StoreSettings } from '../../lib/settings';
import { formatBottle, formatDate, formatMoney } from '../../lib/i18n';
import { useLanguage } from '../language';

export type Order = { id: string; data: OrderData; total: number; status: string; notification: string; created_at: string };
const STATUSES = ['new', 'confirmed', 'completed', 'cancelled'] as const;

export function OrdersPanel({ orders, total, busy, changeStatus, retry }: {
  orders: Order[];
  total: number;
  busy: boolean;
  changeStatus: (order: Order, status: string) => void;
  retry: (order: Order) => void;
}) {
  const { t, lang } = useLanguage();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = orders.filter(
    (o) => (status === 'all' || o.status === status) && `${o.id} ${o.data.customer.name} ${o.data.customer.phone} ${o.data.customer.address}`.toLowerCase().includes(q),
  );
  return (
    <section className="ba-panel">
      {total > 100 && <p className="b-fine">{t('Latest 100 requests')}</p>}
      <label className="b-search small">
        <Search size={17} />
        <input id="order-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Name, phone or order reference')} aria-label={t('Search orders')} />
      </label>
      <div className="b-pills ba-scroll-pills">
        {['all', ...STATUSES].map((s) => (
          <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
            {t(s === 'all' ? 'All statuses' : 'status.' + s)} <small>{s === 'all' ? orders.length : orders.filter((o) => o.status === s).length}</small>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="b-empty">
          <h2>{t('All quiet, for now.')}</h2>
          <p>{t('New order requests will appear here.')}</p>
        </div>
      ) : (
        <div className="ba-orders">
          {list.map((o) => (
            <article key={o.id} className={'ba-order status-' + o.status}>
              <header>
                <span className="b-eyebrow">#{o.id.slice(0, 8)} · {formatDate(o.created_at, lang, true)}</span>
                <span className={'ba-chip status-' + o.status}>{t('status.' + o.status)}</span>
              </header>
              <h3>{o.data.customer.name}</h3>
              <div className="ba-order-contacts">
                <a href={'tel:' + o.data.customer.phone}>
                  <Phone size={15} />
                  {o.data.customer.phone}
                </a>
                {o.data.telegram?.username && (
                  <a href={'https://t.me/' + o.data.telegram.username} target="_blank" rel="noreferrer">
                    <MessageCircle size={15} />@{o.data.telegram.username}
                  </a>
                )}
              </div>
              <p className="ba-order-address">{o.data.customer.address}</p>
              <ul>
                {o.data.items.map((item, i) => (
                  <li key={i}>
                    <span>
                      {item.brand} · {item.name}
                      <small>
                        {formatBottle(item.label, lang)} × {item.quantity}
                      </small>
                    </span>
                    <strong>{formatMoney(item.price * item.quantity, lang)}</strong>
                  </li>
                ))}
              </ul>
              <div className="ba-order-total">
                <span>{t('Product subtotal')}</span>
                <strong>{formatMoney(o.total, lang)}</strong>
              </div>
              {o.data.customer.note && (
                <p className="ba-order-note">
                  {t('Note')}: {o.data.customer.note}
                </p>
              )}
              <div className="ba-status-row" role="group" aria-label={t('Order status')}>
                {STATUSES.map((s) => (
                  <button key={s} disabled={busy || s === o.status} className={s === o.status ? 'on status-' + s : ''} onClick={() => changeStatus(o, s)}>
                    {t('status.' + s)}
                  </button>
                ))}
              </div>
              <footer>
                <small>
                  {t('Telegram alert')}: {t('notification.' + o.notification)}
                </small>
                {o.notification === 'failed' && (
                  <button className="b-text-btn" disabled={busy} onClick={() => retry(o)}>
                    <RefreshCw size={14} />
                    {t('Retry Telegram alert')}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CustomersPanel({ customers, demo, download, exporting }: { customers: CustomerRecord[]; demo: boolean; download: () => void; exporting: boolean }) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  if (demo)
    return (
      <section className="ba-panel">
        <div className="b-empty">
          <h2>{t('Customer database')}</h2>
          <p>{t('Real customer data and PDF reports are available only to verified store staff.')}</p>
        </div>
      </section>
    );
  const q = search.trim().toLocaleLowerCase();
  const list = customers.filter((c) => `${c.name} ${c.phone} ${c.address} ${c.key}`.toLocaleLowerCase().includes(q));
  return (
    <section className="ba-panel">
      <button className="ba-pdf" onClick={download} disabled={exporting}>
        {exporting ? <Loader2 className="b-spin" size={18} /> : <Download size={18} />}
        <span>
          <strong>{t(exporting ? 'Preparing PDF…' : 'Download customer PDF')}</strong>
          <small>{t('Customers appear after an order request is submitted. The PDF includes names, phones, addresses and order history totals.')}</small>
        </span>
      </button>
      <label className="b-search small">
        <Search size={17} />
        <input id="customer-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Find a customer')} aria-label={t('Find a customer')} />
      </label>
      {list.length ? (
        <div className="ba-customers">
          {list.map((c) => (
            <article key={c.key}>
              <span className="ba-avatar">{c.name.trim().slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>{c.name}</h3>
                <a href={'tel:' + c.phone}>{c.phone}</a>
                <p>{c.address}</p>
                <small>
                  {t('Order requests')}: <strong>{c.orders}</strong> · {formatMoney(c.requestValue, lang)} · {t('Last request')}: {formatDate(c.lastOrderAt, lang)}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="b-empty">
          <p>{t(customers.length ? 'No matching customers.' : 'No customers yet.')}</p>
        </div>
      )}
    </section>
  );
}

const SETTING_FIELDS = [
  ['phone', 'Store phone'],
  ['managerUrl', 'Manager Telegram link'],
  ['channelUrl', 'Telegram channel link'],
  ['decantsUrl', 'Decants channel link'],
  ['instagramUrl', 'Instagram profile link'],
  ['reviewsUrl', 'Customer reviews link'],
] as const;

export function SettingsPanel({ settings, busy, save, onDirtyChange }: {
  settings: StoreSettings;
  busy: boolean;
  save: (next: StoreSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState('');
  const [synced, setSynced] = useState(settings);
  if (synced !== settings) {
    // The saved settings changed on the server (after a confirmed save): start from them again.
    setSynced(settings);
    setDraft(settings);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return (
    <form
      className="ba-panel"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        const parsed = settingsInput.safeParse(draft);
        if (!parsed.success) return setError('Use a full international phone number and valid Telegram or Instagram profile links.');
        save(parsed.data);
      }}
    >
      <p className="b-fine">{t('These public contacts appear in the storefront and order drafts.')}</p>
      {SETTING_FIELDS.map(([key, label]) => (
        <label key={key} className="b-field">
          <span>{t(label)}</span>
          <input
            id={'setting-' + key}
            type={key === 'phone' ? 'tel' : 'url'}
            autoComplete="off"
            value={draft[key]}
            onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value.trim() }))}
          />
        </label>
      ))}
      <button type="button" className={'ba-visibility ' + (draft.freeTashkentDelivery ? 'on' : '')} onClick={() => setDraft((s) => ({ ...s, freeTashkentDelivery: !s.freeTashkentDelivery }))} aria-pressed={draft.freeTashkentDelivery}>
        <span>
          <strong>{t('Free and quick delivery in Tashkent')}</strong>
          <small>{t(draft.freeTashkentDelivery ? 'Shown in the storefront and bag.' : 'Delivery arranged with the store')}</small>
        </span>
        <i />
      </button>
      {error && <p className="b-error">{t(error)}</p>}
      <div className="ba-form-actions">
        <button type="button" className="b-buy ghost" disabled={busy || !dirty} onClick={() => setDraft(settings)}>
          {t('Cancel')}
        </button>
        <button className="b-buy" disabled={busy || !dirty}>
          {t('Save settings')}
        </button>
      </div>
    </form>
  );
}
