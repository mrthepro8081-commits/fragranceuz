'use client';
import { AlertTriangle, ArrowRight, Check, Loader2, X } from 'lucide-react';
import type { Product } from '../../lib/types';
import type { StoreSettings } from '../../lib/settings';
import { formatBottle, formatConcentration, formatCountry, formatMoney } from '../../lib/i18n';
import { useLanguage } from '../language';
import { displayName } from '../boutique/format';
import { Shot } from '../boutique/ui';
import { tints, toneOf } from '../boutique/tone';

export type AdminChange =
  | { action: 'save'; product: Product; before: Product | null; imageUpload?: string }
  | { action: 'delete'; id: string; product: Product }
  | { action: 'settings'; settings: StoreSettings; before: StoreSettings }
  | { action: 'order-status'; id: string; status: string; from: string; customer: string }
  | { action: 'retry-notification'; id: string };

type Line = { label: string; from?: string; to: string };

/** Human-readable list of what a product save changes. */
function productDiff(before: Product, after: Product, t: (k: string) => string, lang: 'ru' | 'uz', upload: boolean): Line[] {
  const lines: Line[] = [];
  const gender = (g: string) => t({ women: 'For her', men: 'For him', unisex: 'Unisex' }[g] || 'Unspecified');
  const text = (v: string | null) => (v && v.trim() ? v : '—');
  const field = (label: string, a: string, b: string) => a !== b && lines.push({ label, from: a, to: b });
  field(t('Fragrance name'), before.name, after.name);
  field(t('Fragrance house'), text(before.brand), text(after.brand));
  field(t('Audience'), gender(before.gender), gender(after.gender));
  field(t('Concentration'), text(formatConcentration(before.concentration, lang)), text(formatConcentration(after.concentration, lang)));
  field(t('Country'), text(before.country && formatCountry(before.country, lang)), text(after.country && formatCountry(after.country, lang)));
  field(t('Release year'), text(before.year), text(after.year));
  field('Fragrantica', before.fragranticaUrl ? t('Link added') : '—', after.fragranticaUrl ? t('Link added') : '—');
  if (before.fragranticaUrl && after.fragranticaUrl && before.fragranticaUrl !== after.fragranticaUrl) lines.push({ label: 'Fragrantica', to: t('Link changed') });
  if (upload || before.image !== after.image) lines.push({ label: t('Photo'), to: t('New photo') });
  const priceOf = (p: Product) => new Map(p.variants.map((v) => [formatBottle(v.label, lang), v.price]));
  const a = priceOf(before), b = priceOf(after);
  for (const [label, price] of b) {
    if (!a.has(label)) lines.push({ label, from: t('New option'), to: formatMoney(price, lang) });
    else if (a.get(label) !== price) lines.push({ label, from: formatMoney(a.get(label)!, lang), to: formatMoney(price, lang) });
  }
  for (const [label, price] of a) if (!b.has(label)) lines.push({ label, from: formatMoney(price, lang), to: t('Removed') });
  if (before.active !== after.active) lines.push({ label: t('In the storefront'), from: t(before.active ? 'Shown' : 'Hidden'), to: t(after.active ? 'Shown' : 'Hidden') });
  return lines;
}

const SETTING_LABELS: Record<keyof StoreSettings, string> = {
  phone: 'Store phone', managerUrl: 'Manager Telegram link', channelUrl: 'Telegram channel link', decantsUrl: 'Decants channel link',
  instagramUrl: 'Instagram profile link', reviewsUrl: 'Customer reviews link', freeTashkentDelivery: 'Free and quick delivery in Tashkent',
};

export function ConfirmSheet({ change, busy, confirm, cancel }: { change: AdminChange; busy: boolean; confirm: () => void; cancel: () => void }) {
  const { t, lang } = useLanguage();
  let title = t('Confirm your changes');
  let lines: Line[] = [];
  let product: Product | null = null;
  let danger = false;
  let note = '';
  if (change.action === 'save') {
    product = change.product;
    if (!change.before) {
      title = t('Publish a new fragrance?');
      note = t(change.product.active ? 'It will appear in the storefront right after you confirm.' : 'It will be saved as hidden.');
      lines = change.product.variants.map((v) => ({ label: formatBottle(v.label, lang), to: formatMoney(v.price, lang) }));
    } else {
      lines = productDiff(change.before, change.product, t, lang, Boolean(change.imageUpload));
      if (change.before.active !== change.product.active && lines.length === 1)
        title = t(change.product.active ? 'Show in the storefront?' : 'Hide from the storefront?');
    }
  } else if (change.action === 'delete') {
    product = change.product;
    danger = true;
    title = t('Delete this fragrance?');
    note = t('It disappears from the storefront and the admin list. Adding its channel post again brings it back.');
  } else if (change.action === 'settings') {
    for (const k of Object.keys(SETTING_LABELS) as (keyof StoreSettings)[]) {
      const a = change.before[k], b = change.settings[k];
      if (a !== b)
        lines.push(typeof b === 'boolean' ? { label: t(SETTING_LABELS[k]), from: t(a ? 'On' : 'Off'), to: t(b ? 'On' : 'Off') } : { label: t(SETTING_LABELS[k]), from: String(a), to: String(b) });
    }
  } else if (change.action === 'order-status') {
    title = t('Change order status?');
    lines = [{ label: change.customer + ' · #' + change.id.slice(0, 8), from: t('status.' + change.from), to: t('status.' + change.status) }];
  } else {
    title = t('Retry Telegram alert');
    note = '#' + change.id.slice(0, 8);
  }
  return (
    <div className="ba-confirm-backdrop" onClick={() => !busy && cancel()}>
      <div className="ba-confirm" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ba-confirm-head">
          <span className={'ba-confirm-icon ' + (danger ? 'danger' : '')}>{danger ? <AlertTriangle size={20} /> : <Check size={20} />}</span>
          <button className="b-round dark" disabled={busy} onClick={cancel} aria-label={t('Cancel')}>
            <X size={18} />
          </button>
        </div>
        <span className="b-eyebrow">{t('Before saving')}</span>
        <h2>{title}</h2>
        {product && (
          <div className="ba-confirm-product" style={{ '--niche': tints(toneOf(product.id, {}).tone).niche } as React.CSSProperties}>
            <span className="ba-orb">{product.image ? <Shot p={product} /> : null}</span>
            <span>
              <span className="b-house">{product.brand || '—'}</span>
              <strong>{displayName(product.name)}</strong>
            </span>
          </div>
        )}
        {lines.length > 0 && (
          <ul className="ba-diff">
            {lines.map((l, i) => (
              <li key={i}>
                <span>{l.label}</span>
                <span className="ba-diff-values">
                  {l.from !== undefined && (
                    <>
                      <s>{l.from}</s>
                      <ArrowRight size={13} />
                    </>
                  )}
                  <strong>{l.to}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
        {change.action === 'save' && change.before && lines.length === 0 && <p className="b-fine">{t('Nothing has changed yet.')}</p>}
        {note && <p className="b-fine">{note}</p>}
        <p className="b-fine">{t('Changes are saved only after confirmation and remain after restarting the app.')}</p>
        <div className="ba-confirm-actions">
          <button className="b-buy ghost" disabled={busy} onClick={cancel}>
            {t('Cancel')}
          </button>
          <button className={'b-buy ' + (danger ? 'danger' : '')} disabled={busy || (change.action === 'save' && !!change.before && lines.length === 0)} onClick={confirm}>
            {busy ? <Loader2 size={18} className="b-spin" /> : <Check size={18} />}
            <span>{t(busy ? 'Saving…' : danger ? 'Delete' : 'Confirm')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
