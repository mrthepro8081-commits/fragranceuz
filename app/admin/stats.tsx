'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from 'lucide-react';
import type { Product } from '../../lib/types';
import type { Analytics } from '../../lib/analytics';
import { formatMoney, formatDate } from '../../lib/i18n';
import { useLanguage } from '../language';
import { compactMoney, displayName } from '../boutique/format';
import { Shot } from '../boutique/ui';
import { tints, toneOf } from '../boutique/tone';

/* Segment order and colours were checked for colour-blind separation in both themes (see admin.css). */
const STATUS_ORDER = ['completed', 'confirmed', 'new', 'cancelled'] as const;
const PERIODS = [7, 30, 90];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  // Four gridline steps; each step is a round 1 / 2 / 2.5 / 5 × 10^n.
  const raw = value / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].find((s) => s * pow >= raw)! * pow * 4;
}

function Delta({ now, before }: { now: number; before: number }) {
  const { t } = useLanguage();
  if (!before && !now) return null;
  if (!before) return <span className="ba-delta up"><ArrowUpRight size={13} />{t('new')}</span>;
  const change = Math.round(((now - before) / before) * 100);
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return (
    <span className={'ba-delta ' + dir}>
      {dir === 'up' ? <ArrowUpRight size={13} /> : dir === 'down' ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {Math.abs(change)}%
    </span>
  );
}

/** Daily requested value as columns; tap or hover a day for its figures. */
function DailyChart({ data, days }: { data: Analytics; days: number }) {
  const { t, lang } = useLanguage();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const series = useMemo(() => {
    const byDay = new Map(data.daily.map((d) => [d.day, d]));
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.parse(data.today) - (days - 1 - i) * 86400_000).toISOString().slice(0, 10);
      return byDay.get(day) || { day, requests: 0, value: 0, completed: 0 };
    });
  }, [data, days]);
  const height = 190, left = 52, right = 8, top = 12, bottom = 26;
  const plotW = Math.max(0, width - left - right), plotH = height - top - bottom;
  const max = niceMax(Math.max(...series.map((d) => d.value)));
  const slot = plotW / series.length;
  const barW = Math.min(24, Math.max(2, slot - 2));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(series.length / Math.max(1, Math.floor(plotW / 56)));
  const day = (iso: string) => formatDate(iso + 'T12:00:00+05:00', lang).replace(/\s?\d{4}(-yil)?\s?/, ' ').trim();
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const i = Math.floor((clientX - box.left - left) / slot);
    setActive(i >= 0 && i < series.length ? i : null);
  };
  const hit = active !== null ? series[active] : null;
  return (
    <div className="ba-chart" ref={ref} onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('Requested value by day')}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="ba-grid" />
              <text x={left - 8} y={y(v) + 4} textAnchor="end" className="ba-axis">{v ? compactMoney(v, lang) : '0'}</text>
            </g>
          ))}
          {series.map((d, i) => {
            const x = left + i * slot + (slot - barW) / 2;
            const h = Math.max(0, y(0) - y(d.value));
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={d.day}>
                {h > 0 && (
                  <path
                    className={'ba-col ' + (active === i ? 'on' : '')}
                    d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barW - r} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + r} V${y(0)} Z`}
                  />
                )}
                {(i % labelEvery === 0 || i === series.length - 1) && (series.length - 1 - i >= labelEvery / 2 || i === series.length - 1) && (
                  <text x={left + i * slot + slot / 2} y={height - 8} textAnchor="middle" className="ba-axis">{day(d.day)}</text>
                )}
              </g>
            );
          })}
          {hit && <line x1={left + active! * slot + slot / 2} x2={left + active! * slot + slot / 2} y1={top} y2={y(0)} className="ba-cross" />}
        </svg>
      )}
      {hit && (
        <div className="ba-tip" style={{ left: Math.min(Math.max(left + active! * slot + slot / 2, 80), width - 80) }}>
          <strong>{day(hit.day)}</strong>
          <span>{formatMoney(hit.value, lang)}</span>
          <small>{t('Requests')}: {hit.requests}</small>
        </div>
      )}
    </div>
  );
}

function StatusBar({ statuses }: { statuses: Record<string, number> }) {
  const { t } = useLanguage();
  const total = STATUS_ORDER.reduce((s, k) => s + (statuses[k] || 0), 0);
  if (!total) return <p className="b-fine">{t('No requests in this period yet.')}</p>;
  return (
    <>
      <div className="ba-stack" role="img" aria-label={STATUS_ORDER.map((k) => `${t('status.' + k)}: ${statuses[k] || 0}`).join(', ')}>
        {STATUS_ORDER.filter((k) => statuses[k]).map((k) => (
          <i key={k} className={'st-' + k} style={{ flexGrow: statuses[k] }} title={`${t('status.' + k)}: ${statuses[k]}`} />
        ))}
      </div>
      <ul className="ba-legend">
        {STATUS_ORDER.map((k) => (
          <li key={k}>
            <i className={'st-' + k} />
            <span>{t('status.' + k)}</span>
            <strong>{statuses[k] || 0}</strong>
            <small>{Math.round(((statuses[k] || 0) / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </>
  );
}

function Funnel({ funnel }: { funnel: Analytics['funnel'] }) {
  const { t } = useLanguage();
  const steps = [
    ['Product views', funnel.views],
    ['Added to bag', funnel.adds],
    ['Bottles ordered', funnel.ordered],
  ] as const;
  const max = Math.max(1, funnel.views, funnel.adds, funnel.ordered);
  return (
    <div className="ba-funnel">
      {steps.map(([label, value], i) => (
        <div key={label} className={'step-' + i}>
          <span>{t(label)}</span>
          <div className="ba-hbar"><i style={{ width: Math.max(1.5, (value / max) * 100) + '%' }} /></div>
          <strong>{value.toLocaleString('ru-RU')}</strong>
          {i > 0 && <small>{steps[i - 1][1] ? Math.round((value / steps[i - 1][1]) * 100) + '%' : '—'}</small>}
        </div>
      ))}
    </div>
  );
}

export function StatsPanel({ demo, headers, products, ordersTotal }: {
  demo: boolean;
  headers: () => Record<string, string>;
  products: Product[];
  ordersTotal: number;
}) {
  const { t, lang } = useLanguage();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [table, setTable] = useState(false);
  useEffect(() => {
    let live = true;
    fetch((demo ? '/api/demo/analytics' : '/api/admin/analytics') + '?days=' + days, { headers: headers(), signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? (r.json() as Promise<Analytics>) : Promise.reject()))
      .then((d: Analytics) => live && (setData(d), setError('')))
      .catch(() => live && setError('Could not load statistics. Please try again.'));
    return () => {
      live = false;
    };
  }, [days, demo, headers, ordersTotal]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const money = (n: number) => formatMoney(Math.round(n), lang);

  return (
    <section className="ba-panel ba-stats">
      <div className="b-pills" role="group" aria-label={t('Period')}>
        {PERIODS.map((d) => (
          <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
            {t(`${d} days`)}
          </button>
        ))}
      </div>
      {error && <p className="b-error">{t(error)}</p>}
      {!data ? (
        <div className="ba-loading"><Loader2 className="b-spin" size={22} /></div>
      ) : (
        <>
          {data.sample && <p className="ba-note">{t('Example figures: the demo has no real orders. Your real statistics appear here after launch.')}</p>}
          <article className="ba-hero-stat">
            <span>{t('Requested value')} · {t(`${days} days`)}</span>
            <strong>{money(data.current.value)}</strong>
            <p>
              <Delta now={data.current.value} before={data.previous.value} /> {t('vs the previous period')}
            </p>
          </article>
          <div className="ba-tiles">
            {[
              ['Requests', data.current.requests.toLocaleString('ru-RU'), data.current.requests, data.previous.requests],
              ['Average order', money(data.current.requests ? data.current.value / data.current.requests : 0), data.current.requests ? data.current.value / data.current.requests : 0, data.previous.requests ? data.previous.value / data.previous.requests : 0],
              ['Completed order value', money(data.current.completed), data.current.completed, data.previous.completed],
              ['New customers', data.newCustomers.toLocaleString('ru-RU'), null, null],
            ].map(([label, value, now, before]) => (
              <article key={label as string} className="ba-tile">
                <span>{t(label as string)}</span>
                <strong className={String(value).length > 9 ? 'long' : ''}>{value}</strong>
                {now !== null && <Delta now={now as number} before={before as number} />}
              </article>
            ))}
          </div>

          <article className="ba-card">
            <header>
              <h3>{t('Requests by day')}</h3>
              <button className="b-text-btn" onClick={() => setTable((x) => !x)}>{t(table ? 'Show chart' : 'Show table')}</button>
            </header>
            {table ? (
              <div className="ba-table-wrap">
                <table className="ba-table">
                  <thead><tr><th>{t('Day')}</th><th>{t('Requests')}</th><th>{t('Requested value')}</th></tr></thead>
                  <tbody>
                    {[...data.daily].reverse().map((d) => (
                      <tr key={d.day}><td>{formatDate(d.day + 'T12:00:00+05:00', lang)}</td><td>{d.requests}</td><td>{money(d.value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DailyChart data={data} days={days} />
            )}
          </article>

          <article className="ba-card">
            <header><h3>{t('Order status overview')}</h3></header>
            <StatusBar statuses={data.statuses} />
          </article>

          <article className="ba-card">
            <header><h3>{t('From view to order')}</h3></header>
            <Funnel funnel={data.funnel} />
            <p className="b-fine">{t('Views and bag additions are counted anonymously from the storefront.')}</p>
          </article>

          <article className="ba-card">
            <header><h3>{t('Best-selling fragrances')}</h3></header>
            {data.topProducts.length ? (
              <ol className="ba-rank">
                {data.topProducts.map((p) => {
                  const product = byId.get(p.id);
                  const top = data.topProducts[0].quantity || 1;
                  return (
                    <li key={p.id} style={{ '--niche': tints(toneOf(p.id, {}).tone).niche } as React.CSSProperties}>
                      <span className="ba-orb small">{product && <Shot p={product} />}</span>
                      <div>
                        <span className="b-house">{p.brand}</span>
                        <strong>{displayName(p.name)}</strong>
                        <div className="ba-hbar"><i style={{ width: (p.quantity / top) * 100 + '%' }} /></div>
                      </div>
                      <span className="ba-rank-value">
                        <strong>{p.quantity} {t('pcs')}</strong>
                        <small>{compactMoney(p.value, lang)}</small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="b-fine">{t('No requests in this period yet.')}</p>
            )}
          </article>

          <article className="ba-card">
            <header><h3>{t('Top houses')}</h3></header>
            {data.topBrands.length ? (
              <div className="ba-brands">
                {data.topBrands.map((b) => (
                  <div key={b.brand}>
                    <span>{b.brand}</span>
                    <div className="ba-hbar"><i style={{ width: (b.value / (data.topBrands[0].value || 1)) * 100 + '%' }} /></div>
                    <strong>{compactMoney(b.value, lang)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="b-fine">{t('No requests in this period yet.')}</p>
            )}
          </article>

          <article className="ba-card">
            <header><h3>{t('Most viewed')}</h3></header>
            {data.topViewed.length ? (
              <ol className="ba-viewed">
                {data.topViewed.map((v) => {
                  const product = byId.get(v.id);
                  return (
                    <li key={v.id}>
                      <span>{product ? `${product.brand} · ${displayName(product.name)}` : '#' + v.id}</span>
                      <strong>{v.views}</strong>
                      <small>{v.adds} {t('in bag')}</small>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="b-fine">{t('Views appear here once customers open the shop.')}</p>
            )}
          </article>
          <p className="b-fine">{t('Requests are not confirmed payments. Completed order value follows the status set by the store.')}</p>
        </>
      )}
    </section>
  );
}
