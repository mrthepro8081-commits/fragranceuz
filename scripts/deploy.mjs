// One-command deploy to your own Cloudflare account.
//
//   npx wrangler login        (once; or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
//   npm run deploy
//
// Builds the app, creates the D1 database (first run), applies migrations, deploys the Worker,
// stores the bot token as an encrypted Worker secret and connects the Telegram bot
// (webhook, menu button, /start). Safe to run again for every update.
//
// Settings (environment variables, all optional):
//   TELEGRAM_BOT_TOKEN   asked interactively when missing; never written to disk
//   OWNER_TELEGRAM_ID    defaults to 740597322
//   ADMIN_TELEGRAM_IDS   comma-separated extra admins
//   ORDER_CHAT_ID        where order alerts go; defaults to the owner
//   WORKER_NAME          defaults to fragranceuz
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const WORKER = process.env.WORKER_NAME || 'fragranceuz';
const DB_NAME = `${WORKER}-db`;
const OWNER = process.env.OWNER_TELEGRAM_ID || '740597322';
const CONFIG = new URL('dist/server/wrangler.deploy.json', ROOT);
// A file path, not URL.pathname, so the command also works on Windows (C:\...).
const CONFIG_PATH = fileURLToPath(CONFIG);

function run(args, { input, capture = true } = {}) {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
    cwd: fileURLToPath(ROOT), input, encoding: 'utf8', stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'], env: { ...process.env, CI: '1' },
  });
  if (result.status !== 0) {
    console.error(result.stdout || '', result.stderr || '');
    throw new Error(`wrangler ${args[0]} failed`);
  }
  return result.stdout || '';
}
function step(text) {
  console.log(`\n▸ ${text}`);
}
async function telegram(token, method, payload = {}) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const d = await r.json();
  if (!d.ok) throw new Error(`Telegram ${method}: ${d.description}`);
  return d.result;
}

step('Checking Cloudflare login');
console.log(run(['whoami']).split('\n').filter((l) => /logged in|account/i.test(l)).slice(0, 3).join('\n') || 'ok');

let token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  token = (await rl.question('Telegram bot token from @BotFather: ')).trim();
  rl.close();
}
if (!/^\d+:[\w-]{30,}$/.test(token)) throw new Error('That does not look like a bot token (format 123456789:AA...).');
const bot = await telegram(token, 'getMe');
console.log(`Bot: @${bot.username}`);

step('Building');
const build = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], { cwd: fileURLToPath(ROOT), stdio: 'inherit' });
if (build.status !== 0) throw new Error('Build failed');

step(`Database ${DB_NAME}`);
const find = () => JSON.parse(run(['d1', 'list', '--json'])).find((d) => d.name === DB_NAME);
let db = find();
if (!db) {
  run(['d1', 'create', DB_NAME]);
  db = find();
  console.log('created', db.uuid);
} else console.log('exists', db.uuid);

const base = JSON.parse(fs.readFileSync(new URL('dist/server/wrangler.json', ROOT), 'utf8'));
delete base.dev;
delete base.topLevelName;
const config = {
  ...base,
  name: WORKER,
  d1_databases: [{ binding: 'DB', database_name: DB_NAME, database_id: db.uuid, migrations_dir: '../../drizzle' }],
  vars: {
    ...base.vars,
    OWNER_TELEGRAM_ID: OWNER,
    TELEGRAM_ORDER_CHAT_ID: process.env.ORDER_CHAT_ID || OWNER,
    ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || '',
    TELEGRAM_BOT_USERNAME: bot.username,
  },
};
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));

step('Applying database migrations');
run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', CONFIG_PATH], { input: 'y\n', capture: false });

step('Deploying');
const output = run(['deploy', '--config', CONFIG_PATH]);
const url = output.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
console.log(output.split('\n').filter((l) => /workers\.dev|Uploaded|Deployed/.test(l)).join('\n'));
if (!url) throw new Error('Deployed, but the workers.dev address was not found in the output. Enable workers.dev for the Worker in the Cloudflare dashboard and run again.');

step('Saving the bot token as a Worker secret');
run(['secret', 'put', 'TELEGRAM_BOT_TOKEN', '--config', CONFIG_PATH], { input: token });

step('Connecting the Telegram bot');
const secret = createHash('sha256').update('fragranceuz-webhook:' + token).digest('hex').slice(0, 48);
await telegram(token, 'setWebhook', { url: `${url}/api/telegram`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
await telegram(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url } } });
await telegram(token, 'setMyCommands', { commands: [{ command: 'start', description: 'Открыть магазин Fragrance UZ' }] });

console.log(`
✓ Live at ${url}

Next, in Telegram:
  1. Open @${bot.username} from the owner account (${OWNER}) and press Start — the bot can only message you after that.
     You will see "Открыть магазин" and "⚙️ Управление магазином".
  2. Optional, for links in channel posts: @BotFather → /newapp → @${bot.username} → URL ${url} → short name "shop".
     Then https://t.me/${bot.username}/shop opens the shop, and …/shop?startapp=<post id> opens one perfume.
`);
