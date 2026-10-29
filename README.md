# Fragrance UZ Telegram Mini App

Russian and Uzbek storefront for @fragranceuz, with an original transparent gold logo, bold Apple/system typography and warm light/dark themes. About contains store information and social/contact links; appearance controls are kept out of that section. The catalog comes first, without a large welcome or arrivals block.

## Storefront design — "boutique"

The customer storefront (`app/storefront.tsx`, `app/boutique.css`, `app/boutique/`, `app/finder.tsx`) was redesigned around the brand's burgundy and gold. Backend, admin, order API and data are unchanged; orders use the same `/api/orders` contract.

- **Bottle aura.** Every channel photo is a bottle on white, so each bottle is blended (`mix-blend-mode: multiply`) onto a tint taken from its own colour: arched "display niches" in the catalog and a full-colour stage on the product page. Inside Telegram the header bar takes the colour of the open perfume. The photo watermark sits below the bottle and is cropped from view.
- **Shop by bottle colour.** `scripts/bottle-tones.py` extracts each bottle's colour into `data/bottle-tones.json` (gold, pink, red, amber, black, crystal, silver, blue, green, lilac). Products imported later get a colour computed in the browser; re-run `python3 scripts/bottle-tones.py` (needs Pillow) to bake them in.
- **Home:** "New in the window" carousel of the 10 newest posts, 3-step finder, colour swatches, top houses, recently viewed, then the collection with sticky audience switch, filter sheet (sort, budget incl. "Exclusive · from 2.5 million", colour, concentration, house search) and infinite scroll.
- **Product:** volume picker, Fragrantica link, **"Hint at a gift"** (shares the channel post through Telegram with a ready-made message) and the original post.
- **Bag:** flying-bottle add animation and haptics, review step, **"This is a gift"** flag (added to the order note), remembered contact details, same draft fallback when the bot is not connected.
- **Deep links:** `https://t.me/<bot>/<app>?startapp=<product id>` (or `/?product=<id>`) opens that perfume directly — use it in channel posts.
- Light and dark themes, Russian and Uzbek copy (all new keys are in `data/translations.json`), self-hosted fonts (Cormorant Garamond, Manrope, Oswald via `@fontsource`).

## Store management (admin)

Open the shop from the bot with the owner's Telegram account (or an ID in `ADMIN_TELEGRAM_IDS`) and tap the settings icon in the header, or go to `/admin`. Locally, `/demo` shows the same admin on separate demo tables.

- **Add a new arrival by link:** in @fragranceuz tap Share → Copy link on the post, paste it into "Add by link". The post's photo, name, house, sizes, prices, audience, concentration, country, year and Fragrantica link are read, shown in the editor for checking, then published after confirmation. Pasting the link of a product that is already listed shows which details and prices changed.
- **Edit / update prices:** tap a product, change anything (prices are typed with thousand separators, testers are a toggle), Save → the confirmation sheet lists every change ("75 мл: 3 120 000 → 2 990 000 сум") and only "Confirm" writes it.
- **Hide or delete:** the visibility switch hides a product (reversible, listed under "Hidden"); "Delete fragrance" removes it for good (re-importing its post brings it back).
- **Photos:** when a product is saved, its channel photo is downloaded and stored in the database (`product_images`), so it keeps working after Telegram's CDN link expires. "Replace photo" uploads a photo from the phone.
- Orders (status changes, alert retry), statistics, customers (PDF) and store settings use the same confirm-before-save flow.

Migration `drizzle/0003_product_images_and_removals.sql` adds the photo and deletion tables; apply it like the earlier ones.

`preview/` builds a standalone page (shop + admin, demo data kept in the browser) for sharing without a server: `npx vite build --config preview/vite.config.mjs && python3 preview/catalog.py && node preview/inline.mjs`.

## Launch on Cloudflare

Needs Node 22.13+ and a Cloudflare account (the free plan is enough).

```sh
npm install
npx wrangler login            # once, opens the browser
npm run deploy                # asks for the bot token from @BotFather
```

