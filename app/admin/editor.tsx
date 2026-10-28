'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Camera, ClipboardPaste, Eye, EyeOff, Link2, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { Product, Variant } from '../../lib/types';
import { errorText, formatConcentration, formatCountry } from '../../lib/i18n';
import { productInput } from '../../lib/validation';
import { useLanguage } from '../language';
import { Sheet, Shot } from '../boutique/ui';
import { tints, toneOf } from '../boutique/tone';

export function blankProduct(): Product {
  return {
    id: '', title: '', name: '', brand: '', variants: [{ label: '', volume: 0, price: 0 }], gender: 'unspecified', concentration: null,
    country: null, year: null, fragranticaUrl: null, sourceUrl: '', sourceDate: null, importedAt: new Date().toISOString().slice(0, 10),
    photoSource: null, image: null, active: true, sourceText: '',
  };
}

/* ---------- add by link ---------- */

export function LinkImport({ demo, headers, onImported, onManual }: {
  demo: boolean;
  headers: () => Record<string, string>;
  onImported: (product: Product, warnings: string[]) => void;
  onManual: () => void;
}) {
  const { t, lang } = useLanguage();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load(value = url) {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(demo ? '/api/demo/import' : '/api/admin/import', {
        method: 'POST', headers: headers(), body: JSON.stringify({ url: value.trim() }), signal: AbortSignal.timeout(25000),
      });
      const data = (await response.json()) as { product: Product; warnings: string[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setUrl('');
      onImported(data.product, data.warnings);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'CHANNEL_UNAVAILABLE');
    } finally {
      setBusy(false);
    }
  }
  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setUrl(text);
        if (/^https:\/\/t\.me\//.test(text)) load(text);
      }
    } catch {
      setError('Paste the link into the field manually.');
    }
  }
  return (
    <section className="ba-import">
      <div className="ba-import-head">
        <span className="ba-import-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <span className="b-eyebrow gold">{t('New arrival from the channel')}</span>
          <h2>{t('Add by link')}</h2>
        </div>
      </div>
      <p>{t('Copy the post link in @fragranceuz (Share → Copy link) and paste it here. Photo, name, sizes and prices are filled in for you to check.')}</p>
      <form
        className="ba-import-form"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="ba-import-field">
          <Link2 size={18} />
          <input
            id="import-post-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={500}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="https://t.me/fragranceuz/11078"
            aria-label={t('Original channel post')}
          />
          {!url && (
            <button type="button" onClick={paste} className="ba-paste">
              <ClipboardPaste size={16} />
              {t('Paste')}
            </button>
          )}
        </label>
        <button className="ba-import-go" type="submit" disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={18} className="b-spin" /> : null}
          {t(busy ? 'Reading the post…' : 'Load product from post')}
        </button>
      </form>
      {error && (
        <p className="ba-import-error" role="alert">
          {errorText(error, lang)}
        </p>
      )}
      <button className="ba-import-manual" type="button" onClick={onManual}>
        {t('Enter product details manually')}
      </button>
    </section>
  );
}

/* ---------- editor ---------- */

const SIMPLE_LABEL = /^\d+(?:[.,]\d+)?\s*мл(?: · Tester)?$/;
const CONCENTRATIONS = ['eau de parfum (EDP)', 'eau de toilette (EDT)', 'parfum', 'extrait de parfum', 'elixir de parfum', 'extrait extreme', 'parfum intense'];
const COUNTRIES = ['Англия', 'Германия', 'Испания', 'Италия', 'ОАЭ', 'Оман', 'США', 'Франция', 'Швейцария', 'Южная Корея'];

function labelFor(v: Variant, volume: number, tester: boolean) {
  if (v.label && !SIMPLE_LABEL.test(v.label)) return v.label;
  return `${volume} мл${tester ? ' · Tester' : ''}`;
}

