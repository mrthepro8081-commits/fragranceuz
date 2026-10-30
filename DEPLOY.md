# Launching Fragrance UZ in Telegram

Everything runs on the store owner's free Cloudflare account. About 15 minutes.

## You need
- **Node.js 22.13 or newer** (LTS from nodejs.org)
- Access to the owner's **Cloudflare** account (mr.thepro8081@gmail.com, "Continue with Google")
- The **bot token** from @BotFather (`/mybots` → the bot → API Token) — ask the owner; never put it in files or chats
- First time on Cloudflare Workers: Dashboard → Workers & Pages → choose a **workers.dev subdomain**

## Deploy
In this folder:
```sh
npm install
npx wrangler login        # browser: Continue with Google → Allow
npm run deploy            # paste the bot token when asked
```
`scripts/deploy.mjs` does the rest: builds the app, creates the D1 database `fragranceuz-db` and applies all migrations in `drizzle/`, deploys the Worker `fragranceuz`, stores the bot token as an encrypted Worker secret, and connects the bot (webhook `/api/telegram`, "Магазин" menu button, `/start`).

Built in: owner Telegram ID `740597322` (admin + order alerts) and the client Google Sheet link. Change with env vars before `npm run deploy`:
`OWNER_TELEGRAM_ID`, `ADMIN_TELEGRAM_IDS=111,222` (more admins), `ORDER_CHAT_ID`, `GOOGLE_SHEET_URL`, `WORKER_NAME`.

It ends with **"✓ Live at https://fragranceuz.<subdomain>.workers.dev"**.

## After deploying
1. The owner opens the bot and presses **Start** (Telegram lets a bot message someone only after that). They see "Открыть магазин" and "⚙️ Управление магазином".
2. Place a test order: the owner gets it in the bot with ✅/❌ buttons; the customer gets a summary.
3. Optional — channel link: @BotFather → `/newapp` → the bot → the "Live at" URL → short name `shop`. Then `https://t.me/<bot>/shop` opens the shop and `…/shop?startapp=<post id>` opens one perfume.
4. Google Sheet of clients: Admin → Настройки магазина → «Google Таблица клиентов», follow the 5 steps (details in `google-sheets/README.md`).

## Updating later
Change the code, then run `npm run deploy` again from the same folder (it reuses the database).

## Checks
```sh
node scripts/test-orders.mjs   # 58 unit tests
npx tsc --noEmit
```
More: `README.md` (features, admin, statistics), `google-sheets/README.md`.
