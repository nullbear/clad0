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

// The browser UI is read-only app code, but clad0's journal data is mutable.
// In development, data defaults to clad0-server/data. In the packaged Chromium
// app, Electron sets CLAD0_DATA_DIR to a writable per-user directory so edits do
// not try to write inside app.asar / Program Files.
const DATA_ROOT = process.env.CLAD0_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_ROOT, 'clado.json');
const PROSE_DIR = path.join(DATA_ROOT, 'prose');
const STATS_DIR = path.join(DATA_ROOT, 'stats');   // monster stat sheets (per id)
const MEDIA_DIR = path.join(DATA_ROOT, 'media');   // image graphics (per id)
const PUBLIC = path.join(__dirname, 'public');
const PROJECT_SETTINGS_FILE = path.join(DATA_ROOT, 'project-settings.json');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB cap on uploaded image graphics
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);


function mergeDeep(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!patch || typeof patch !== 'object') return out;
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mergeDeep(out[k], v);
    else out[k] = v;
  }
  return out;
}
function defaultProjectSettings() {
  return {
    schemaVersion: 2,
    name: path.basename(path.resolve(DATA_ROOT)) || 'clad0 Project',
    description: '',
    appearance: { theme: 'parchment', customThemePath: '', mediaDisplay: 'standard' },
    features: { allowEdits: true, sunburstEnabled: true, statsEnabled: true, mediaEnabled: true, staleTrackingEnabled: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
function normalizeThemeId(id) {
  if (id === 'clean-light' || id === 'high-contrast') return 'wiki-whitepage';
  if (id === 'dark-archive') return 'discord-dark';
  return id || 'parchment';
}
function readProjectSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(PROJECT_SETTINGS_FILE, 'utf8'));
    const migrated = { ...raw };
    delete migrated.defaultSunburstView;
    if (migrated.appearance && migrated.appearance.theme) migrated.appearance.theme = normalizeThemeId(migrated.appearance.theme);
    return mergeDeep(defaultProjectSettings(), { ...migrated, schemaVersion: 2 });
  } catch {
    return defaultProjectSettings();
  }
}
const THEME_LABELS = { parchment: 'Default Parchment', 'wiki-whitepage': 'Wiki Whitepage', 'discord-dark': 'Discord Dark', 'scifi-solar': 'Sci-Fi Solarized' };
const CORE_THEME_ORDER = ['parchment', 'wiki-whitepage', 'discord-dark', 'scifi-solar'];
function themeLabel(id) { return THEME_LABELS[id] || String(id || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function sortThemeIds(ids) {
  return ids.sort((a, b) => { const ai = CORE_THEME_ORDER.indexOf(a), bi = CORE_THEME_ORDER.indexOf(b); if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi); return a.localeCompare(b); });
}
function availableThemes() {
  try {
    return sortThemeIds(fs.readdirSync(path.join(PUBLIC, 'themes')).filter(f => f.endsWith('.css')).map(f => path.basename(f, '.css')))
      .map(id => ({ id, label: themeLabel(id), href: '/themes/' + id + '.css' }));
  } catch { return []; }
}

function selectedThemeHref() {
  const settings = readProjectSettings();
  const app = settings.appearance || {};
  if (app.theme === 'custom') return '/api/custom-theme.css';
  if (app.theme) return '/themes/' + encodeURIComponent(app.theme) + '.css';
  return '/themes/parchment.css';
}
function injectProjectThemeIntoIndex(html) {
  const href = selectedThemeHref();
  const tag = `<link id="project-theme-css" rel="stylesheet" href="${href}">`;
  if (html.includes('id="project-theme-css"')) return html.replace(/<link[^>]+id=["']project-theme-css["'][^>]*>/, tag);
  return html.replace('</head>', tag + '\n</head>');
}

function touchRevised(node) {
  if (!node) return null;
  node.revised = Date.now();
  return node.revised;
}
function projectAllowsEdits() {
  const settings = readProjectSettings();
  return !settings.features || settings.features.allowEdits !== false;
}
function rejectIfReadOnly(res) {
  if (projectAllowsEdits()) return false;
  sendJSON(res, 403, { error: 'This project is read-only because Project Settings disables Allow edits.' });
  return true;
}
function revisedStamp(node) { const x = Number(node && node.revised); return Number.isFinite(x) ? x : 0; }
function staleConflict(node, loadedRevised, forceWrite) {
  if (forceWrite) return false;
  if (loadedRevised == null || loadedRevised === '') return false;
  const client = Number(loadedRevised);
  return Number.isFinite(client) && client !== revisedStamp(node);
}

let ROOT = null;
let nodeMap = {};
let sidIndex = {};        // stable id (sid) → node; sid is immutable, slug (id) is renamable
let sidSeq = 0;           // high-water mark for generated sids (pattern k000001)

function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  ROOT = JSON.parse(raw);
  rebuildIndex();
  console.log(`[clad0] loaded ${Object.keys(nodeMap).length} nodes from ${DATA_FILE}`);
}

function rebuildIndex() {
  nodeMap = {};
  sidIndex = {};
  sidSeq = 0;
  indexTree(ROOT);
}

function indexTree(node) {
  if (!node || !node.id) return;
  nodeMap[node.id] = node;
  if (node.sid) {
    sidIndex[node.sid] = node;
    const m = /^k(\d+)$/.exec(node.sid);
    if (m) sidSeq = Math.max(sidSeq, parseInt(m[1], 10));
  }
  for (const child of (node.c || [])) indexTree(child);
}

// Immutable surrogate id. Crosslinks reference this; it stores (follows) the
// current slug. Format k000001, incrementing, collision-checked.
function genSid() {
  let s;
  do { sidSeq += 1; s = 'k' + String(sidSeq).padStart(6, '0'); } while (sidIndex[s]);
  return s;
}
function ensureSid(node) {
  if (node && !node.sid) { node.sid = genSid(); sidIndex[node.sid] = node; }
  return node && node.sid;
}
function moveFileIf(src, dst) {
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.renameSync(src, dst);
      return true;
    }
  } catch (e) { console.error('[clad0] file rename failed:', src, '→', dst, e.message); }
  return false;
}
function copyFileIf(src, dst) {
  try {
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return true;
    }
  } catch (e) { console.error('[clad0] file copy failed:', src, '→', dst, e.message); }
  return false;
}
// Rename the slug-keyed side files old → new. The sid is unchanged and keeps
// pointing at this node, so crosslinks (which hold the sid) need no rewriting.
function renameSlug(node, from, to) {
  const moved = [];
  if (moveFileIf(detailPath(from), detailPath(to))) moved.push('prose');
  if (moveFileIf(statsPath(from), statsPath(to))) moved.push('stats');
  for (const kind of ['monster', 'banner']) {
    const ext = imageExt(from, kind);
    if (ext && moveFileIf(imagePath(from, kind, ext), imagePath(to, kind, ext))) moved.push(kind);
  }
  delete nodeMap[from];
  node.id = to;
  nodeMap[to] = node;
  return moved;
}

