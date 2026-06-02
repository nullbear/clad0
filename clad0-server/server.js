#!/usr/bin/env node
/**
 * clad0 — Field Journal of the Throat
 * Node.js server
 *
 * Usage:
 *   node server.js          → listens on port 3000
 *   PORT=8080 node server.js
 *
 * Routes:
 *   GET  /                  → shell HTML (browser loads viewer.js + style.css then fetches data)
 *   GET  /style.css         → extracted stylesheet
 *   GET  /viewer.js         → viewer application JS
 *   GET  /api/clado         → full CLADO tree as JSON
 *   GET  /api/node/:id      → single node by id
 *   PUT  /api/node/:id      → update a node's prose fields (auto-saves to clado.json)
 *   POST /api/node          → append a new node as child of a given parent
 *   DELETE /api/node/:id    → remove a node (and its subtree) by id
 *
 * Data storage:
 *   data/clado.json         → the full taxonomy tree, persisted on every write
 *
 * The server keeps the tree in memory and writes the whole clado.json to disk
 * on each mutation. A future version can shard per phylum.
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = path.join(__dirname, 'data', 'clado.json');
const PUBLIC    = path.join(__dirname, 'public');

// ── In-memory tree ────────────────────────────────────────────────────────────

let ROOT = null;    // the full CLADO object
let nodeMap = {};   // id → node (shallow refs into ROOT)

function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  ROOT = JSON.parse(raw);
  nodeMap = {};
  indexTree(ROOT);
  console.log(`[clad0] loaded ${Object.keys(nodeMap).length} nodes from ${DATA_FILE}`);
}

function indexTree(node) {
  if (node.id) nodeMap[node.id] = node;
  for (const child of (node.c || [])) indexTree(child);
}

function saveData() {
  const json = JSON.stringify(ROOT, null, null);   // compact — matches original format
  fs.writeFileSync(DATA_FILE, json, 'utf8');
}

// ── Node helpers ──────────────────────────────────────────────────────────────

// Fields the viewer uses for prose / metadata (safe to overwrite via PUT)
const PROSE_KEYS = new Set([
  'n','r','sn','g','summary','tax','ap','eco','ecology','beh','behavior',
  'traitsText','traits','abilities','abil','bg','background',
  'note','conv','t','gorge','ctx','fossil','theorized','curse','tag',
  'rankMismatch','expectedRank','hierarchicalRankPosition','_kg',
]);

function findParent(root, targetId, parent = null) {
  if (!root) return null;
  for (let i = 0; i < (root.c || []).length; i++) {
    const child = root.c[i];
    if (child.id === targetId) return { parent: root, index: i };
    const found = findParent(child, targetId, root);
    if (found) return found;
  }
  return null;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, contentType, body) {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  res.writeHead(status, {
    'Content-Type':   contentType,
    'Content-Length': buf.length,
    'Cache-Control':  'no-cache',
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
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();
  const pname  = url.pathname;

  // ── Static files ──
  if (method === 'GET' && !pname.startsWith('/api/')) {
    const target = pname === '/' ? '/index.html' : pname;
    const filepath = path.join(PUBLIC, target.replace(/\.\./g, ''));
    const ext      = path.extname(filepath);
    try {
      const content = fs.readFileSync(filepath);
      send(res, 200, MIME[ext] || 'application/octet-stream', content);
    } catch {
      send(res, 404, 'text/plain', `Not found: ${target}`);
    }
    return;
  }

  // ── GET /api/clado ── full tree ──
  if (method === 'GET' && pname === '/api/clado') {
    send(res, 200, 'application/json; charset=utf-8',
         fs.readFileSync(DATA_FILE));   // read from disk (always fresh)
    return;
  }

  // ── GET /api/node/:id ── single node ──
  if (method === 'GET' && pname.startsWith('/api/node/')) {
    const id   = decodeURIComponent(pname.slice('/api/node/'.length));
    const node = nodeMap[id];
    if (!node) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }
    sendJSON(res, 200, node);
    return;
  }

  // ── PUT /api/node/:id ── update prose fields of an existing node ──
  if (method === 'PUT' && pname.startsWith('/api/node/')) {
    const id   = decodeURIComponent(pname.slice('/api/node/'.length));
    const node = nodeMap[id];
    if (!node) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message });
      return;
    }

    // Only allow updating safe prose / metadata keys, never 'c' (children) or 'id'
    const changed = [];
    for (const [k, v] of Object.entries(body)) {
      if (k === 'id' || k === 'c') continue;   // structural keys are off limits via this endpoint
      if (!PROSE_KEYS.has(k) && !k.startsWith('_')) continue;
      node[k] = v;
      changed.push(k);
    }

    saveData();
    console.log(`[clad0] PUT node ${id}: updated [${changed.join(', ')}]`);
    sendJSON(res, 200, { ok: true, id, changed });
    return;
  }

  // ── POST /api/node ── append a new child node ──
  if (method === 'POST' && pname === '/api/node') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message });
      return;
    }

    const { parentId, node: newNode } = body;
    if (!parentId || !newNode || !newNode.id) {
      sendJSON(res, 400, { error: 'Requires { parentId, node: { id, ... } }' });
      return;
    }
    if (nodeMap[newNode.id]) {
      sendJSON(res, 409, { error: `Node id already exists: ${newNode.id}` });
      return;
    }
    const parent = nodeMap[parentId];
    if (!parent) {
      sendJSON(res, 404, { error: `Parent not found: ${parentId}` });
      return;
    }

    if (!parent.c) parent.c = [];
    if (!newNode.c) newNode.c = [];
    parent.c.push(newNode);
    indexTree(newNode);   // register new node (and any children) in nodeMap
    saveData();
    console.log(`[clad0] POST node ${newNode.id} appended to ${parentId}`);
    sendJSON(res, 201, { ok: true, id: newNode.id, parentId });
    return;
  }

  // ── DELETE /api/node/:id ── remove node and subtree ──
  if (method === 'DELETE' && pname.startsWith('/api/node/')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length));
    if (id === ROOT.id) {
      sendJSON(res, 400, { error: 'Cannot delete root' });
      return;
    }
    const loc = findParent(ROOT, id);
    if (!loc) { sendJSON(res, 404, { error: `Node not found: ${id}` }); return; }

    // Remove from parent's children
    const [removed] = loc.parent.c.splice(loc.index, 1);

    // Purge from nodeMap
    function purge(n) {
      delete nodeMap[n.id];
      for (const c of (n.c || [])) purge(c);
    }
    purge(removed);

    saveData();
    console.log(`[clad0] DELETE node ${id}`);
    sendJSON(res, 200, { ok: true, id });
    return;
  }

  // ── 405 / 404 fallthrough ──
  sendJSON(res, 404, { error: `No route: ${method} ${pname}` });
});

// ── Start ─────────────────────────────────────────────────────────────────────

loadData();

server.listen(PORT, () => {
  console.log(`[clad0] server running → http://localhost:${PORT}`);
  console.log(`[clad0] data file: ${DATA_FILE}`);
  console.log(`[clad0] public dir: ${PUBLIC}`);
});

server.on('error', err => {
  console.error('[clad0] server error:', err.message);
  process.exit(1);
});
