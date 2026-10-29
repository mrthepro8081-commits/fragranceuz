import type { OrderData } from './types';

/** The Apps Script web-app link from google-sheets/Code.gs, including its private key. */
export const SHEETS_LINK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec\?key=[a-f0-9]{32,}$/;
export type SheetOrder = { id: string; createdAt: string; status: string; data: OrderData };

/** Private settings never leave the server (the public row is what the storefront reads). */
export async function sheetsLink(db: D1Database | undefined) {
  if (!db) return null;
  const row = await db.prepare("SELECT data FROM store_settings WHERE id='private'").first<{ data: string }>();
  try {
    const link = row ? (JSON.parse(row.data).sheetsUrl as string) : null;
    return link && SHEETS_LINK.test(link) ? link : null;
  } catch {
    return null;
  }
}
export async function saveSheetsLink(db: D1Database, link: string | null) {
  await db
    .prepare("INSERT INTO store_settings (id,data,updated_at) VALUES ('private',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at")
    .bind(JSON.stringify({ sheetsUrl: link }), new Date().toISOString())
    .run();
}

async function post(link: string, body: unknown) {
  const response = await fetch(link, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; orders?: number };
  if (!response.ok || !data.ok) throw new Error(data.error || 'Google Sheets did not accept the data');
  return data;
}

/** Adds or updates one order (and its client) in the sheet. Never throws: the order itself is already saved. */
export async function pushOrder(db: D1Database | undefined, order: SheetOrder) {
  const link = await sheetsLink(db);
  if (!link) return false;
  try {
    await post(link, { event: 'order', order });
    return true;
  } catch {
    return false;
  }
}

export async function testSheet(link: string) {
  return post(link, { event: 'test' });
}

/** Sends every saved order so the sheet holds all clients, including those from before it was connected. */
export async function pushAllOrders(db: D1Database, link: string) {
  const rows = await db.prepare('SELECT id,data,status,created_at FROM orders ORDER BY created_at').all<{ id: string; data: string; status: string; created_at: string }>();
  const orders: SheetOrder[] = rows.results.map((r) => ({ id: r.id, createdAt: r.created_at, status: r.status, data: JSON.parse(r.data) }));
  let total = 0;
  for (let i = 0; i < orders.length || i === 0; i += 300) total = (await post(link, { event: 'bulk', orders: orders.slice(i, i + 300) })).orders || total;
  return { sent: orders.length, total };
}
