#!/usr/bin/env node
// rebuild.js — Rebuilds the posts manifest in index.html from post-*.html files
// Usage: node rebuild.js
//
// Each post-*.html file must contain:
//   <script type="application/json" id="post-meta">{ ...metadata... }</script>
//
// index.html must contain the markers:
//   <!-- POSTS:START --> and <!-- POSTS:END -->

'use strict';

const fs   = require('fs');
const path = require('path');
const dir  = __dirname;

// ── 1. Collect post files ───────────────────────────────────────
const postFiles = fs.readdirSync(dir)
  .filter(f => /^post-[a-z0-9-]+\.html$/.test(f))
  .sort();

if (postFiles.length === 0) {
  console.log('No post-*.html files found. Nothing to do.');
  process.exit(0);
}

// ── 2. Extract metadata from each file ─────────────────────────
const posts = [];

for (const file of postFiles) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const match = html.match(/<script[^>]+type="application\/json"[^>]+id="post-meta"[^>]*>([\s\S]*?)<\/script>/);

  if (!match) {
    console.warn(`  ⚠  No post-meta found in ${file} — skipping`);
    continue;
  }

  try {
    const meta = JSON.parse(match[1].trim());
    meta.file  = meta.file || file;
    posts.push(meta);
    console.log(`  ✓  ${file}`);
  } catch (err) {
    console.warn(`  ⚠  Could not parse post-meta in ${file}: ${err.message}`);
  }
}

if (posts.length === 0) {
  console.log('No parseable post metadata found.');
  process.exit(0);
}

// ── 3. Sort by post number ─────────────────────────────────────
posts.sort((a, b) => {
  const na = parseInt(String(a.number).replace(/\D/g, ''), 10) || 999;
  const nb = parseInt(String(b.number).replace(/\D/g, ''), 10) || 999;
  return na - nb;
});

// ── 4. Generate posts manifest HTML ────────────────────────────
function pad(n) {
  return String(n || '').padStart(2, '0');
}

const postsHtml = posts.map(p => `      <a class="post-row reveal" href="${p.file}">
        <div class="post-row-num">${pad(p.number)}</div>
        <div class="post-row-category">${(p.category || '').replace(' ', '<br>')}</div>
        <div class="post-row-content">
          <h2 class="post-row-title">${p.title || ''}</h2>
          <p class="post-row-excerpt">${p.excerpt || ''}</p>
        </div>
        <div class="post-row-meta">
          <div class="post-row-author">${p.author || ''}</div>
          <span class="post-row-read">Read →</span>
        </div>
      </a>`).join('\n\n');

// ── 5. Inject into index.html ───────────────────────────────────
const indexPath   = path.join(dir, 'index.html');
let   indexHtml   = fs.readFileSync(indexPath, 'utf8');

const START = '<!-- POSTS:START -->';
const END   = '<!-- POSTS:END -->';
const si    = indexHtml.indexOf(START);
const ei    = indexHtml.indexOf(END);

if (si === -1 || ei === -1) {
  console.error('\n  ✗  Could not find <!-- POSTS:START --> or <!-- POSTS:END --> in index.html');
  console.error('     Add these markers around the post rows in the manifest section.\n');
  process.exit(1);
}

const before  = indexHtml.slice(0, si + START.length);
const after   = indexHtml.slice(ei);
indexHtml     = `${before}\n\n${postsHtml}\n\n      ${after}`;

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`\n  ✓  Updated index.html with ${posts.length} post${posts.length !== 1 ? 's' : ''}\n`);
