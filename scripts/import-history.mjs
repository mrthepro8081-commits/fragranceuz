#!/usr/bin/env node
/**
 * Verified channel seed refresh. Preserves a full backup and existing manual/out-of-period entries;
 * never writes admin overrides.
 *
 *   npm run import:channel                      every post since the channel began, then apply
 *   node scripts/import-history.mjs             last six months, proposal only (nothing applied)
 *   node scripts/import-history.mjs --since 2024-01-01 --apply
 *
 * Flags: --all (whole history), --since, --until, --apply, --cached (re-read saved pages),
 * --no-images, --evidence <dir>, --audit <file>. Needs normal internet access to t.me.
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const all = args.includes('--all');
const until = value('--until', new Date().toISOString().slice(0, 10));
const end = new Date(`${until}T23:59:59+05:00`);
const cutoffDate = new Date(`${until}T00:00:00+05:00`);
cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - 6);
const cutoff = all ? '2000-01-01T00:00:00Z' : value('--since', cutoffDate.toISOString());
const evidence = path.resolve(value('--evidence', path.join(app, '.channel-import')));
const output = path.resolve(value('--audit', path.join(evidence, 'channel-import-audit.json')));
const cached = args.includes('--cached');
const noImages = args.includes('--no-images');
const apply = args.includes('--apply');
const MAX_PAGES = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(evidence, { recursive: true });
const previousText = await readFile(path.join(app, 'data/products.json'), 'utf8');
const previous = JSON.parse(previousText);
await writeFile(path.join(evidence, `products-backup-${Date.now()}.json`), previousText);
const bundle = path.join(evidence, 'channel-parser.mjs');
await build({ entryPoints: [path.join(app, 'lib/channel-import.ts')], bundle: true, platform: 'node', format: 'esm', outfile: bundle });
const { parseChannelPage, fetchChannelHtml, fragranceIdentity } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());

/** Telegram throttles long scans; wait and retry instead of failing the whole import. */
async function fetchPage(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchChannelHtml(url);
    } catch (error) {
      if (attempt >= 6) throw error;
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(`  Telegram did not answer (${error.message}); retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

const found = new Map();
const audit = [];
const pages = [];
let before = null;
let historyEnd = false;
const visited = new Set();
for (let index = 0; index < MAX_PAGES; index++) {
  const filename = path.join(evidence, `${before ?? 'latest'}.html`);
  let html;
  if (cached) html = await readFile(filename, 'utf8').catch(() => '');
  else {
    if (index) await sleep(350);
    html = await fetchPage(`https://t.me/s/fragranceuz${before ? `?before=${before}` : ''}`);
    await writeFile(filename, html);
  }
  const page = parseChannelPage(html, { importedAt: until });
  if (!page.postIds.length) {
    // No older posts: the beginning of the channel. That completes an --all import.
    if (all && pages.length) {
      historyEnd = true;
      break;
    }
    throw new Error('Public history stopped before the requested cutoff.');
  }
  const next = Math.min(...page.postIds.map(Number));
  pages.push({ page: before ?? 'latest', firstId: next, lastId: Math.max(...page.postIds.map(Number)), oldestDate: page.oldestDate });
  for (const product of page.products)
    if (product.sourceDate && new Date(product.sourceDate) >= new Date(cutoff) && new Date(product.sourceDate) <= end) found.set(product.id, product);
  audit.push(...page.skipped);
  console.log(`Page ${index + 1}: ${page.postIds.length} posts, oldest ${page.oldestDate} · ${found.size} offers so far`);
  if (page.oldestDate && new Date(page.oldestDate) < new Date(cutoff)) break;
  if (next <= 1) {
    historyEnd = true;
    break;
  }
  if (visited.has(next) || index === MAX_PAGES - 1) throw new Error('Incomplete history: pagination limit reached.');
  visited.add(next);
  before = next;
}

const sorted = [...found.values()].sort((a, b) => Number(b.id) - Number(a.id));
const seen = new Map();
const products = [];
const duplicate = [];
for (const product of sorted) {
  const identity = fragranceIdentity(product);
  const latest = seen.get(identity);
  if (latest) {
    duplicate.push({ post: product.sourceUrl, retained: latest, reason: 'OLDER_REPEAT_SAME_FRAGRANCE_CONCENTRATION_AND_OFFER_VARIANTS' });
    continue;
  }
  seen.set(identity, product.sourceUrl);
  products.push(product);
}
const existingRetained = [];
const covered = new Set([...found.keys(), ...duplicate.map((d) => d.post.split('/').pop())]);
for (const product of previous) {
  if (!covered.has(product.id)) {
    products.push(product);
    existingRetained.push(product.id);
  }
}

