import type { OrderData } from './types';
import type { RuntimeEnv } from './server';
import { ORDER_STATUSES, notifyStatusChange } from './order-notify';

/** Saves a status change and sends its Telegram messages. Shared by the admin panel and the bot's buttons. */
export async function setOrderStatus(env: RuntimeEnv, id: string, status: string, origin?: string) {
  if (!env.DB) return { error: 'Database is not connected', code: 503 } as const;
  if (typeof id !== 'string' || !(ORDER_STATUSES as readonly string[]).includes(status)) return { error: 'Invalid status', code: 400 } as const;
  const row = await env.DB.prepare('SELECT data,status FROM orders WHERE id=?').bind(id).first<{ data: string; status: string }>();
  if (!row) return { error: 'Order not found', code: 404 } as const;
  const data = JSON.parse(row.data) as OrderData;
  if (row.status === status) return { ok: true, changed: false, data } as const;
  await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(status, id).run();
  const notified = await notifyStatusChange(env, id, data, status, origin);
  return { ok: true, changed: true, data, notified } as const;
}
