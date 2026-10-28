import { phoneKey } from './insights';
import type { Product } from './types';

/** Tashkent is UTC+5 all year; days in reports are Tashkent calendar days. */
const LOCAL = "'+5 hours'";
export const PERIODS = [7, 30, 90] as const;

export type Totals = { requests: number; value: number; completed: number; customers: number; items: number };
export type Analytics = {
  days: number;
  today: string;
  sample?: boolean;
  daily: { day: string; requests: number; value: number; completed: number }[];
  current: Totals;
  previous: Totals;
  statuses: Record<string, number>;
  topProducts: { id: string; brand: string; name: string; quantity: number; value: number }[];
  topBrands: { brand: string; quantity: number; value: number }[];
  newCustomers: number;
  funnel: { views: number; adds: number; ordered: number };
  topViewed: { id: string; views: number; adds: number }[];
};

export function localDay(date = new Date()) {
  return new Date(date.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

export async function analytics(db: D1Database, days: number): Promise<Analytics> {
  const now = Date.now();
  const since = new Date(now - days * 86400_000).toISOString();
  const before = new Date(now - 2 * days * 86400_000).toISOString();
  const sinceDay = localDay(new Date(now - (days - 1) * 86400_000));
  const totals = (from: string, to: string) =>
    db
      .prepare(
        `SELECT COUNT(*) AS requests,
          COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS value,
          COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END),0) AS completed,
          COUNT(DISTINCT ${phoneKey}) AS customers,
          COALESCE((SELECT SUM(json_extract(i.value,'$.quantity')) FROM orders o2, json_each(o2.data,'$.items') i
            WHERE o2.status!='cancelled' AND o2.created_at>=? AND o2.created_at<?),0) AS items
         FROM orders WHERE created_at>=? AND created_at<?`,
      )
      .bind(from, to, from, to)
      .first<Totals>();
  const end = new Date(now + 1000).toISOString();
  const [daily, current, previous, statuses, topProducts, topBrands, fresh, funnel, topViewed] = await Promise.all([
    db
      .prepare(
        `SELECT date(created_at,${LOCAL}) AS day, COUNT(*) AS requests,
          COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS value,
          COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END),0) AS completed
         FROM orders WHERE date(created_at,${LOCAL})>=? GROUP BY day ORDER BY day`,
      )
      .bind(sinceDay)
      .all<Analytics['daily'][number]>(),
    totals(since, end),
    totals(before, since),
    db.prepare('SELECT status, COUNT(*) AS n FROM orders WHERE created_at>=? GROUP BY status').bind(since).all<{ status: string; n: number }>(),
    db
      .prepare(
        `SELECT json_extract(i.value,'$.id') AS id, MAX(json_extract(i.value,'$.brand')) AS brand, MAX(json_extract(i.value,'$.name')) AS name,
          SUM(json_extract(i.value,'$.quantity')) AS quantity, SUM(json_extract(i.value,'$.price')*json_extract(i.value,'$.quantity')) AS value
         FROM orders, json_each(orders.data,'$.items') AS i
         WHERE orders.status!='cancelled' AND orders.created_at>=? GROUP BY json_extract(i.value,'$.id') ORDER BY quantity DESC, value DESC LIMIT 8`,
      )
      .bind(since)
      .all<Analytics['topProducts'][number]>(),
    db
      .prepare(
        `SELECT json_extract(i.value,'$.brand') AS brand, SUM(json_extract(i.value,'$.quantity')) AS quantity,
          SUM(json_extract(i.value,'$.price')*json_extract(i.value,'$.quantity')) AS value
         FROM orders, json_each(orders.data,'$.items') AS i
         WHERE orders.status!='cancelled' AND orders.created_at>=? GROUP BY json_extract(i.value,'$.brand') ORDER BY value DESC LIMIT 6`,
      )
      .bind(since)
      .all<Analytics['topBrands'][number]>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM (SELECT ${phoneKey} AS k, MIN(created_at) AS first FROM orders GROUP BY k) WHERE first>=?`)
      .bind(since)
      .first<{ n: number }>(),
    db.prepare('SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(adds),0) AS adds FROM product_events WHERE day>=?').bind(sinceDay).first<{ views: number; adds: number }>(),
    db
      .prepare('SELECT product_id AS id, SUM(views) AS views, SUM(adds) AS adds FROM product_events WHERE day>=? GROUP BY product_id ORDER BY views DESC, adds DESC LIMIT 8')
      .bind(sinceDay)
      .all<Analytics['topViewed'][number]>(),
  ]);
  return {
    days,
    today: localDay(),
    daily: daily.results,
    current: current!,
    previous: previous!,
    statuses: Object.fromEntries(statuses.results.map((r) => [r.status, r.n])),
    topProducts: topProducts.results,
    topBrands: topBrands.results,
    newCustomers: fresh?.n || 0,
    funnel: { views: funnel?.views || 0, adds: funnel?.adds || 0, ordered: current?.items || 0 },
    topViewed: topViewed.results,
  };
}

/** Counts a product view or add-to-bag. Anonymous: only a daily counter per product is stored. */
export async function recordEvent(db: D1Database, type: 'view' | 'add', productId: string) {
  const column = type === 'view' ? 'views' : 'adds';
  await db
    .prepare(`INSERT INTO product_events (day,product_id,${column}) VALUES (?,?,1) ON CONFLICT(day,product_id) DO UPDATE SET ${column}=${column}+1`)
    .bind(localDay(), productId)
    .run();
}

/**
 * Example figures for the demo admin, which has no real orders. Clearly flagged as `sample`
 * so the panel labels them; generated from the catalog with a fixed seed so they look the same each time.
 */
export function sampleAnalytics(products: Product[], days: number): Analytics {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const today = localDay();
  const daily = Array.from({ length: days }, (_, i) => {
    const day = localDay(new Date(Date.now() - (days - 1 - i) * 86400_000));
    const weekend = [0, 6].includes(new Date(day).getUTCDay());
    const requests = Math.round(rand() * 4 + (weekend ? 3 : 1) + i / days * 2);
    const value = requests * Math.round(900_000 + rand() * 1_400_000);
    return { day, requests, value, completed: Math.round(value * (0.45 + rand() * 0.3)) };
  });
  const sum = (k: 'requests' | 'value' | 'completed') => daily.reduce((s, d) => s + d[k], 0);
  const picks = products.slice(0, 40).sort(() => rand() - 0.5).slice(0, 8);
  const topProducts = picks
    .map((p, i) => ({ id: p.id, brand: p.brand, name: p.name, quantity: Math.max(1, Math.round((12 - i * 1.3) * (days / 30) + rand() * 2)), value: 0 }))
    .map((p) => ({ ...p, value: p.quantity * products.find((x) => x.id === p.id)!.variants[0].price }))
    .sort((a, b) => b.quantity - a.quantity);
  const brands = new Map<string, { brand: string; quantity: number; value: number }>();
  for (const p of topProducts) {
    const b = brands.get(p.brand) || { brand: p.brand, quantity: 0, value: 0 };
    b.quantity += p.quantity;
    b.value += p.value;
    brands.set(p.brand, b);
  }
  const requests = sum('requests');
  const items = Math.round(requests * 1.3);
  return {
    days,
    today,
    sample: true,
    daily,
    current: { requests, value: sum('value'), completed: sum('completed'), customers: Math.round(requests * 0.8), items },
    previous: { requests: Math.round(requests * 0.84), value: Math.round(sum('value') * 0.79), completed: Math.round(sum('completed') * 0.9), customers: Math.round(requests * 0.7), items: Math.round(items * 0.85) },
    statuses: { new: Math.round(requests * 0.12), confirmed: Math.round(requests * 0.2), completed: Math.round(requests * 0.58), cancelled: Math.round(requests * 0.1) },
    topProducts,
    topBrands: [...brands.values()].sort((a, b) => b.value - a.value).slice(0, 6),
    newCustomers: Math.round(requests * 0.45),
    funnel: { views: items * 14, adds: items * 3, ordered: items },
    topViewed: picks.slice(0, 8).map((p, i) => ({ id: p.id, views: Math.round((140 - i * 13) * (days / 30)), adds: Math.round((26 - i * 2) * (days / 30)) })),
  };
}