const failedImages = [];
if (!noImages) {
  let next = 0, done = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < products.length) {
        const product = products[next++];
        if (!product.photoSource) continue;
        const file = path.join(app, 'public/products', `${product.id}.jpg`);
        try {
          await access(file);
          product.image = `/products/${product.id}.jpg`;
          continue;
        } catch {}
        try {
          const response = await fetch(product.photoSource, { signal: AbortSignal.timeout(20000), redirect: 'error' });
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Image unavailable');
          const data = new Uint8Array(await response.arrayBuffer());
          if (data.length > 8_000_000) throw new Error('Image too large');
          await writeFile(file, data);
          product.image = `/products/${product.id}.jpg`;
          if (++done % 50 === 0) console.log(`  ${done} new photos saved…`);
        } catch {
          failedImages.push(product.id);
          product.image = product.photoSource;
        }
      }
    }),
  );
}
products.sort((a, b) => Number(b.id) - Number(a.id));
await writeFile(path.join(evidence, 'products-proposed.json'), JSON.stringify(products, null, 2) + '\n');

const coverage = {
  pages: pages.length,
  newestPostId: pages[0].lastId,
  oldestScannedPostId: pages.at(-1).firstId,
  oldestScannedDate: pages.at(-1).oldestDate,
  cutoffReached: historyEnd || new Date(pages.at(-1).oldestDate) < new Date(cutoff),
  wholeHistory: all && historyEnd,
};
const report = {
  channel: 'https://t.me/fragranceuz',
  refreshedAt: new Date().toISOString(),
  requestedPeriod: { since: all ? 'channel start' : cutoff, through: until, timezone: 'Asia/Tashkent' },
  coverage,
  pricedOffersInPeriod: found.size,
  publishedProducts: products.length,
  olderRepeatedOffersRemoved: duplicate.length,
  existingEntriesPreserved: existingRetained,
  missingScentLinks: products.filter((p) => !p.fragranticaUrl).length,
  missingReleaseYears: products.filter((p) => !p.year).length,
  missingBrandSeparation: products.filter((p) => !p.brand).map((p) => ({ id: p.id, title: p.title })),
  imageDownloadFailures: failedImages,
  policy:
    'Latest exact offer repeat retained; differing concentrations, variants, testers, and partial bottles remain separate. Existing seed entries outside the imported scope and all admin overrides are untouched. Previous seed backed up before refresh. Older channel prices are offers, not live stock guarantees. Scent links are copied only when linked and not obviously mismatched. Release years come only from the explicit aroma release-year field.',
  pages,
  warningsAndSkipped: audit,
  skippedNonOffers: audit.filter((a) => ['NO_TEXT', 'NO_UNAMBIGUOUS_VOLUME_PRICE'].includes(a.reason)),
  includedWarnings: audit.filter((a) => !['NO_TEXT', 'NO_UNAMBIGUOUS_VOLUME_PRICE'].includes(a.reason) && products.some((p) => p.sourceUrl === 'https://t.me/' + a.post)),
  duplicates: duplicate,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');

if (apply) {
  if (!report.coverage.cutoffReached) throw new Error('Refusing incomplete refresh');
  if (previous.some((p) => !products.some((n) => n.id === p.id) && !duplicate.some((d) => d.post === p.sourceUrl)))
    throw new Error('Existing seed entry would be lost without recorded replacement');
  await writeFile(path.join(app, 'data/products.json'), JSON.stringify(products, null, 2) + '\n');
  await writeFile(
    path.join(app, 'data/channel-refresh.json'),
    JSON.stringify(
      {
        channel: report.channel,
        refreshedAt: report.refreshedAt,
        period: report.requestedPeriod,
        coverage: report.coverage,
        products: products.length,
        missingScentLinks: report.missingScentLinks,
        missingReleaseYears: report.missingReleaseYears,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify({
    applied: apply,
    products: products.length,
    pricedOffers: found.size,
    duplicates: duplicate.length,
    nullScent: report.missingScentLinks,
    missingBrands: report.missingBrandSeparation.length,
    failedImages: failedImages.length,
    audit: path.relative(app, output),
  }),
);
