#!/usr/bin/env node
/**
 * clad0 — Field Journal of the Throat
 * Node.js server
 *
 * Usage:
 *   node server.js              → listens on port 3000
 *   PORT=8080 node server.js
 *
 * Routes:
 *   GET    /                    → shell HTML
 *   GET    /style.css           → extracted stylesheet
 *   GET    /viewer.js           → viewer application JS
 *   GET    /api/clado           → full CLADO tree as JSON (slim once migrated)
 *   GET    /api/node/:id        → single node, assembled (slim node + prose detail)
 *   PUT    /api/node/:id        → update a node's fields (prose routed to detail file)
 *   POST   /api/node            → append a new node as child of a given parent
 *   POST   /api/node/:id/move   → move/reparent + reorder an existing node
 *   POST   /api/node/:id/reorder→ reorder the children of :id to a given order
 *   DELETE /api/node/:id        → remove a node and its subtree (+ its detail files)
 *
 * Data storage:
 *   data/clado.json       → the taxonomy tree (structure + light metadata)
 *   data/prose/<id>.json  → per-node bulk prose ("detail"), created on demand
 *
 * Transitional behaviour:
 *   - READ  of a node: if data/prose/<id>.json exists → prose comes from it (new
 *     behaviour); if not → prose is read inline from the tree node (legacy).
 *   - WRITE of a node: prose is written to data/prose/<id>.json, creating it if
 *     absent, and stripped from the tree node so the tree stays slim. This means
 *     an un-migrated megatree keeps working untouched and migrates node-by-node
 *     the first time each entry is saved. (Or migrate everything with migrate.js.)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = path.join(__dirname, 'data', 'clado.json');
const PROSE_DIR = path.join(__dirname, 'data', 'prose');
const STATS_DIR = path.join(__dirname, 'data', 'stats');   // monster stat sheets (per id)
const MEDIA_DIR = path.join(__dirname, 'data', 'media');   // image graphics (per id)
const PUBLIC = path.join(__dirname, 'public');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB cap on uploaded image graphics
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

let ROOT = null;
let nodeMap = {};

function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  ROOT = JSON.parse(raw);
  rebuildIndex();
  console.log(`[clad0] loaded ${Object.keys(nodeMap).length} nodes from ${DATA_FILE}`);
}

function rebuildIndex() {
  nodeMap = {};
  indexTree(ROOT);
}

function indexTree(node) {
  if (!node || !node.id) return;
  nodeMap[node.id] = node;
  for (const child of (node.c || [])) indexTree(child);
}

function saveData() {
  const tmp = DATA_FILE + '.tmp';
  const json = JSON.stringify(ROOT);
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

/* ── EDITABLE / DETAIL FIELD CLASSIFICATION ───────────────────────────────── */

// All keys the API will accept on a write (existing allowlist; unchanged).
const PROSE_KEYS = new Set([
  'n', 'r', 'sn', 'g', 'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background',
  'note', 'conv', 't', 'gorge', 'ctx', 'fossil', 'theorized', 'curse', 'tag',
  'rankMismatch', 'expectedRank', 'hierarchicalRankPosition', 'css', 'flags', 'staleExempt', 'revised', '_kg',
]);

// The subset of those that carry the data *bulk*. These live in per-node detail
// files and are stripped from the tree. Everything the index/search/filters need
// (n, r, sn, c, gorge, ctx, theorized, fossil, curse, conv, tag, rankMismatch…)
// is deliberately NOT here, so the slim tree fully drives the index.
const DETAIL_KEYS = new Set([
  'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background', 'g', 'note',
]);

function detailPath(id) {
  return path.join(PROSE_DIR, encodeURIComponent(String(id)) + '.json');
}

function hasDetail(id) {
  try { return fs.existsSync(detailPath(id)); } catch { return false; }
}

function readDetail(id) {
  try { return JSON.parse(fs.readFileSync(detailPath(id), 'utf8')); }
  catch { return {}; }
}

function writeDetail(id, detailObj) {
  fs.mkdirSync(PROSE_DIR, { recursive: true });
  const p = detailPath(id);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(detailObj), 'utf8');
  fs.renameSync(tmp, p);
}

