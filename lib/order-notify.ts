import type { OrderData } from './types';
import { formatBottle, formatMoney, formatProductName, translate } from './i18n';
import { sendNotification, tgCall } from './telegram';
import type { RuntimeEnv } from './server';

export const ORDER_STATUSES = ['new', 'confirmed', 'completed', 'cancelled'] as const;
const STATUS_ICON: Record<string, string> = { new: '🆕', confirmed: '✅', completed: '🎉', cancelled: '❌' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const ref = (id: string) => '#' + id.slice(0, 8);
/** Owner messages are in Russian, like the channel. */
const ru = (key: string) => translate(key, 'ru');

function chatLink(d: OrderData) {
  return d.telegram.username ? `https://t.me/${d.telegram.username}` : `tg://user?id=${d.telegram.id}`;
}

/** The contact block and items, shared by every owner message about an order. */
function orderBody(d: OrderData) {
  const c = d.customer;
  const lines = [
    `👤 <b>${esc(c.name)}</b>`,
    `📞 ${esc(c.phone)}`,
    `💬 ${d.telegram.username ? '@' + esc(d.telegram.username) : `<a href="tg://user?id=${d.telegram.id}">Telegram</a>`}`,
    `📍 ${esc(c.address)}`,
    '',
    ...d.items.map((i) => `• ${esc(i.brand)} — ${esc(formatProductName(i.name, 'ru'))}\n   ${esc(formatBottle(i.label, 'ru'))} × ${i.quantity} · ${esc(formatMoney(i.price * i.quantity, 'ru'))}`),
    '',
    `<b>${ru('Product subtotal')}: ${esc(formatMoney(d.total, 'ru'))}</b>`,
  ];
  if (c.note) lines.push(`📝 ${esc(c.note)}`);
  return lines.join('\n');
}

/** Buttons under an order alert: the next useful statuses plus a direct chat with the customer. */
export function orderKeyboard(id: string, status: string, d: OrderData, origin?: string, chatId?: string | number) {
  const next: Record<string, string[]> = { new: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: ['new'] };
  const label: Record<string, string> = { confirmed: '✅ Подтвердить', cancelled: '❌ Отменить', completed: '🎉 Выполнен', new: '↩️ Вернуть в новые' };
  const rows: { text: string; callback_data?: string; url?: string; web_app?: { url: string } }[][] = [];
  const actions = next[status].map((s) => ({ text: label[s], callback_data: `s:${s}:${id}` }));
  if (actions.length) rows.push(actions);
  rows.push([{ text: '💬 Написать клиенту', url: chatLink(d) }]);
  // Mini App buttons are allowed only in private chats; a group alert chat (negative id) skips it.
  if (origin && !String(chatId ?? '').startsWith('-')) rows.push([{ text: '⚙️ Все заявки', web_app: { url: `${origin}/admin?tab=orders` } }]);
  return { inline_keyboard: rows };
}

export function orderAlertText(id: string, d: OrderData, status = 'new') {
  const title = status === 'new' ? `🛍 <b>Новая заявка ${ref(id)}</b>` : `${STATUS_ICON[status]} <b>Заявка ${ref(id)} · ${ru('status.' + status)}</b>`;
  return `${title}\n\n${orderBody(d)}\n\n<i>${ru('This is an order request. Availability, final price, delivery, and payment are arranged with the store.')}</i>`.slice(0, 4000);
}

/** New order: alert the owner's chat with action buttons. */
export async function sendOrderAlert(env: RuntimeEnv, id: string, d: OrderData, origin?: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ORDER_CHAT_ID) throw new Error('Telegram is not connected');
  await sendNotification(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ORDER_CHAT_ID, orderAlertText(id, d), {
    parse_mode: 'HTML',
    reply_markup: orderKeyboard(id, 'new', d, origin, env.TELEGRAM_ORDER_CHAT_ID),
  });
}

const CUSTOMER_TEXT: Record<string, Record<'ru' | 'uz', string>> = {
  confirmed: {
    ru: '✅ <b>Ваш заказ {ref} подтверждён!</b>\n\nМы свяжемся с вами, чтобы согласовать время доставки.\n\n{items}\n\n<b>Итого: {total}</b>',
    uz: '✅ <b>{ref} buyurtmangiz tasdiqlandi!</b>\n\nYetkazib berish vaqtini kelishish uchun siz bilan bog‘lanamiz.\n\n{items}\n\n<b>Jami: {total}</b>',
  },
  completed: {
    ru: '🎉 <b>Заказ {ref} выполнен.</b>\nСпасибо, что выбрали Fragrance UZ! Будем рады отзыву.',
    uz: '🎉 <b>{ref} buyurtma bajarildi.</b>\nFragrance UZ ni tanlaganingiz uchun rahmat! Fikringizni kutib qolamiz.',
  },
  cancelled: {
    ru: 'Заказ {ref} отменён. Если это ошибка — просто напишите нам.',
    uz: '{ref} buyurtma bekor qilindi. Agar bu xato bo‘lsa — bizga yozing.',
  },
};

/**
 * Runs after a status change is saved. On approval the owner receives the full contact card;
 * the customer is told about confirmations, completions and cancellations.
 * Delivery is best effort: a customer who never opened the bot chat cannot be messaged.
 */
export async function notifyStatusChange(env: RuntimeEnv, id: string, d: OrderData, status: string, origin?: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return { owner: false, customer: false };
  let owner = false, customer = false;
  if (status === 'confirmed' && env.TELEGRAM_ORDER_CHAT_ID) {
    try {
      await sendNotification(token, env.TELEGRAM_ORDER_CHAT_ID, `✅ <b>Заказ ${ref(id)} подтверждён</b>\nКонтакты клиента для доставки:\n\n${orderBody(d)}`.slice(0, 4000), {
        parse_mode: 'HTML',
        reply_markup: orderKeyboard(id, 'confirmed', d, origin, env.TELEGRAM_ORDER_CHAT_ID),
      });
      owner = true;
    } catch {}
  }
  const template = CUSTOMER_TEXT[status]?.[d.language || 'ru'];
  if (template && d.telegram.id) {
    const lang = d.language || 'ru';
    const items = d.items.map((i) => `• ${esc(i.brand)} — ${esc(formatProductName(i.name, lang))} · ${esc(formatBottle(i.label, lang))} × ${i.quantity}`).join('\n');
    const text = template.replace('{ref}', ref(id)).replace('{items}', items).replace('{total}', esc(formatMoney(d.total, lang)));
    try {
      await tgCall(token, 'sendMessage', { chat_id: d.telegram.id, text, parse_mode: 'HTML' });
      customer = true;
    } catch {}
  }
  return { owner, customer };
}
