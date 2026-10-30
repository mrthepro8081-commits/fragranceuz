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

/** Who receives order alerts: the order chat (the owner by default) and every listed admin, once each. */
export function alertRecipients(env: RuntimeEnv) {
  const ids = [env.TELEGRAM_ORDER_CHAT_ID, ...(env.ADMIN_TELEGRAM_IDS || '').split(',')].map((s) => (s || '').trim()).filter(Boolean);
  return [...new Set(ids)];
}

/** Sends one message to every recipient; succeeds if at least one got it. */
async function toStaff(env: RuntimeEnv, text: string, extra: (chatId: string) => Record<string, unknown>) {
  const recipients = alertRecipients(env);
  if (!env.TELEGRAM_BOT_TOKEN || !recipients.length) throw new Error('Telegram is not connected');
  const results = await Promise.allSettled(recipients.map((chatId) => sendNotification(env.TELEGRAM_BOT_TOKEN!, chatId, text, extra(chatId))));
  if (!results.some((r) => r.status === 'fulfilled')) throw new Error('Telegram delivery failed');
}

/** New order: alert the owner and admins with the customer's contacts and action buttons. */
export async function sendOrderAlert(env: RuntimeEnv, id: string, d: OrderData, origin?: string) {
  await toStaff(env, orderAlertText(id, d), (chatId) => ({ parse_mode: 'HTML', reply_markup: orderKeyboard(id, 'new', d, origin, chatId) }));
}

const CUSTOMER_TEXT: Record<string, Record<'ru' | 'uz', string>> = {
  new: {
    ru: '🛍 <b>Заявка {ref} принята!</b>\n\nСпасибо за заказ. Менеджер проверит наличие и свяжется с вами, чтобы согласовать доставку.\n\n{items}\n\n<b>Итого: {total}</b>\n\n<b>Ваши данные</b>\n{contact}',
    uz: '🛍 <b>{ref} so‘rovingiz qabul qilindi!</b>\n\nBuyurtmangiz uchun rahmat. Menejer mavjudligini tekshirib, yetkazib berishni kelishish uchun siz bilan bog‘lanadi.\n\n{items}\n\n<b>Jami: {total}</b>\n\n<b>Ma’lumotlaringiz</b>\n{contact}',
  },
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
  if (status === 'confirmed') {
    try {
      await toStaff(env, `✅ <b>Заказ ${ref(id)} подтверждён</b>\nКонтакты клиента для доставки:\n\n${orderBody(d)}`.slice(0, 4000), (chatId) => ({
        parse_mode: 'HTML',
        reply_markup: orderKeyboard(id, 'confirmed', d, origin, chatId),
      }));
      owner = true;
    } catch {}
  }
  customer = await messageCustomer(env, id, d, status);
  return { owner, customer };
}

/**
 * Tells the customer about their order in their language (new, confirmed, completed, cancelled).
 * Best effort: Telegram only delivers if the customer has opened the bot chat.
 */
export async function messageCustomer(env: RuntimeEnv, id: string, d: OrderData, status: string) {
  const lang = d.language || 'ru';
  const template = CUSTOMER_TEXT[status]?.[lang];
  if (!env.TELEGRAM_BOT_TOKEN || !template || !d.telegram?.id) return false;
  const items = d.items.map((i) => `• ${esc(i.brand)} — ${esc(formatProductName(i.name, lang))} · ${esc(formatBottle(i.label, lang))} × ${i.quantity}`).join('\n');
  const c = d.customer;
  const contact = [`👤 ${esc(c.name)}`, `📞 ${esc(c.phone)}`, `📍 ${esc(c.address)}`, c.note ? `📝 ${esc(c.note)}` : ''].filter(Boolean).join('\n');
  const text = template.replace('{ref}', ref(id)).replace('{items}', items).replace('{total}', esc(formatMoney(d.total, lang))).replace('{contact}', contact);
  try {
    await tgCall(env.TELEGRAM_BOT_TOKEN, 'sendMessage', { chat_id: d.telegram.id, text: text.slice(0, 4000), parse_mode: 'HTML' });
    return true;
  } catch {
    return false;
  }
}