function deleteDetail(id) {
  try { fs.unlinkSync(detailPath(id)); } catch { /* nothing to remove */ }
}

/* ── ATTACHMENTS: stat sheets + image graphics ────────────────────────────── */

function statsPath(id) {
  return path.join(STATS_DIR, encodeURIComponent(String(id)) + '.json');
}

function hasStats(id) {
  try { return fs.existsSync(statsPath(id)); } catch { return false; }
}

function readStats(id) {
  try { return JSON.parse(fs.readFileSync(statsPath(id), 'utf8')); }
  catch { return null; }
}

function writeStats(id, obj) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
  const p = statsPath(id);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, p);
}

function deleteStats(id) {
  try { fs.unlinkSync(statsPath(id)); } catch { /* nothing to remove */ }
}

// Images come in two kinds:
//   'monster' (species icon)   → MEDIA_DIR/<id>.<ext>
//   'banner'  (any entry)      → MEDIA_DIR/<id>__banner.<ext>
// A fixed id keeps the on-disk name stable so re-uploads overwrite cleanly.
const BANNER_IDEAL_WIDTH = 1442;

function imageBase(id, kind) {
  return encodeURIComponent(String(id)) + (kind === 'banner' ? '__banner' : '');
}

function imageExt(id, kind) {
  for (const ext of IMAGE_EXT) {
    if (fs.existsSync(path.join(MEDIA_DIR, imageBase(id, kind) + '.' + ext))) return ext;
  }
  return null;
}

function imagePath(id, kind, ext) {
  return path.join(MEDIA_DIR, imageBase(id, kind) + '.' + ext);
}

function deleteImage(id, kind) {
  for (const ext of IMAGE_EXT) {
    try { fs.unlinkSync(imagePath(id, kind, ext)); } catch { /* ignore */ }
  }
}

// Minimal image dimension reader for the formats contributors use (png/webp/
// gif/jpeg). Returns { w, h } or null. Used mainly to validate banner width.
function imageSize(buf, ext) {
  try {
    if (ext === 'png' && buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (ext === 'gif' && buf.length >= 10) {
      return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    }
    if ((ext === 'jpg' || ext === 'jpeg') && buf[0] === 0xFF && buf[1] === 0xD8) {
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xFF) { o++; continue; }
        const m = buf[o + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
        }
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
    if (ext === 'webp' && buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF'
        && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fourcc = buf.toString('ascii', 12, 16);
      if (fourcc === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (fourcc === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3FFF, h: buf.readUInt16LE(28) & 0x3FFF };
      if (fourcc === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { w: (b & 0x3FFF) + 1, h: ((b >> 14) & 0x3FFF) + 1 };
      }
    }
  } catch { /* fall through */ }
  return null;
}

// Build the lightweight indicator map the tree uses: which nodes have chunked
// prose (+ its byte size), a stat sheet, and/or an image. Derived purely from
// the filesystem so there are no stored flags to drift out of sync.
function buildMeta() {
  const out = {};
  const bump = (id, patch) => { (out[id] || (out[id] = {})); Object.assign(out[id], patch); };

  const ids = base => {
    try { return fs.readdirSync(base); } catch { return []; }
  };

  for (const f of ids(PROSE_DIR)) {
    if (!f.endsWith('.json')) continue;
    const id = decodeURIComponent(f.slice(0, -5));
    let bytes = 0;
    try { bytes = fs.statSync(path.join(PROSE_DIR, f)).size; } catch {}
    bump(id, { chunked: true, bytes });
  }
  for (const f of ids(STATS_DIR)) {
    if (!f.endsWith('.json')) continue;
    bump(decodeURIComponent(f.slice(0, -5)), { stats: true });
  }
  for (const f of ids(MEDIA_DIR)) {
    const dot = f.lastIndexOf('.');
    if (dot < 0) continue;
    const ext = f.slice(dot + 1).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const stem = f.slice(0, dot);
    let bytes = 0; let buf = null;
    try { buf = fs.readFileSync(path.join(MEDIA_DIR, f)); bytes = buf.length; } catch {}
    const dims = buf ? imageSize(buf, ext) : null;
    if (stem.endsWith('__banner')) {
      const id = decodeURIComponent(stem.slice(0, -'__banner'.length));
      bump(id, {
        banner: ext, bannerBytes: bytes,
        bannerW: dims ? dims.w : null, bannerH: dims ? dims.h : null,
        bannerWarn: dims ? (dims.w !== BANNER_IDEAL_WIDTH) : true,
      });
    } else {
      const id = decodeURIComponent(stem);
      bump(id, { img: ext, imgBytes: bytes, imgW: dims ? dims.w : null, imgH: dims ? dims.h : null });
    }
  }
  return out;
}

// Pull any DETAIL_KEYS currently sitting inline on a tree node (legacy state).
function inlineDetail(node) {
  const out = {};
  for (const k of DETAIL_KEYS) if (k in node) out[k] = node[k];
  return out;
}

// Remove DETAIL_KEYS from a tree node so the tree stays slim.
function stripDetail(node) {
  for (const k of DETAIL_KEYS) if (k in node) delete node[k];
}

// Build the object sent to the client for a single node: the slim tree node's
// own fields, plus prose from the detail file when present, else whatever prose
// is still inline (legacy). Children are intentionally omitted — the client
// already holds tree structure from /api/clado.
function assembleNode(node) {
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'c') continue;
    out[k] = v;
  }
  if (hasDetail(node.id)) Object.assign(out, readDetail(node.id));
  const ext = imageExt(node.id, 'monster');
  if (ext) out.img = ext;            // species icon (filesystem-derived)
  const bext = imageExt(node.id, 'banner');
  if (bext) out.banner = bext;       // banner image (any entry)
  if (hasStats(node.id)) out.hasStats = true;
  return out;
}

