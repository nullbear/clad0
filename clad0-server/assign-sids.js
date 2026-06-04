'use strict';
/*
 * assign-sids.js — one-time, additive, reversible.
 *
 * Stamps every entry with an immutable stable id (`sid`, format k000001) if it
 * doesn't already have one, so the entry can be a rename-safe crosslink target.
 * It does NOT move files, change slugs, or touch any other field. clado.json is
 * backed up first; re-running only fills gaps (idempotent).
 *
 * Also prints any duplicate slugs it finds (a read-only sanity report).
 *
 * Usage (from clad0-server, with the server stopped):  node assign-sids.js
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data', 'clado.json');
const raw = fs.readFileSync(DATA, 'utf8');
const root = JSON.parse(raw);

let seq = 0;
const slugCounts = {};
(function scan(n){ if (!n) return;
  slugCounts[n.id] = (slugCounts[n.id] || 0) + 1;
  const m = /^k(\d+)$/.exec(n.sid || '');
  if (m) seq = Math.max(seq, parseInt(m[1], 10));
  (n.c || []).forEach(scan);
})(root);

let added = 0;
(function assign(n){ if (!n) return;
  if (!n.sid) { seq += 1; n.sid = 'k' + String(seq).padStart(6, '0'); added += 1; }
  (n.c || []).forEach(assign);
})(root);

const dupSlugs = Object.entries(slugCounts).filter(([, c]) => c > 1);
if (dupSlugs.length) {
  console.log('[assign-sids] ⚠ duplicate slugs found (fix these — they confuse lookups/files):');
  dupSlugs.forEach(([slug, c]) => console.log('    ' + slug + '  ×' + c));
} else {
  console.log('[assign-sids] no duplicate slugs found.');
}

if (!added) { console.log('[assign-sids] every entry already has a stable id — nothing to write.'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(DATA + '.backup-' + stamp + '.json', raw);
fs.writeFileSync(DATA, JSON.stringify(root));
console.log('[assign-sids] assigned ' + added + ' stable ids (backup: clado.json.backup-' + stamp + '.json).');
console.log('[assign-sids] restart the server to load them.');
