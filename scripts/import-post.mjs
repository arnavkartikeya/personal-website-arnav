#!/usr/bin/env node
/**
 * Copies a post from the local Lexical editor into the site.
 *
 *   npm run import-post -- <post.json | folder> --slug my-post
 *       [--description "…"] [--tags "rl, distillation"] [--date 2026-10-28] [--draft | --no-draft]
 *
 * Input is the editor's post record ({ title, subtitle, state, coverImage, … })
 * with its images next to it in images/<id>.<ext>, the layout the editor's
 * working copy uses. Output:
 *
 *   src/content/blog/<slug>/post.json   metadata + the Lexical state (source of truth)
 *   public/blog/<slug>/<id>.webp        images, resized and compressed
 *
 * Re-running it for the same slug updates the post and keeps the metadata you
 * set before (description, tags, date, draft) unless you pass new values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_WIDTH = { body: 1600, cover: 2400 };

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

function parseArgs(argv) {
  const opts = { source: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--draft') opts.draft = true;
    else if (arg === '--no-draft') opts.draft = false;
    else if (arg.startsWith('--')) {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      opts[arg.slice(2)] = value;
    } else opts.source = arg;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.source || !opts.slug) {
  fail('usage: npm run import-post -- <post.json | folder> --slug my-post [--description …] [--tags a,b] [--date YYYY-MM-DD] [--draft]');
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.slug)) fail('--slug must be lowercase-kebab-case, e.g. understanding-opd');
if (opts.date && Number.isNaN(Date.parse(opts.date))) fail(`--date "${opts.date}" isn't a date (use YYYY-MM-DD)`);

const sourceFile = fs.statSync(opts.source).isDirectory() ? path.join(opts.source, 'post.json') : opts.source;
const imagesDir = path.join(path.dirname(sourceFile), 'images');
const record = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const state = typeof record.state === 'string' ? JSON.parse(record.state) : record.state;
if (!state?.root) fail(`${sourceFile} has no Lexical state`);

const contentDir = path.join(ROOT, 'src/content/blog', opts.slug);
const publicDir = path.join(ROOT, 'public/blog', opts.slug);
const targetFile = path.join(contentDir, 'post.json');
const previous = fs.existsSync(targetFile) ? JSON.parse(fs.readFileSync(targetFile, 'utf8')) : {};

/* ---- images ---- */

const LOCAL = 'localimg:';
const written = new Set();

async function convertImage(src, kind) {
  if (typeof src !== 'string' || !src.startsWith(LOCAL)) return src; // remote URLs pass through
  const id = src.slice(LOCAL.length);
  const match = fs.existsSync(imagesDir) && fs.readdirSync(imagesDir).find((f) => path.parse(f).name === id);
  if (!match) fail(`image ${id} isn't in ${imagesDir}`);
  const out = `${id}.webp`;
  if (!written.has(out)) {
    const input = path.join(imagesDir, match);
    const animated = /\.gif$/i.test(match);
    await sharp(input, { animated })
      .resize({ width: MAX_WIDTH[kind], withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toFile(path.join(publicDir, out));
    written.add(out);
  }
  return out;
}

async function rewriteImages(node) {
  if (node.type === 'image') node.src = await convertImage(node.src, 'body');
  for (const child of node.children ?? []) await rewriteImages(child);
}

fs.mkdirSync(contentDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
await rewriteImages(state.root);
const cover = record.coverImage ? await convertImage(record.coverImage, 'cover') : undefined;

// Drop images left over from an earlier import that the post no longer uses.
for (const file of fs.readdirSync(publicDir)) {
  if (!written.has(file)) fs.rmSync(path.join(publicDir, file));
}

/* ---- metadata ---- */

const today = new Date().toISOString().slice(0, 10);
const title = String(record.title ?? '').trim();
const description = (opts.description ?? previous.description ?? String(record.subtitle ?? '')).trim();
if (!title) fail('the post has no title');
if (!description) fail('the post has no subtitle; pass --description "…"');

const post = {
  title,
  description,
  date: opts.date ?? previous.date ?? today,
  ...(previous.date && !opts.date && previous.date !== today ? { updated: today } : {}),
  tags: opts.tags !== undefined ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : (previous.tags ?? []),
  draft: opts.draft ?? previous.draft ?? false,
  ...(cover ? { cover } : {}),
  ...(previous.coverAlt ? { coverAlt: previous.coverAlt } : {}),
  lexical: state,
};
fs.writeFileSync(targetFile, JSON.stringify(post, null, 2) + '\n');

const kb = (f) => Math.round(fs.statSync(path.join(publicDir, f)).size / 1024);
console.log(`✓ Imported "${title}"`);
console.log(`  ${path.relative(ROOT, targetFile)}`);
for (const f of written) console.log(`  ${path.relative(ROOT, path.join(publicDir, f))} (${kb(f)} KB)`);
console.log(`\n  date ${post.date}${post.updated ? `, updated ${post.updated}` : ''} · tags: ${post.tags.join(', ') || '(none)'} · ${post.draft ? 'DRAFT' : 'will publish'}`);
console.log(`\nPreview with npm run dev → /blog/${opts.slug}, then npm run publish.`);