// Ensure a node's prose is externalised: merge (existing file ∪ inline) ∪ updates,
// write the detail file (creating it if absent), then strip prose from the tree.
function persistDetail(node, updates) {
  const detail = hasDetail(node.id) ? readDetail(node.id) : inlineDetail(node);
  if (updates) {
    for (const [k, v] of Object.entries(updates)) detail[k] = v;
  }
  // Only keep recognised detail keys in the file.
  for (const k of Object.keys(detail)) {
    if (!DETAIL_KEYS.has(k)) delete detail[k];
  }
  writeDetail(node.id, detail);
  stripDetail(node);
}

/* ── TREE HELPERS (unchanged) ─────────────────────────────────────────────── */

function findParent(root, targetId) {
  if (!root) return null;

  for (let i = 0; i < (root.c || []).length; i++) {
    const child = root.c[i];
    if (child.id === targetId) return { parent: root, index: i };

    const found = findParent(child, targetId);
    if (found) return found;
  }

  return null;
}

function isDescendant(ancestor, possibleDescendantId) {
  if (!ancestor) return false;

  for (const child of (ancestor.c || [])) {
    if (child.id === possibleDescendantId) return true;
    if (isDescendant(child, possibleDescendantId)) return true;
  }

  return false;
}

function slugifyId(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueId(base) {
  const stem = slugifyId(base) || 'new-entry';
  if (!nodeMap[stem]) return stem;

  let i = 2;
  while (nodeMap[`${stem}-${i}`]) i++;
  return `${stem}-${i}`;
}

function removeFromIndex(node) {
  if (!node || !node.id) return;
  delete nodeMap[node.id];
  for (const child of (node.c || [])) removeFromIndex(child);
}

// Collect ids of a node and all descendants (used to clean up detail files).
function collectIds(node, out = []) {
  if (!node || !node.id) return out;
  out.push(node.id);
  for (const child of (node.c || [])) collectIds(child, out);
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function send(res, status, contentType, body) {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache',
  });
  res.end(buf);
}

