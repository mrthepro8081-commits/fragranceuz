#!/usr/bin/env node
/**
 * Imports a saved channel archive instead of reading t.me live:
 *
 *   node scripts/import-archive.mjs <archive folder> [--apply]
 *
 * The folder holds posts.json ([{id, date, text, links, photo}], as exported for this store) and
 * photos/<id>.jpg. Posts are turned into the same page markup t.me/s serves and run through
 * scripts/import-history.mjs --all --cached, so prices, brands and repeats follow exactly the
 * same rules as a live import. Photos are copied only for products that have none yet, so the
 * existing (sharper) photos are kept. Without --apply it only reports (no files change).
 */
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [folder] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
if (!folder) throw new Error('Usage: node scripts/import-archive.mjs <archive folder> [--apply]');
const archive = path.resolve(folder);
const posts = JSON.parse(await readFile(path.join(archive, 'posts.json'), 'utf8'));
if (!Array.isArray(posts) || !posts.every((p) => Number.isInteger(Number(p.id)) && typeof p.date === 'string' && typeof p.text === 'string'))
  throw new Error('posts.json must be an array of {id, date, text, links, photo}');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
let copied = 0;
const blocks = [];
for (const post of [...posts].sort((a, b) => Number(b.id) - Number(a.id))) {
  const id = String(post.id);
  if (!/^\d{1,16}$/.test(id)) continue;
  let photo = '';
  if (post.photo) {
    const source = path.join(archive, post.photo);
    if (!source.startsWith(archive + path.sep) || !/\.jpe?g$/i.test(source)) throw new Error(`Unexpected photo path for post ${id}`);
    const target = path.join(app, 'public/products', `${id}.jpg`);
    const exists = await access(target).then(() => true, () => false);
    if (!exists && apply) {
      await copyFile(source, target);
      copied++;
    }
    // The parser only accepts Telegram CDN photo links; the file is already in place, so it is never fetched.
    photo = `<a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.telesco.pe/file/archive-${id}.jpg')"></a>`;
  }
  const links = (Array.isArray(post.links) ? post.links : []).filter((l) => typeof l === 'string').map((l) => `<a href="${attr(l)}"></a>`).join('');
  blocks.push(
    `<div class="tgme_widget_message_wrap"><div data-post="fragranceuz/${id}">${photo}` +
      `<div class="tgme_widget_message_text js-message_text">${escape(post.text).replace(/\n/g, '<br>')}${links}</div>` +
      `<time datetime="${attr(post.date)}"></time></div></div>`,
  );
}

const evidence = path.join(app, '.channel-import', 'archive');
await rm(evidence, { recursive: true, force: true });
await mkdir(evidence, { recursive: true });
await writeFile(path.join(evidence, 'latest.html'), blocks.join('\n'));
console.log(`${blocks.length} posts prepared, ${copied} new photos copied`);

const result = spawnSync(
  process.execPath,
  [path.join(app, 'scripts/import-history.mjs'), '--all', '--cached', '--evidence', evidence, ...(apply ? ['--apply'] : ['--no-images'])],
  { cwd: app, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
