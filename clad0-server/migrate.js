#!/usr/bin/env node
/**
 * clad0 — one-shot prose migration
 *
 *   node migrate.js
 *
 * Moves the bulk prose fields out of data/clado.json into per-node files
 * data/prose/<id>.json, leaving a slim structural tree behind. A timestamped
 * backup of clado.json is written first. Safe to re-run: nodes already slim
 * are left as-is, and existing detail files are merged rather than clobbered.
 *
 * You do NOT have to run this — the server migrates each node the first time it
 * is saved. This is just the "do it all now" option.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'clado.json');
const PROSE_DIR = path.join(__dirname, 'data', 'prose');

const DETAIL_KEYS = new Set([
  'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background', 'g', 'note',
]);

function detailPath(id) {
  return path.join(PROSE_DIR, encodeURIComponent(String(id)) + '.json');
}

function readExistingDetail(id) {
  try { return JSON.parse(fs.readFileSync(detailPath(id), 'utf8')); }
  catch { return {}; }
}

function writeDetail(id, obj) {
  const p = detailPath(id);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, p);
}

const root = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Backup first.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(path.dirname(DATA_FILE), `clado.backup-${stamp}.json`);
fs.copyFileSync(DATA_FILE, backup);
console.log(`[migrate] backup written → ${backup}`);

fs.mkdirSync(PROSE_DIR, { recursive: true });

let migrated = 0, skipped = 0, total = 0;

function walk(node) {
  if (!node || !node.id) return;
  total++;

  const detail = readExistingDetail(node.id);
  let moved = false;

  for (const k of DETAIL_KEYS) {
    if (k in node) {
      detail[k] = node[k];
      delete node[k];
      moved = true;
    }
  }

  if (moved) {
    writeDetail(node.id, detail);
    migrated++;
  } else if (Object.keys(detail).length) {
    writeDetail(node.id, detail);
    skipped++;
  } else {
    skipped++;
  }

  for (const child of (node.c || [])) walk(child);
}

walk(root);

const tmp = DATA_FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(root), 'utf8');
fs.renameSync(tmp, DATA_FILE);

const slimBytes = fs.statSync(DATA_FILE).size;
console.log(`[migrate] nodes: ${total} | wrote prose for: ${migrated} | already slim: ${skipped}`);
console.log(`[migrate] slim tree is now ${(slimBytes / 1024).toFixed(0)} KB`);
console.log('[migrate] done.');