function sendJSON(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJSON(req, res) {
  try {
    return JSON.parse(await readBody(req));
  } catch (e) {
    sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message });
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();
  const pname = url.pathname;

  if (method === 'GET' && pname.startsWith('/media/')) {
    const file = decodeURIComponent(pname.slice('/media/'.length)).replace(/\.\./g, '');
    const filepath = path.join(MEDIA_DIR, file);
    const ext = path.extname(filepath);
    try {
      const content = fs.readFileSync(filepath);
      send(res, 200, MIME[ext] || 'application/octet-stream', content);
    } catch {
      send(res, 404, 'text/plain; charset=utf-8', `Not found: ${file}`);
    }
    return;
  }

  if (method === 'GET' && !pname.startsWith('/api/')) {
    const target = pname === '/' ? '/index.html' : pname;
    const filepath = path.join(PUBLIC, target.replace(/\.\./g, ''));
    const ext = path.extname(filepath);

    try {
      const content = fs.readFileSync(filepath);
      send(res, 200, MIME[ext] || 'application/octet-stream', content);
    } catch {
      send(res, 404, 'text/plain; charset=utf-8', `Not found: ${target}`);
    }
    return;
  }

  if (method === 'GET' && pname === '/api/clado') {
    send(res, 200, 'application/json; charset=utf-8', fs.readFileSync(DATA_FILE));
    return;
  }

  if (method === 'POST' && pname.startsWith('/api/node/') && pname.endsWith('/move')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/move'.length));
    const node = nodeMap[id];

    if (!node) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    if (id === ROOT.id) {
      sendJSON(res, 400, { error: 'Cannot move root' });
      return;
    }

    const body = await readJSON(req, res);
    if (!body) return;

    const newParentId = body.newParentId || body.parentId;
    const beforeId = body.beforeId || null;
    const afterId = body.afterId || null;

    if (!newParentId) {
      sendJSON(res, 400, { error: 'Requires { newParentId }' });
      return;
    }

    if (newParentId === id) {
      sendJSON(res, 400, { error: 'Cannot move a node under itself' });
      return;
    }

    const newParent = nodeMap[newParentId];
    if (!newParent) {
      sendJSON(res, 404, { error: `New parent not found: ${newParentId}` });
      return;
    }

    if (isDescendant(node, newParentId)) {
      sendJSON(res, 400, { error: 'Cannot move a node into its own descendant' });
      return;
    }

    const oldLoc = findParent(ROOT, id);
    if (!oldLoc) {
      sendJSON(res, 404, { error: `Parent not found for node: ${id}` });
      return;
    }

    const [moved] = oldLoc.parent.c.splice(oldLoc.index, 1);
    if (!newParent.c) newParent.c = [];

    let insertAt = newParent.c.length;

    if (beforeId) {
      const idx = newParent.c.findIndex(child => child.id === beforeId);
      if (idx === -1) {
        oldLoc.parent.c.splice(oldLoc.index, 0, moved);
        sendJSON(res, 404, { error: `beforeId is not a child of newParentId: ${beforeId}` });
        return;
      }
      insertAt = idx;
    } else if (afterId) {
      const idx = newParent.c.findIndex(child => child.id === afterId);
      if (idx === -1) {
        oldLoc.parent.c.splice(oldLoc.index, 0, moved);
        sendJSON(res, 404, { error: `afterId is not a child of newParentId: ${afterId}` });
        return;
      }
      insertAt = idx + 1;
    } else if (Number.isInteger(body.position)) {
      insertAt = Math.max(0, Math.min(body.position, newParent.c.length));
    }

    newParent.c.splice(insertAt, 0, moved);
    rebuildIndex();
    saveData();

    console.log(`[clad0] MOVE node ${id}: ${oldLoc.parent.id} → ${newParentId}`);
    sendJSON(res, 200, {
      ok: true,
      id,
      oldParentId: oldLoc.parent.id,
      newParentId,
      position: insertAt,
    });
    return;
  }

  if (method === 'POST' && pname.startsWith('/api/node/') && pname.endsWith('/reorder')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/reorder'.length));
    const parent = nodeMap[id];

    if (!parent) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    const body = await readJSON(req, res);
    if (!body) return;

    const order = body.order;
    if (!Array.isArray(order)) {
      sendJSON(res, 400, { error: 'Requires { order: [childId, …] }' });
      return;
    }

    const current = parent.c || [];
    const byId = new Map(current.map(ch => [ch.id, ch]));

    const isPermutation =
      order.length === current.length &&
      order.every(cid => byId.has(cid)) &&
      new Set(order).size === order.length;

    if (!isPermutation) {
      sendJSON(res, 400, {
        error: 'order must be a permutation of the current child ids',
        expected: current.map(ch => ch.id),
      });
      return;
    }

    parent.c = order.map(cid => byId.get(cid));
    saveData();

    console.log(`[clad0] REORDER children of ${id}`);
    sendJSON(res, 200, { ok: true, id, order });
    return;
  }

  if (method === 'GET' && pname === '/api/meta') {
    sendJSON(res, 200, buildMeta());
    return;
  }

  // ── stat sheets ──
  if (pname.startsWith('/api/node/') && pname.endsWith('/stats')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/stats'.length));
    if (!nodeMap[id]) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }

    if (method === 'GET') {
      sendJSON(res, 200, { id, stats: readStats(id) });
      return;
    }
    if (method === 'PUT') {
      const body = await readJSON(req, res);
      if (!body) return;
      const stats = body.stats;
      const empty = stats == null || (typeof stats === 'string' && stats.trim() === '') ||
          (typeof stats === 'object' && Object.keys(stats).length === 0);
      if (!empty && nodeMap[id].r !== 'Species') {
        sendJSON(res, 400, { error: 'Monster stat sheets are only allowed on Species-rank entries' });
        return;
      }
      // Empty / null clears the sheet (and its indicator); anything else is stored verbatim.
      if (empty) {
        deleteStats(id);
        console.log(`[clad0] STATS cleared for ${id}`);
        sendJSON(res, 200, { ok: true, id, hasStats: false });
      } else {
        writeStats(id, stats);
        console.log(`[clad0] STATS saved for ${id}`);
        sendJSON(res, 200, { ok: true, id, hasStats: true });
      }
      return;
    }
    sendJSON(res, 405, { error: 'Use GET or PUT for /stats' });
    return;
  }

  // ── image graphics (monster icon = species only; banner = any entry) ──
  if (pname.startsWith('/api/node/') && pname.endsWith('/image')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/image'.length));
    const node = nodeMap[id];
    if (!node) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }
    const kind = (url.searchParams.get('kind') === 'banner') ? 'banner' : 'monster';

    if (method === 'POST') {
      const body = await readJSON(req, res);
      if (!body) return;
      const reqKind = (body.kind === 'banner') ? 'banner' : kind;
      if (reqKind === 'monster' && node.r !== 'Species') {
        sendJSON(res, 400, { error: 'Monster image graphics are only allowed on Species-rank entries' });
        return;
      }
      let ext = String(body.ext || (body.filename || '').split('.').pop() || '').toLowerCase();
      if (!IMAGE_EXT.has(ext)) { sendJSON(res, 400, { error: `Unsupported image type: ${ext}` }); return; }

      const b64 = String(body.data || '').replace(/^data:[^,]*,/, '');
      let buf;
      try { buf = Buffer.from(b64, 'base64'); } catch { sendJSON(res, 400, { error: 'Bad base64' }); return; }
      if (!buf.length) { sendJSON(res, 400, { error: 'Empty image' }); return; }
      if (buf.length > MAX_IMAGE_BYTES) { sendJSON(res, 413, { error: 'Image exceeds size limit' }); return; }

      fs.mkdirSync(MEDIA_DIR, { recursive: true });
      deleteImage(id, reqKind); // overwrite any existing image of this kind (stable id)
      fs.writeFileSync(imagePath(id, reqKind, ext), buf);
      const dims = imageSize(buf, ext);
      const warn = reqKind === 'banner' && (!dims || dims.w !== BANNER_IDEAL_WIDTH);
      console.log(`[clad0] IMAGE(${reqKind}) saved for ${id} (.${ext}, ${buf.length} bytes${dims ? `, ${dims.w}x${dims.h}` : ''})`);
      sendJSON(res, 200, {
        ok: true, id, kind: reqKind, ext, bytes: buf.length,
        w: dims ? dims.w : null, h: dims ? dims.h : null, warn,
      });
      return;
    }
    if (method === 'DELETE') {
      deleteImage(id, kind);
      console.log(`[clad0] IMAGE(${kind}) removed for ${id}`);
      sendJSON(res, 200, { ok: true, id, kind });
      return;
    }
    sendJSON(res, 405, { error: 'Use POST or DELETE for /image' });
    return;
  }

  if (method === 'GET' && pname.startsWith('/api/node/')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length));
    const node = nodeMap[id];

    if (!node) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    sendJSON(res, 200, assembleNode(node));
    return;
  }

  if (method === 'PUT' && pname.startsWith('/api/node/')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length));
    const node = nodeMap[id];

    if (!node) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    const body = await readJSON(req, res);
    if (!body) return;

    const detailUpdates = {};
    const changed = [];

    for (const [k, v] of Object.entries(body)) {
      if (k === 'id' || k === 'c') continue;
      if (!PROSE_KEYS.has(k) && !k.startsWith('_')) continue;

      if (DETAIL_KEYS.has(k)) {
        detailUpdates[k] = v;        // routed to the detail file
      } else {
        node[k] = v;                 // light metadata stays on the tree node
      }
      changed.push(k);
    }

    // Write prose to data/prose/<id>.json (creating it if absent) and strip the
    // bulk from the tree node. This also migrates any prose that was still inline.
    persistDetail(node, detailUpdates);
    node.revised = Date.now();        // server-authoritative revision time (drives stale tracking)
    saveData();

    console.log(`[clad0] PUT node ${id}: updated [${changed.join(', ')}]`);
    sendJSON(res, 200, { ok: true, id, changed });
    return;
  }

  if (method === 'POST' && pname === '/api/node') {
    const body = await readJSON(req, res);
    if (!body) return;

    const { parentId } = body;
    const newNode = body.node || {};

    if (!parentId) {
      sendJSON(res, 400, { error: 'Requires { parentId }' });
      return;
    }

    const parent = nodeMap[parentId];
    if (!parent) {
      sendJSON(res, 404, { error: `Parent not found: ${parentId}` });
      return;
    }

    if (!newNode.id) newNode.id = uniqueId(newNode.n || newNode.sn || 'new-entry');
    if (nodeMap[newNode.id]) {
      sendJSON(res, 409, { error: `Node id already exists: ${newNode.id}` });
      return;
    }

    if (!newNode.n) newNode.n = 'New Entry';
    if (!newNode.r) newNode.r = 'Entry';
    if (!newNode.c) newNode.c = [];
    newNode.revised = Date.now();    // fresh on creation; stale tracking starts now

    if (!parent.c) parent.c = [];
    parent.c.push(newNode);
    indexTree(newNode);

    // Externalise the new node's prose, consistent with split mode.
    persistDetail(newNode, null);
    saveData();

    console.log(`[clad0] POST node ${newNode.id} appended to ${parentId}`);
    sendJSON(res, 201, { ok: true, id: newNode.id, parentId, node: assembleNode(newNode) });
    return;
  }

  if (method === 'DELETE' && pname.startsWith('/api/node/')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length));

    if (id === ROOT.id) {
      sendJSON(res, 400, { error: 'Cannot delete root' });
      return;
    }

    const loc = findParent(ROOT, id);
    if (!loc) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    const [removed] = loc.parent.c.splice(loc.index, 1);
    const goneIds = collectIds(removed);
    removeFromIndex(removed);
    saveData();
    for (const gid of goneIds) { deleteDetail(gid); deleteStats(gid); deleteImage(gid, 'monster'); deleteImage(gid, 'banner'); }  // clean up attachments

    console.log(`[clad0] DELETE node ${id} (+${goneIds.length - 1} descendants)`);
    sendJSON(res, 200, { ok: true, id, parentId: loc.parent.id });
    return;
  }

  sendJSON(res, 404, { error: `No route: ${method} ${pname}` });
});

loadData();

server.listen(PORT, () => {
  console.log(`[clad0] server running → http://localhost:${PORT}`);
  console.log(`[clad0] data file: ${DATA_FILE}`);
  console.log(`[clad0] prose dir: ${PROSE_DIR}`);
  console.log(`[clad0] stats dir: ${STATS_DIR}`);
  console.log(`[clad0] media dir: ${MEDIA_DIR}`);
  console.log(`[clad0] public dir: ${PUBLIC}`);
});

server.on('error', err => {
  console.error('[clad0] server error:', err.message);
  process.exit(1);
});
