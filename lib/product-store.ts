import seed from '../data/products.json';
import type { Product } from './types';

/** Live catalog writes go to the real tables; the local demo keeps its own copies. */
export type Scope = 'live' | 'demo';

const overrides = (scope: Scope) => (scope === 'demo' ? 'demo_product_overrides' : 'product_overrides');
const key = (scope: Scope, id: string) => `${scope}:${id}`;
const seedIds = new Set((seed as Product[]).map((p) => p.id));
const MAX_IMAGE = 3_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function imagePath(scope: Scope, id: string) {
  return `/api/images/${scope === 'demo' ? 'demo-' : ''}${id}?v=${Date.now()}`;
}
export function imageKeyFromPath(segment: string) {
  const match = /^(demo-)?(\d{1,16})$/.exec(segment);
  return match ? key(match[1] ? 'demo' : 'live', match[2]) : null;
}

export async function removedIds(db: D1Database, scope: Scope) {
  const rows = await db.prepare('SELECT key FROM product_removals WHERE key LIKE ?').bind(scope + ':%').all<{ key: string }>();
  return new Set(rows.results.map((r) => r.key.slice(scope.length + 1)));
}

async function storeImage(db: D1Database, scope: Scope, id: string, bytes: Uint8Array, type: string) {
  await db
    .prepare('INSERT INTO product_images (key,content_type,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET content_type=excluded.content_type,data=excluded.data,updated_at=excluded.updated_at')
    .bind(key(scope, id), type, bytes, new Date().toISOString())
    .run();
}

/** Downloads a Telegram CDN photo so the catalog keeps working after the CDN link expires. */
async function downloadChannelPhoto(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)telesco\.pe$/i.test(u.hostname)) return null;
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    const type = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (!response.ok || !IMAGE_TYPES.includes(type)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length && bytes.length <= MAX_IMAGE ? { bytes, type } : null;
  } catch {
    return null;
  }
}

/** Decodes a photo uploaded from the admin (a data: URL produced by the browser). */
function decodeUpload(dataUrl: unknown): { bytes: Uint8Array; type: string } | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]);
  if (!binary.length || binary.length > MAX_IMAGE) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, type: match[1] };
}

/** Saves a confirmed product: keeps its photo on our side, writes the override and clears any earlier deletion. */
export async function saveProduct(db: D1Database, scope: Scope, product: Product, upload?: unknown) {
  const photo = decodeUpload(upload) ?? (product.image && /^https:\/\//.test(product.image) ? await downloadChannelPhoto(product.image) : null);
  if (photo) {
    await storeImage(db, scope, product.id, photo.bytes, photo.type);
    product = { ...product, image: imagePath(scope, product.id) };
  }
  await db
    .prepare(`INSERT INTO ${overrides(scope)} (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`)
    .bind(product.id, JSON.stringify(product), new Date().toISOString())
    .run();
  await db.prepare('DELETE FROM product_removals WHERE key=?').bind(key(scope, product.id)).run();
  return product;
}

/** Deletes a product for good. Re-importing its channel post later adds it back. */
export async function deleteProduct(db: D1Database, scope: Scope, id: string) {
  const exists = seedIds.has(id) || (await db.prepare(`SELECT id FROM ${overrides(scope)} WHERE id=?`).bind(id).first());
  if (!exists) return false;
  await db.batch([
    db.prepare('INSERT INTO product_removals (key,removed_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET removed_at=excluded.removed_at').bind(key(scope, id), new Date().toISOString()),
    db.prepare(`DELETE FROM ${overrides(scope)} WHERE id=?`).bind(id),
    db.prepare('DELETE FROM product_images WHERE key=?').bind(key(scope, id)),
  ]);
  return true;
}
