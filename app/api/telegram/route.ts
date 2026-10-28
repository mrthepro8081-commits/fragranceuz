import { runtime } from '../../../lib/server';
import { tgCall, webhookSecret } from '../../../lib/telegram';
import { orderAlertText, orderKeyboard } from '../../../lib/order-notify';
import { setOrderStatus } from '../../../lib/order-status';
export const dynamic = 'force-dynamic';

type Update = {
  message?: { chat: { id: number; type: string }; from?: { id: number; language_code?: string }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number }; message_id: number } };
};

/** Telegram bot webhook: /start opens the shop, order buttons change status. Registered by scripts/deploy.mjs. */
export async function POST(request: Request) {
  const e = runtime();
  const token = e.TELEGRAM_BOT_TOKEN;
  if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret(token))) return new Response('Forbidden', { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const origin = new URL(request.url).origin;
  const staff = (id?: number) => id !== undefined && (String(id) === e.OWNER_TELEGRAM_ID || (e.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).includes(String(id)));
  try {
    const m = update.message;
    if (m?.text && m.chat.type === 'private' && /^\/start\b/.test(m.text)) {
      const uz = m.from?.language_code?.startsWith('uz');
      const product = /^\/start\s+(\d{1,16})$/.exec(m.text)?.[1];
      const keyboard = [[{ text: uz ? '🛍 Do‘konni ochish' : '🛍 Открыть магазин', web_app: { url: origin + (product ? `/?product=${product}` : '/') } }]];
      if (staff(m.from?.id)) keyboard.push([{ text: '⚙️ Управление магазином', web_app: { url: origin + '/admin' } }]);
      await tgCall(token, 'sendMessage', {
        chat_id: m.chat.id,
        parse_mode: 'HTML',
        text: uz
          ? '✨ <b>Fragrance UZ</b> — original atirlar, 2018-yildan beri.\n\nKolleksiyani ko‘rish va buyurtma berish uchun tugmani bosing.'
          : '✨ <b>Fragrance UZ</b> — оригинальная парфюмерия с 2018 года.\n\nНажмите кнопку, чтобы открыть коллекцию и оформить заказ.',
        reply_markup: { inline_keyboard: keyboard },
      });
    }
    const q = update.callback_query;
    if (q?.data) {
      const match = /^s:(new|confirmed|completed|cancelled):([0-9a-f-]{36})$/.exec(q.data);
      if (!match || !staff(q.from.id)) {
        await tgCall(token, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Нет доступа', show_alert: true });
      } else {
        const [, status, id] = match;
        const result = await setOrderStatus(e, id, status, origin);
        if (!result.ok) {
          await tgCall(token, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Заявка не найдена', show_alert: true });
        } else {
          if (q.message)
            await tgCall(token, 'editMessageText', {
              chat_id: q.message.chat.id,
              message_id: q.message.message_id,
              text: orderAlertText(id, result.data, status),
              parse_mode: 'HTML',
              reply_markup: orderKeyboard(id, status, result.data, origin, q.message.chat.id),
            }).catch(() => {});
          const told = result.changed && result.notified?.customer ? ' · клиент уведомлён' : '';
          await tgCall(token, 'answerCallbackQuery', { callback_query_id: q.id, text: (result.changed ? 'Статус обновлён' : 'Статус уже такой') + told });
        }
      }
    }
  } catch {
    // Always answer 200 so Telegram does not retry an update forever.
  }
  return Response.json({ ok: true });
}
