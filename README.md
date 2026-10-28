# Fragrance UZ Telegram Mini App

Russian and Uzbek storefront for @fragranceuz, with an original transparent gold logo, bold Apple/system typography and warm light/dark themes. About contains store information and social/contact links; appearance controls are kept out of that section. The catalog comes first, without a large welcome or arrivals block.

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
