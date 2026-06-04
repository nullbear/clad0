#!/usr/bin/env node
'use strict';

/**
 * Reparent the existing "Primordial Existence" tree under a visible "Taxa"
 * container, then place Taxa plus two renameable sibling containers under an
 * invisible root container that is not displayed in the tree.
 *
 * Run from clad0-server:
 *   node reparent-primordial-to-taxa.js
 *
 * Optional custom sibling names:
 *   node reparent-primordial-to-taxa.js "Lore" "Regions"
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const DATA_FILE = path.join(BASE, 'data', 'clado.json');
const VIEWER_FILE = path.join(BASE, 'public', 'viewer.js');

const INVISIBLE_ROOT_ID = 'catalogue-root';
const TAXA_ID = 'cat-taxa';
const SIBLING_1_ID = 'cat-ref';
const SIBLING_2_ID = 'cat-world';

const sibling1Name = process.argv[2] || 'Reference';
const sibling2Name = process.argv[3] || 'World';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = `${file}.bak-${stamp}`;
  fs.copyFileSync(file, out);
  return out;
}

function slugifyId(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entry';
}

function collectIds(node, ids = new Set()) {
  if (!node || typeof node !== 'object') return ids;
  if (node.id) ids.add(node.id);
  for (const child of node.c || []) collectIds(child, ids);
  return ids;
}

function uniqueId(base, ids) {
  const stem = slugifyId(base);
  if (!ids.has(stem)) {
    ids.add(stem);
    return stem;
  }
  let i = 2;
  while (ids.has(`${stem}-${i}`)) i++;
  const id = `${stem}-${i}`;
  ids.add(id);
  return id;
}

function makeContainer(id, name, extra = {}) {
  return {
    id,
    n: name,
    tag: 'Root',
    c: [],
    sn: '',
    r: '',
    gorge: false,
    ctx: false,
    theorized: false,
    fossil: false,
    curse: false,
    ...extra,
  };
}

function patchData() {
  const root = readJson(DATA_FILE);

  if (root.id === INVISIBLE_ROOT_ID && root.treeHidden === true) {
    const taxa = (root.c || []).find(n => n.id === TAXA_ID);
    if (!taxa) throw new Error(`Found invisible root but no ${TAXA_ID} child.`);

    const ids = collectIds(root);
    if (!(root.c || []).some(n => n.id === SIBLING_1_ID)) {
      root.c.push(makeContainer(uniqueId(SIBLING_1_ID, ids), sibling1Name));
    }
    if (!(root.c || []).some(n => n.id === SIBLING_2_ID)) {
      root.c.push(makeContainer(uniqueId(SIBLING_2_ID, ids), sibling2Name));
    }

    writeJsonAtomic(DATA_FILE, root);
    return {
      changed: false,
      message: 'Data was already reparented; ensured sibling placeholders exist.'
    };
  }

  if (root.n !== 'Primordial Existence' && root.id !== 'root') {
    throw new Error(
      `Expected current root to be Primordial Existence/root, got ${JSON.stringify({ id: root.id, n: root.n })}. ` +
      'Refusing to guess; edit the constants in this script if this is intentional.'
    );
  }

  const ids = collectIds(root);
  ids.add(INVISIBLE_ROOT_ID);
  ids.add(TAXA_ID);

  const newRoot = makeContainer(INVISIBLE_ROOT_ID, 'Catalogue Root', {
    treeHidden: true,
    system: true,
    c: [
      makeContainer(TAXA_ID, 'Taxa', {
        c: [root],
      }),
      makeContainer(uniqueId(SIBLING_1_ID, ids), sibling1Name),
      makeContainer(uniqueId(SIBLING_2_ID, ids), sibling2Name),
    ],
  });

  writeJsonAtomic(DATA_FILE, newRoot);
  return {
    changed: true,
    message: 'Reparented Primordial Existence under Taxa and created invisible root.'
  };
}

function patchViewer() {
  let js = fs.readFileSync(VIEWER_FILE, 'utf8');
  let changed = false;

  if (!js.includes('function isTreeHidden(n)')) {
    js = js.replace(
      'function anyVis(n){if(vis(n)) return true;return (n.c||[]).some(ch=>anyVis(ch));}',
      `function anyVis(n){if(vis(n)) return true;return (n.c||[]).some(ch=>anyVis(ch));}
function isTreeHidden(n){ return !!(n && n.treeHidden); }`
    );
    changed = true;
  }

  if (!js.includes('function buildTreeRoot')) {
    js = js.replace(
      `function rerenderTree(){
  TI.innerHTML='';
  const r=buildNode(ROOT,0);
  if(r) TI.appendChild(r);`,
      `function buildTreeRoot(){
  if(!isTreeHidden(ROOT)){
    const r=buildNode(ROOT,0);
    if(r) TI.appendChild(r);
    return;
  }
  (ROOT.c||[]).forEach(ch=>{
    if(!anyVis(ch)) return;
    const cv=buildNode(ch,0);
    if(cv) TI.appendChild(cv);
  });
}

function rerenderTree(){
  TI.innerHTML='';
  buildTreeRoot();`
    );
    changed = true;
  }

  if (changed) fs.writeFileSync(VIEWER_FILE, js, 'utf8');
  return { changed };
}

function main() {
  if (!fs.existsSync(DATA_FILE)) throw new Error(`Cannot find ${DATA_FILE}`);
  if (!fs.existsSync(VIEWER_FILE)) throw new Error(`Cannot find ${VIEWER_FILE}`);

  const dataBackup = backup(DATA_FILE);
  const viewerBackup = backup(VIEWER_FILE);

  const dataResult = patchData();
  const viewerResult = patchViewer();

  console.log(dataResult.message);
  console.log(
    viewerResult.changed
      ? 'Patched viewer.js to skip treeHidden containers.'
      : 'viewer.js already supports treeHidden containers.'
  );
  console.log(`Backups written:\n  ${dataBackup}\n  ${viewerBackup}`);
  console.log('Done. Restart the clad0 server and refresh the browser.');
}

try {
  main();
} catch (err) {
  console.error('ERROR:', err && err.message ? err.message : err);
  process.exit(1);
}