`scripts/deploy.mjs` builds the app, creates the `fragranceuz-db` D1 database on the first run, applies every migration in `drizzle/`, deploys the Worker `fragranceuz`, stores the bot token as an encrypted Worker secret and connects the bot: webhook (`/api/telegram`), the "Магазин" menu button and `/start`. Owner `740597322` gets the admin and the order alerts; change with `OWNER_TELEGRAM_ID`, add admins with `ADMIN_TELEGRAM_IDS=111,222`, send alerts elsewhere with `ORDER_CHAT_ID`. Run `npm run deploy` again after any change.

After the first deploy, press **Start** in the bot from the owner account — Telegram lets a bot message you only after that.

## Orders in Telegram

- A new request arrives in the owner chat with the customer's name, phone, Telegram, address, items and total, and buttons **✅ Подтвердить / ❌ Отменить** plus **💬 Написать клиенту**.
- Approving (in the chat or in the admin) sends the owner a "Заказ подтверждён" card with the contacts for delivery and messages the customer in their language. Completing or cancelling also tells the customer.

## Client database in Google Sheets

Admin → Settings → «Google Таблица клиентов» connects a sheet on the owner's Google account; every request and client is then written there automatically (tabs «Заявки» and «Клиенты»), and «Выгрузить всех клиентов» uploads earlier ones. Setup steps and details: `google-sheets/README.md`; the script is `google-sheets/Code.gs`.

## Statistics

The Statistics tab (7 / 30 / 90 days): requested value with change vs the previous period, requests, average order, completed value, new customers, requests per day (chart or table), status split, view → bag → order funnel, best-selling fragrances, top houses and most-viewed products. Views and bag additions are anonymous daily counters (`product_events`, migration 0004).

## Current catalog

The public channel was refreshed for **28 April–28 October 2026**, Asia/Tashkent. The audit covers 574 messages across 29 pages, crossing the cutoff on a page dated 20 April. There are **539 catalog offers** from 543 priced posts after removing 4 exact older repeats. Distinct sizes, concentrations, testers, partial bottles and sets remain separate offers. 537 real source photos are stored locally; 2 posts have no image. 22 entries have no single matching scent link and 10 have no explicit release year; those fields remain empty. No substitute Fragrantica URLs, release years, stock counts or scent notes are invented.

`data/products.json` is the verified base catalog. `data/channel-refresh.json` records coverage. Existing persistent `product_overrides`, orders and shop settings take precedence and were preserved during the refresh. Original post timestamps remain source evidence; the customer-facing product facts show fragrance release year, not post date.

Budget tabs: up to 1,000,000 UZS, up to 2,500,000 UZS and Exclusive with no ceiling. Limits are inclusive and combine with audience, house, concentration, search and sorting. Cards, quick add and detail opening use the same cheapest bottle. The catalog initially renders 24 products and loads more on request; management renders 30 rows at a time.

## Demo and real management

- Storefront: `/`.
- Visible demo administration: `/demo`.
- Demo storefront reflecting demo changes: `/?demo=1`.
- Real administration: `/admin`, protected by verified Telegram identity.

Demo is enabled on localhost/127.0.0.1. To enable an intentionally hosted demo, configure runtime `DEMO_ENABLED=true`; leave it unset on a normal production launch. Demo products/settings use separate durable D1 tables. Demo APIs never return real customer records, orders or statistics, and cannot change real order states. Demo checkout simulates completion without sending an order or saving contact details.

Every management write requires explicit confirmation. Editing, hiding/showing products, shop settings and real order status changes use a review/confirm dialog. A channel import is previewed first and saved by **Confirm and publish**. Requests without the confirmation flag are rejected. Confirmed edits persist in D1 across reloads and process restarts. Unsaved editor changes and modified settings have discard protection.

Real management supports products, orders, statistics, customers with private Russian/Uzbek PDF export, and store contacts/delivery settings. Customer data and PDF require a verified owner/admin Telegram session. Usernames, client-supplied numeric IDs and shared browser keys cannot grant real access.

## Add a new offer by link

Choose **Add product**, paste an exact public `https://t.me/fragranceuz/<post-id>` URL and load the post. The app extracts its photo, title/brand, bottle sizes/prices, audience, concentration, explicit release year and matching linked scent page. Review the extracted details and confirm publication; it immediately becomes available in the corresponding storefront. Manual editing remains available. Missing source details are not guessed.

The server accepts only the expected channel, bounds response size/time, rejects redirects and validates the extracted product. Post text is treated as data. A Workers-compatible manual redirect policy rejects non-success responses. Private and unrelated URLs cannot be fetched through the importer.