// Deep-clone a node and its subtree. Each clone gets a fresh sid + unique slug;
// prose is re-externalised to the clone's own detail file and stats/images are
// copied. Used by Duplicate and (later) create-from-template.
function cloneSubtree(src, opts) {
  opts = opts || {};
  const full = assembleNode(src);              // merges detail file + derived flags
  const newSlug = uniqueId(opts.slug || (src.id + '-copy'));
  const clone = {};
  for (const [k, v] of Object.entries(full)) {
    if (k === 'c' || k === 'sid' || k === 'img' || k === 'banner' || k === 'hasStats') continue;
    clone[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  }
  clone.id = newSlug;
  clone.sid = genSid();
  if (opts.name) clone.n = opts.name;
  clone.revised = Date.now();
  nodeMap[newSlug] = clone; sidIndex[clone.sid] = clone;   // register for sibling uniqueness
  copyFileIf(statsPath(src.id), statsPath(newSlug));
  for (const kind of ['monster', 'banner']) {
    const ext = imageExt(src.id, kind);
    if (ext) copyFileIf(imagePath(src.id, kind, ext), imagePath(newSlug, kind, ext));
  }
  clone.c = (src.c || []).map(ch => cloneSubtree(ch, {}));
  persistDetail(clone, null);                  // write prose to the clone's detail file, strip from node
  return clone;
}

function saveData() {
  const tmp = DATA_FILE + '.tmp';
  const json = JSON.stringify(ROOT);
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// All keys the API will accept on a write (existing allowlist; unchanged).
const PROSE_KEYS = new Set([
  'n', 'r', 'sn', 'g', 'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background',
  'note', 'conv', 't', 'gorge', 'ctx', 'fossil', 'theorized', 'curse', 'tag',
  'css', 'flags', 'rankStyle', 'staleExempt', 'revised', 'fields', 'isTemplate', '_kg',
]);

// The subset of those that carry the data *bulk*. These live in per-node detail
// files and are stripped from the tree. Everything the index/search/filters need
// (n, r, sn, c, gorge, ctx, theorized, fossil, curse, conv, tag…)
// is deliberately NOT here, so the slim tree fully drives the index.
const DETAIL_KEYS = new Set([
  'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background', 'g', 'note',
]);


const DEPRECATED_NODE_KEYS = ['rankMismatch', 'expectedRank', 'hierarchicalRankPosition'];
function stripDeprecatedNodeFields(node){
  if(!node || typeof node !== 'object') return;
  for(const k of DEPRECATED_NODE_KEYS) delete node[k];
}
function normalizeRankStyleValue(v){
  const x=String(v||'').trim();
  const legacy={Domain:'style-1',Kingdom:'style-2',Phylum:'style-3',Class:'style-4',Order:'style-5',Family:'style-6',Genus:'style-7',Species:'style-8',Subspecies:'style-8'};
  return legacy[x] || x || 'style-8';
}

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

function safeFieldKey(k) {
  return String(k || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'field';
}
function fieldImageBase(id, fieldKey) {
  return encodeURIComponent(String(id)) + '__field__' + encodeURIComponent(safeFieldKey(fieldKey));
}
function fieldImagePath(id, fieldKey, ext) {
  return path.join(MEDIA_DIR, fieldImageBase(id, fieldKey) + '.' + ext);
}
function deleteFieldImage(id, fieldKey) {
  for (const ext of IMAGE_EXT) {
    try { fs.unlinkSync(fieldImagePath(id, fieldKey, ext)); } catch { /* ignore */ }
  }
}
function publicFieldImageUrl(id, fieldKey, ext) {
  return '/media/' + fieldImageBase(id, fieldKey) + '.' + ext;
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
  for (const k of detailKeysFor(node)) if (k in node) out[k] = node[k];
  return out;
}

// Remove DETAIL_KEYS from a tree node so the tree stays slim.
function stripDetail(node) {
  for (const k of detailKeysFor(node)) if (k in node) delete node[k];
}

// A manual field of type 'prose' carries bulk text, so its value is externalised
// just like the built-in prose sections. Other field types stay light on the node.
function isProseFieldType(t) { return t === 'prose'; }
function detailKeysFor(node) {
  if (!node || !Array.isArray(node.fields)) return DETAIL_KEYS;
  const ks = new Set(DETAIL_KEYS);
  for (const f of node.fields) if (f && f.key && isProseFieldType(f.type)) ks.add(f.key);
  return ks;
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
  // Only keep recognised detail keys in the file (built-in + schema prose fields).
  const keep = detailKeysFor(node);
  for (const k of Object.keys(detail)) {
    if (!keep.has(k)) delete detail[k];
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
      let content = fs.readFileSync(filepath);
      let ctype = MIME[ext] || 'application/octet-stream';
      if (target === '/index.html') {
        content = injectProjectThemeIntoIndex(content.toString('utf8'));
        ctype = 'text/html; charset=utf-8';
      }
      send(res, 200, ctype, content);
    } catch {
      send(res, 404, 'text/plain; charset=utf-8', `Not found: ${target}`);
    }
    return;
  }

  if (method === 'GET' && pname === '/api/project-settings') {
    sendJSON(res, 200, { settings: readProjectSettings(), themes: availableThemes() });
    return;
  }

  if (method === 'GET' && pname === '/api/custom-theme.css') {
    const settings = readProjectSettings();
    const themePath = settings && settings.appearance && settings.appearance.customThemePath;
    if (!themePath) { send(res, 404, 'text/plain; charset=utf-8', 'No custom theme selected.'); return; }
    try {
      const content = fs.readFileSync(themePath, 'utf8');
      send(res, 200, 'text/css; charset=utf-8', content);
    } catch (err) {
      send(res, 404, 'text/plain; charset=utf-8', 'Custom theme not found: ' + err.message);
    }
    return;
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && pname.startsWith('/api/node')) {
    if (rejectIfReadOnly(res)) return;
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

  // ── sanity scan (read-only): duplicate slugs / sids, and nodes missing a sid ──
  if (method === 'GET' && pname === '/api/sanity') {
    const slugCounts = {}, sidCounts = {}, missingSid = [];
    let total = 0;
    (function walk(n){
      if (!n) return;
      total += 1;
      slugCounts[n.id] = (slugCounts[n.id] || 0) + 1;
      if (n.sid) sidCounts[n.sid] = (sidCounts[n.sid] || 0) + 1; else missingSid.push(n.id);
      (n.c || []).forEach(walk);
    })(ROOT);
    const dupSlugs = Object.entries(slugCounts).filter(([, c]) => c > 1).map(([slug, count]) => ({ slug, count }));
    const dupSids = Object.entries(sidCounts).filter(([, c]) => c > 1).map(([sid, count]) => ({ sid, count }));
    sendJSON(res, 200, {
      ok: true,
      totals: { nodes: total, uniqueSlugs: Object.keys(slugCounts).length, withSid: total - missingSid.length },
      dupSlugs, dupSids, missingSid
    });
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
      if (staleConflict(nodeMap[id], body._loadedRevised, body._forceWrite)) {
        sendJSON(res, 409, { error: 'This entry changed after you opened it. Reload or review before overwriting stats.', id, revised: revisedStamp(nodeMap[id]), current: assembleNode(nodeMap[id]) });
        return;
      }
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
        const revised = touchRevised(nodeMap[id]);
        saveData();
        console.log(`[clad0] STATS cleared for ${id}`);
        sendJSON(res, 200, { ok: true, id, hasStats: false, revised });
      } else {
        writeStats(id, stats);
        const revised = touchRevised(nodeMap[id]);
        saveData();
        console.log(`[clad0] STATS saved for ${id}`);
        sendJSON(res, 200, { ok: true, id, hasStats: true, revised });
      }
      return;
    }
    sendJSON(res, 405, { error: 'Use GET or PUT for /stats' });
    return;
  }


  // ── custom-field image media ──
  if (pname.startsWith('/api/node/') && pname.endsWith('/field-media')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/field-media'.length));
    const node = nodeMap[id];
    if (!node) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }
    const field = safeFieldKey(url.searchParams.get('field') || '');
    const schema = Array.isArray(node.fields) ? node.fields : [];
    const fieldDef = schema.find(f => f && f.key === field && f.type === 'image');
    if (!fieldDef) { sendJSON(res, 400, { error: `Image field not found on this entry: ${field}` }); return; }

    if (method === 'POST') {
      const body = await readJSON(req, res);
      if (!body) return;
      stripDeprecatedNodeFields(node);
    const oldSchemaKeys = new Set(Array.isArray(node.fields) ? node.fields.map(f => f && f.key).filter(Boolean) : []);
    if (body.flags == null && body.css != null) body.flags = body.css;
    delete node.css;
    delete body.css;
    for (const k of DEPRECATED_NODE_KEYS) delete body[k];
    if (Object.prototype.hasOwnProperty.call(body, 'r')) body.r = String(body.r || '').slice(0, 16);

    if (staleConflict(node, body._loadedRevised, body._forceWrite)) {
        sendJSON(res, 409, { error: 'This entry changed after you opened it. Reload or review before overwriting field media.', id, revised: revisedStamp(node), current: assembleNode(node) });
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
      deleteFieldImage(id, field);
      fs.writeFileSync(fieldImagePath(id, field, ext), buf);
      node[field] = publicFieldImageUrl(id, field, ext);
      const revised = touchRevised(node);
      saveData();
      sendJSON(res, 200, { ok: true, id, field, ext, value: node[field], revised });
      return;
    }
    sendJSON(res, 405, { error: 'Use POST for /field-media' });
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
      stripDeprecatedNodeFields(node);
    const oldSchemaKeys = new Set(Array.isArray(node.fields) ? node.fields.map(f => f && f.key).filter(Boolean) : []);
    if (body.flags == null && body.css != null) body.flags = body.css;
    delete node.css;
    delete body.css;
    for (const k of DEPRECATED_NODE_KEYS) delete body[k];
    if (body.rankStyle != null) body.rankStyle = normalizeRankStyleValue(body.rankStyle);

    if (staleConflict(node, body._loadedRevised, body._forceWrite)) {
        sendJSON(res, 409, { error: 'This entry changed after you opened it. Reload or review before overwriting media.', id, revised: revisedStamp(node), current: assembleNode(node) });
        return;
      }
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
      const revised = touchRevised(node);
      saveData();
      console.log(`[clad0] IMAGE(${reqKind}) saved for ${id} (.${ext}, ${buf.length} bytes${dims ? `, ${dims.w}x${dims.h}` : ''})`);
      sendJSON(res, 200, {
        ok: true, id, kind: reqKind, ext, bytes: buf.length,
        w: dims ? dims.w : null, h: dims ? dims.h : null, warn, revised,
      });
      return;
    }
    if (method === 'DELETE') {
      deleteImage(id, kind);
      const revised = touchRevised(node);
      saveData();
      console.log(`[clad0] IMAGE(${kind}) removed for ${id}`);
      sendJSON(res, 200, { ok: true, id, kind, revised });
      return;
    }
    sendJSON(res, 405, { error: 'Use POST or DELETE for /image' });
    return;
  }

  if (method === 'POST' && pname.startsWith('/api/node/') && pname.endsWith('/duplicate')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length, -'/duplicate'.length));
    const src = nodeMap[id];
    if (!src) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }
    const body = await readJSON(req, res);
    if (!body) return;

    let parent, insertAt;
    if (body.parentId) {
      parent = nodeMap[body.parentId];
      if (!parent) { sendJSON(res, 404, { error: `Parent not found: ${body.parentId}` }); return; }
      parent.c = parent.c || [];
      insertAt = parent.c.length;                   // template instance → last child of target
    } else {
      const loc = findParent(ROOT, id);
      if (!loc) { sendJSON(res, 400, { error: 'Cannot duplicate the root' }); return; }
      parent = loc.parent;
      insertAt = loc.index + 1;                      // plain duplicate → sibling right after source
    }

    const clone = cloneSubtree(src, { name: body.name, slug: body.slug });
    // Light identity overrides (e.g. create-from-template sets rank/sn and clears isTemplate)
    if (body.overrides && typeof body.overrides === 'object') {
      for (const [k, v] of Object.entries(body.overrides)) {
        if (k === 'id' || k === 'c' || k === 'sid' || k === 'fields') continue;
        clone[k] = v;
      }
    }
    parent.c = parent.c || [];
    parent.c.splice(insertAt, 0, clone);
    saveData();

    console.log(`[clad0] DUPLICATE ${id} → ${clone.id} (sid ${clone.sid}) under ${parent.id}`);
    sendJSON(res, 201, { ok: true, id: clone.id, sid: clone.sid, parentId: parent.id, node: assembleNode(clone) });
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

    stripDeprecatedNodeFields(node);
    const oldSchemaKeys = new Set(Array.isArray(node.fields) ? node.fields.map(f => f && f.key).filter(Boolean) : []);
    if (body.flags == null && body.css != null) body.flags = body.css;
    delete node.css;
    delete body.css;
    for (const k of DEPRECATED_NODE_KEYS) delete body[k];
    if (body.rankStyle != null) body.rankStyle = normalizeRankStyleValue(body.rankStyle);

    if (staleConflict(node, body._loadedRevised, body._forceWrite)) {
      sendJSON(res, 409, { error: 'This entry changed after you opened it. Reload or review before overwriting.', id, revised: revisedStamp(node), current: assembleNode(node) });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'n') && !String(body.n || '').trim()) { sendJSON(res, 400, { error: 'Name cannot be empty.' }); return; }

    // Optional slug (id) rename. The sid is immutable and follows the node, so
    // crosslinks need no rewriting — only the slug-named side files move.
    let rename = null;
    if (typeof body.id === 'string' && body.id.trim() && body.id.trim() !== id) {
      const newId = body.id.trim();
      if (nodeMap[newId]) { sendJSON(res, 409, { error: `Slug already in use: ${newId}` }); return; }
      rename = { from: id, to: newId };
    }

    const detailUpdates = {};
    const changed = [];

    // Resolve the entry's field schema (incoming overrides stored) so we can
    // accept its declared keys and externalise the prose-type ones.
    const schema = Array.isArray(body.fields) ? body.fields : (node.fields || []);
    const schemaKeys = new Set(schema.map(f => f && f.key).filter(Boolean));
    const schemaProse = new Set(schema.filter(f => f && isProseFieldType(f.type) && f.key).map(f => f.key));

    // If the custom-field schema is being replaced, drop values for removed or
    // renamed field keys so light node data and prose details do not accumulate
    // invisible orphan content. Client-side key rename copies the value to the
    // new key before save, so deleting the old key is safe.
    if (Array.isArray(body.fields) && oldSchemaKeys.size) {
      const detail = hasDetail(node.id) ? readDetail(node.id) : inlineDetail(node);
      let detailTouched = false;
      for (const oldKey of oldSchemaKeys) {
        if (schemaKeys.has(oldKey)) continue;
        if (Object.prototype.hasOwnProperty.call(node, oldKey)) delete node[oldKey];
        if (Object.prototype.hasOwnProperty.call(detail, oldKey)) { delete detail[oldKey]; detailTouched = true; }
      }
      if (detailTouched) writeDetail(node.id, detail);
    }

    for (const [k, v] of Object.entries(body)) {
      if (k === 'id' || k === 'c' || k === 'sid' || k.startsWith('_')) continue;
      const allowed = PROSE_KEYS.has(k) || k === 'fields' || schemaKeys.has(k) || k.startsWith('_');
      if (!allowed) continue;

      if (DETAIL_KEYS.has(k) || schemaProse.has(k)) {
        detailUpdates[k] = v;        // routed to the detail file
      } else {
        node[k] = v;                 // light metadata stays on the tree node
      }
      changed.push(k);
    }

    ensureSid(node);                  // lock in a stable surrogate id if absent
    let movedFiles = [];
    if (rename) { movedFiles = renameSlug(node, rename.from, rename.to); changed.push('id'); }

    // Write prose to data/prose/<slug>.json (creating it if absent) and strip the
    // bulk from the tree node. This also migrates any prose that was still inline.
    persistDetail(node, detailUpdates);
    touchRevised(node);        // server-authoritative last-saved field (drives stale tracking)
    saveData();

    const finalId = node.id;
    console.log(`[clad0] PUT node ${id}: updated [${changed.join(', ')}]` +
      (rename ? ` (renamed → ${finalId}; moved: ${movedFiles.join(', ') || 'none'})` : ''));
    sendJSON(res, 200, { ok: true, id: finalId, sid: node.sid, revised: node.revised, renamedFrom: rename ? rename.from : null, changed });
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
    if (newNode.rankStyle != null) newNode.rankStyle = normalizeRankStyleValue(newNode.rankStyle);
    if (!newNode.c) newNode.c = [];
    newNode.revised = Date.now();    // server-authoritative last-saved field; stale tracking compares this against the system clock
    ensureSid(newNode);              // assign an immutable surrogate id

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

server.listen(PORT, '127.0.0.1', () => {
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