/** Fits a phone photo into the channel's square format, leaving the band the storefront crops empty. */
async function preparePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 900, area = size * 0.84;
    const scale = Math.min(size / img.naturalWidth, area / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (size - w) / 2, (area - h) / 2 + size * 0.01, w, h);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProductEditor({ initial, before, warnings = [], exists, demo, busy, onSave, onDelete, onClose }: {
  initial: Product;
  before: Product | null;
  warnings?: string[];
  exists: boolean;
  demo: boolean;
  busy: boolean;
  onSave: (product: Product, upload?: string) => void;
  onDelete: (product: Product) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const [draft, setDraft] = useState<Product>(() => structuredClone(initial));
  const [upload, setUpload] = useState<string>();
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const manual = !before && !initial.sourceUrl;
  const changed = Boolean(upload) || JSON.stringify(draft) !== JSON.stringify(initial);
  // A re-imported post can differ from the saved product before any manual edit.
  const pending = changed || !before || JSON.stringify(initial) !== JSON.stringify(before);
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setVariant = (i: number, patch: Partial<Variant>) =>
    setDraft((d) => ({ ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);

  function close() {
    if (busy) return;
    if (changed) setDiscard(true);
    else onClose();
  }
  function submit() {
    setError('');
    const product = {
      ...draft,
      title: `${draft.name.trim()} ${draft.brand.trim()}`.trim(),
      variants: draft.variants.map((v) => ({ ...v, label: (v.label.trim() || `${v.volume} мл`) })),
    };
    const checked = productInput.safeParse(product);
    if (!checked.success) {
      const path = String(checked.error.issues[0]?.path[0] || '');
      setError(
        path === 'sourceUrl' || path === 'id' ? 'Paste the @fragranceuz post link of this product.'
          : path === 'variants' ? 'Every bottle option needs a volume and a price.'
          : path === 'fragranticaUrl' ? 'Use the exact Fragrantica fragrance page linked in the channel post.'
          : path === 'name' ? 'Enter the fragrance name.'
          : 'Product details are invalid. Check the source, Fragrantica link, price, and volume.',
      );
      return;
    }
    onSave(checked.data as Product, upload);
  }

  const preview = { ...draft, image: upload || draft.image };
  const tone = tints(toneOf(draft.id, {}).tone);
  return (
    <Sheet label={t(before ? 'Edit fragrance' : 'Add a fragrance')} close={close} className="ba-editor">
      <div className="ba-editor-stage" style={{ '--stage': tone.stage } as React.CSSProperties}>
        <div className="b-stage-bar">
          <button className="b-glass" onClick={close} aria-label={t('Close editor')}>
            <X size={20} />
          </button>
          {draft.sourceUrl && (
            <a className="b-glass" href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label={t('Open source post')}>
              <ArrowUpRight size={19} />
            </a>
          )}
        </div>
        <div className="ba-editor-photo">{preview.image ? <Shot p={preview} eager /> : <span className="ba-no-photo">{t('No photo yet')}</span>}</div>
        <button className="ba-photo-btn" type="button" onClick={() => fileRef.current?.click()}>
          <Camera size={16} />
          {t(preview.image ? 'Replace photo' : 'Add photo')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setUpload(await preparePhoto(file));
            } catch {
              setError('This photo could not be read. Try a JPEG or PNG.');
            }
          }}
        />
      </div>

      <div className="ba-editor-body">
        <span className="b-eyebrow">{t(before ? 'Edit fragrance' : 'New fragrance · check before publishing')}</span>
        {!before && exists && <p className="ba-note">{t('This post is already in the catalog. Confirming will replace its product details.')}</p>}
        {warnings.length > 0 && <p className="ba-note">{t('Only information explicitly provided in the post is imported. Missing or mismatched scent links are left empty.')}</p>}

        {manual && (
          <label className="b-field">
            <span>{t('Original channel post')}</span>
            <input
              id="edit-source"
              type="url"
              value={draft.sourceUrl}
              placeholder="https://t.me/fragranceuz/…"
              onChange={(e) => {
                const url = e.target.value.trim();
                setDraft((d) => ({ ...d, sourceUrl: url, id: url.match(/^https:\/\/t\.me\/fragranceuz\/(\d+)$/)?.[1] || '' }));
              }}
            />
          </label>
        )}
        <label className="b-field">
          <span>{t('Fragrance name')}</span>
          <input id="edit-name" maxLength={150} value={draft.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
        </label>
        <label className="b-field">
          <span>{t('Fragrance house')}</span>
          <input id="edit-brand" maxLength={100} value={draft.brand} onChange={(e) => set('brand', e.target.value)} autoComplete="off" />
        </label>

        <h3 className="b-label">{t('Bottle and price')}</h3>
        <div className="ba-variants">
          {draft.variants.map((v, i) => {
            const simple = !v.label || SIMPLE_LABEL.test(v.label);
            const tester = /tester/i.test(v.label);
            return (
              <div key={i} className="ba-variant">
                <label className="ba-mini-field">
                  <span>{t('Volume')}</span>
                  <span className="ba-unit">
                    <input
                      id={'edit-volume-' + i}
                      inputMode="decimal"
                      value={v.volume || ''}
                      onChange={(e) => {
                        const volume = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
                        setVariant(i, { volume, label: labelFor(v, volume, tester) });
                      }}
                    />
                    <em>{t('ml')}</em>
                  </span>
                </label>
                <label className="ba-mini-field grow">
                  <span>{t('Price')}</span>
                  <span className="ba-unit">
                    <input
                      id={'edit-price-' + i}
                      inputMode="numeric"
                      value={v.price ? v.price.toLocaleString('ru-RU') : ''}
                      onChange={(e) => setVariant(i, { price: Number(e.target.value.replace(/\D/g, '').slice(0, 9)) || 0 })}
                    />
                    <em>{lang === 'ru' ? 'сум' : 'so‘m'}</em>
                  </span>
                </label>
                <button
                  type="button"
                  className="ba-variant-remove"
                  disabled={draft.variants.length === 1}
                  onClick={() => set('variants', draft.variants.filter((_, j) => j !== i))}
                  aria-label={t('Remove bottle option')}
                >
                  <Trash2 size={16} />
                </button>
                {simple ? (
                  <button
                    type="button"
                    className={'ba-tester ' + (tester ? 'on' : '')}
                    aria-pressed={tester}
                    onClick={() => setVariant(i, { label: `${v.volume || 0} мл${tester ? '' : ' · Tester'}` })}
                  >
                    {t('Tester')}
                  </button>
                ) : (
                  <small className="ba-variant-label">{v.label}</small>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="ba-add-variant"
            disabled={draft.variants.length >= 10}
            onClick={() => set('variants', [...draft.variants, { label: '', volume: 0, price: 0 }])}
          >
            <Plus size={16} />
            {t('Add bottle option')}
          </button>
        </div>

        <h3 className="b-label">{t('Audience')}</h3>
        <div className="b-pills">
          {[['women', 'For her'], ['men', 'For him'], ['unisex', 'Unisex'], ['unspecified', 'Unspecified']].map(([id, label]) => (
            <button key={id} type="button" className={draft.gender === id ? 'on' : ''} onClick={() => set('gender', id)}>
              {t(label)}
            </button>
          ))}
        </div>

        <h3 className="b-label">{t('Main details')}</h3>
        <label className="b-field">
          <span>{t('Concentration')}</span>
          <select id="edit-concentration" value={draft.concentration || ''} onChange={(e) => set('concentration', e.target.value || null)}>
            {[...new Set(['', ...CONCENTRATIONS, draft.concentration || ''])].map((value) => (
              <option key={value} value={value}>
                {value ? formatConcentration(value, lang) : t('Unspecified')}
              </option>
            ))}
          </select>
        </label>
        <div className="ba-two">
          <label className="b-field">
            <span>{t('Country')}</span>
            <select id="edit-country" value={draft.country || ''} onChange={(e) => set('country', e.target.value || null)}>
              {[...new Set(['', ...COUNTRIES, draft.country || ''])].map((value) => (
                <option key={value} value={value}>
                  {value ? formatCountry(value, lang) : t('Unspecified')}
                </option>
              ))}
            </select>
          </label>
          <label className="b-field">
            <span>{t('Release year')}</span>
            <input id="edit-year" inputMode="numeric" maxLength={4} value={(draft.year || '').replace(/г\.?$/, '')} onChange={(e) => set('year', e.target.value.replace(/\D/g, '') || null)} />
          </label>
        </div>
        <label className="b-field">
          <span>{t('Exact Fragrantica link from the post')}</span>
          <input id="edit-fragrantica" type="url" value={draft.fragranticaUrl || ''} placeholder="https://www.fragrantica.ru/perfume/…" onChange={(e) => set('fragranticaUrl', e.target.value.trim() || null)} />
        </label>

        <button type="button" className={'ba-visibility ' + (draft.active ? 'on' : '')} onClick={() => set('active', !draft.active)} aria-pressed={draft.active}>
          {draft.active ? <Eye size={20} /> : <EyeOff size={20} />}
          <span>
            <strong>{t(draft.active ? 'Shown in the storefront' : 'Hidden from the storefront')}</strong>
            <small>{t(draft.active ? 'Customers can see and order it.' : 'Customers do not see it. You can show it again any time.')}</small>
          </span>
          <i />
        </button>

        {error && <p className="b-error">{t(error)}</p>}

        {before && (
          <button type="button" className="ba-delete" disabled={busy} onClick={() => onDelete(before)}>
            <Trash2 size={17} />
            {t('Delete fragrance')}
          </button>
        )}
        {demo && <p className="b-fine">{t('Demo workspace')} · {t('Confirmed product and shop changes are saved in this demo. Real orders and customer records are kept separate.')}</p>}
      </div>

      {discard && (
        <div className="ba-discard" role="alert">
          <strong>{t('Discard unsaved changes?')}</strong>
          <p>{t('Your changes have not been saved.')}</p>
          <div>
            <button className="b-buy ghost" onClick={() => setDiscard(false)}>{t('Keep editing')}</button>
            <button className="b-buy danger" onClick={onClose}>{t('Discard changes')}</button>
          </div>
        </div>
      )}

      <div className="b-buybar">
        <button className="b-buy ghost" disabled={busy} onClick={close}>
          {t('Cancel')}
        </button>
        <button className="b-buy" disabled={busy || !pending} onClick={submit}>
          {busy ? <Loader2 size={18} className="b-spin" /> : null}
          <span>{t(before ? 'Save changes' : 'Publish')}</span>
        </button>
      </div>
    </Sheet>
  );
}