For an audited batch refresh, `scripts/import-history.mjs` supports `--since`, `--until`, `--evidence`, `--audit`, `--cached`, `--no-images` and `--apply`. Without `--apply` it stages a proposal. A full previous seed backup is written before applying, and existing entries outside the imported period are preserved. It never updates admin/customer tables. There is no scheduled channel monitor; future single-post arrivals are imported by the admin link flow.

## Checkout and Telegram activation

Name, phone and address are required. Phone starts with +998; complete Uzbek numbers require 9 national digits, pasted formats normalize, and explicitly entered international numbers remain supported. Customers review their details before the final action. EDP/EDT and full concentration names stay English in both interface languages.

Real automatic checkout requires `DB`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ORDER_CHAT_ID`, inside a valid Telegram Mini App session. The server verifies HMAC/freshness, calculates current prices, checks the quoted total, limits quantities and uses idempotency. Failed Telegram alerts leave durable saved orders and support authorized retry. There is no online payment integration.

Before connection, ordinary checkout opens a complete, copyable draft in the configured manager chat. The customer sends it in Telegram; the draft alone does not create a database order/customer. Demo checkout never sends a real request.

Runtime secrets/configuration:

| Name | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Real @fragranceuz_bot token; still required for activation. |
| `TELEGRAM_BOT_USERNAME` | `fragranceuz_bot`. |
| `TELEGRAM_ORDER_CHAT_ID` | Supplied owner recipient ID, already configured in hosted secret settings. |
| `OWNER_TELEGRAM_ID` | Supplied owner numeric ID, already configured. |
| `ADMIN_TELEGRAM_IDS` | Explicitly authorized additional numeric IDs. |
| `DEMO_ENABLED` | Optional hosted demo flag; not required locally. |

Keep tokens out of source, public files and URLs. After HTTPS deployment, set the Mini App/menu URL in BotFather and verify actual owner login, product import/edit, customer order, alert delivery and PDF download. These real-bot checks remain pending the token.

## Development, persistence and checks

Requires Node>=22.13 and the provided Sites/Vinext runtime. Install dependencies, build and apply each pending schema migration in filename order; do not replay already-applied migrations. Schema changes are in `drizzle/`, including the new demo tables in `0002_smooth_silver_sable.sql`. Local and hosted databases are separate. Keep the local `.wrangler/state` directory to preserve local records; deployment applies pending hosted migrations through Sites.

```sh
npm ci
npm run build
# For each pending migration, replace FILE with its actual filename:
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/FILE.sql
npm run dev
```

Current verified preview is at `http://127.0.0.1:5175/` and demo admin at `/demo`. The older 5173 hot-reload process encountered a framework error and could not be stopped from the restricted session. A fresh production preview on 5175 uses the same durable database. On restricted macOS, the preview was launched with polling and a checkout-local Wrangler config directory:

```sh
CHOKIDAR_USEPOLLING=true CHOKIDAR_INTERVAL=1000 XDG_CONFIG_HOME=$PWD/.sites-runtime/config node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 5175 --inspector-port 0 --no-bundle --log-level warn
```

```sh
npx tsc --noEmit
node scripts/test-orders.mjs
STOREFRONT_TEST_URL=http://127.0.0.1:5175 node --test tests/api.test.mjs
```

Validation includes44 isolated checks and 4 live local API checks, plus a successful production build. The isolated tests cover imports, six-month coverage, source validation, access control, phone formatting, pricing, idempotency, reporting and durable demo/live saves across SQLite reconnects. Browser checks cover the real import preview/confirmation, canceled changes, confirmed visibility persistence, restored visibility after an actual server restart, and a 390px layout. No real order alert was sent.

## Assets and deployment

The original gold artwork is in `public/brand/fragranceuz-gold.svg`; product photos are channel assets in `public/products/`. The licensed embedded DejaVu report font and license files are retained. Source/build archives exclude credentials, customer databases, local tool state and synthetic UI fixtures.

`.openai/hosting.json` retains the existing Sites project ID and `DB` binding. Production publishing remains pending: an earlier automatic review rejected issuing repository write access because that access had not been explicitly approved. No credential retry or bypass was used. The local demo is available without the bot token.
