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
 *   GET    /api/clado           → full CLADO tree as JSON
 *   GET    /api/node/:id        → single node by id
 *   PUT    /api/node/:id        → update a node's prose fields
 *   POST   /api/node            → append a new node as child of a given parent
 *   POST   /api/node/:id/move   → move/reparent an existing node
 *   DELETE /api/node/:id        → remove a node and its subtree
 *
 * Data storage:
 *   data/clado.json → the full taxonomy tree, persisted on every write
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = path.join(__dirname, 'data', 'clado.json');
const PUBLIC = path.join(__dirname, 'public');

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

const PROSE_KEYS = new Set([
  'n', 'r', 'sn', 'g', 'summary', 'tax', 'ap', 'eco', 'ecology', 'beh', 'behavior',
  'traitsText', 'traits', 'abilities', 'abil', 'bg', 'background',
  'note', 'conv', 't', 'gorge', 'ctx', 'fossil', 'theorized', 'curse', 'tag',
  'rankMismatch', 'expectedRank', 'hierarchicalRankPosition', '_kg',
]);

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

  if (method === 'GET' && pname.startsWith('/api/node/')) {
    const id = decodeURIComponent(pname.slice('/api/node/'.length));
    const node = nodeMap[id];

    if (!node) {
      sendJSON(res, 404, { error: `Node not found: ${id}` });
      return;
    }

    sendJSON(res, 200, node);
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

    const changed = [];
    for (const [k, v] of Object.entries(body)) {
      if (k === 'id' || k === 'c') continue;
      if (!PROSE_KEYS.has(k) && !k.startsWith('_')) continue;
      node[k] = v;
      changed.push(k);
    }

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

    if (!parent.c) parent.c = [];
    parent.c.push(newNode);
    indexTree(newNode);
    saveData();

    console.log(`[clad0] POST node ${newNode.id} appended to ${parentId}`);
    sendJSON(res, 201, { ok: true, id: newNode.id, parentId, node: newNode });
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
    removeFromIndex(removed);
    saveData();

    console.log(`[clad0] DELETE node ${id}`);
    sendJSON(res, 200, { ok: true, id, parentId: loc.parent.id });
    return;
  }

  sendJSON(res, 404, { error: `No route: ${method} ${pname}` });
});

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