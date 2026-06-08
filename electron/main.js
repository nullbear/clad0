'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const { fork } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');

// ── Security helpers ─────────────────────────────────────────────────────────
// Only these protocols may be handed to the OS default handler.
function isSafeExternal(u){ try { return ['https:','http:','mailto:'].includes(new URL(u).protocol); } catch { return false; } }
// True if `child` resolves to `root` or something inside it.
function pathWithin(child, root){
  if (!child || !root) return false;
  const c = path.resolve(String(child)), r = path.resolve(String(root));
  return c === r || c.startsWith(r + path.sep);
}
// Lock a server-backed window down: deny popups (routing only safe ones to the
// OS browser) and block navigation away from the window's own origin, so prose
// links can't drive a privileged (preload-bridged) window to remote content.
function hardenWindow(win){
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, navUrl) => {
    let sameOrigin = false;
    try { sameOrigin = new URL(navUrl).origin === new URL(win.webContents.getURL()).origin; } catch {}
    if (sameOrigin) return;
    e.preventDefault();
    if (isSafeExternal(navUrl)) shell.openExternal(navUrl);
  });
}

let mainWindow = null;
let projectWindow = null;
let projectSettingsWindow = null;
let appSettingsWindow = null;
let mediaManagerWindow = null;
let serverProcess = null;
let currentProject = null;
let currentUrl = null;
let sunburstMenuItem = null;
let sunburstMenuState = false;
const editorWindows = new Set();

function appRoot() {
  // In development this is the repository root. In production the server is
  // unpacked so child_process can execute it outside the asar archive.
  if (app.isPackaged) return path.join(process.resourcesPath, 'app.asar.unpacked');
  return app.getAppPath();
}

function installFolder() {
  return app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
}

function serverDir() {
  return path.join(appRoot(), 'clad0-server');
}

function configPath() {
  return path.join(app.getPath('userData'), 'projects.json');
}

function appSettingsPath() {
  // Mutable app settings belong in Electron's stable per-user config folder.
  // The install/runtime folder is treated as read-only app code unless a future
  // explicit portable mode is added.
  return path.join(app.getPath('userData'), 'app-settings.json');
}

function projectSettingsPath(dataDir) {
  return path.join(dataDir, 'project-settings.json');
}

function defaultProjectsRoot() {
  return path.join(app.getPath('documents'), 'clad0 Projects');
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function defaultAppSettings() {
  return {
    schemaVersion: 2,
    startup: {
      openProjectPickerOnLaunch: false,
      restoreLastProject: true,
    },
    appearance: {
      theme: 'parchment',
      uiScale: 1,
    },
    advanced: {
      developerTools: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mergeDeep(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!patch || typeof patch !== 'object') return out;
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mergeDeep(out[k], v);
    else out[k] = v;
  }
  return out;
}

function readAppSettings() {
  const defaults = defaultAppSettings();
  const existing = readJsonFile(appSettingsPath(), {});
  const legacy = { ...existing };
  if (legacy.appearance && legacy.appearance.theme) {
    if (legacy.appearance.theme === 'system' || legacy.appearance.theme === 'light') legacy.appearance.theme = 'parchment';
    if (legacy.appearance.theme === 'dark') legacy.appearance.theme = 'discord-dark';
  }
  if ('openProjectPickerOnLaunch' in legacy) {
    legacy.startup = { ...(legacy.startup || {}), openProjectPickerOnLaunch: !!legacy.openProjectPickerOnLaunch };
    delete legacy.openProjectPickerOnLaunch;
  }
  delete legacy.rememberSunburstView;
  return mergeDeep(defaults, { ...legacy, schemaVersion: 2 });
}

function writeAppSettings(settings) {
  const existing = readAppSettings();
  const merged = mergeDeep(existing, settings || {});
  merged.schemaVersion = 2;
  merged.updatedAt = new Date().toISOString();
  if (!merged.createdAt) merged.createdAt = new Date().toISOString();
  writeJsonFile(appSettingsPath(), merged);
  return merged;
}

function defaultProjectSettings(projectName) {
  return {
    schemaVersion: 2,
    name: projectName || 'clad0 Project',
    description: '',
    appearance: {
      theme: 'parchment',
      customThemePath: '',
      mediaDisplay: 'standard',
    },
    features: {
      allowEdits: true,
      sunburstEnabled: true,
      statsEnabled: true,
      mediaEnabled: true,
      staleTrackingEnabled: true,
    },
    templates: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeThemeId(id) {
  if (id === 'clean-light' || id === 'high-contrast') return 'wiki-whitepage';
  if (id === 'dark-archive') return 'discord-dark';
  return id || 'parchment';
}
function readProjectSettings(dataDir, projectName) {
  const defaults = defaultProjectSettings(projectName);
  const existing = readJsonFile(projectSettingsPath(dataDir), {});
  const legacy = { ...existing };
  if ('defaultSunburstView' in legacy) delete legacy.defaultSunburstView;
  if (legacy.appearance && legacy.appearance.theme) legacy.appearance.theme = normalizeThemeId(legacy.appearance.theme);
  return mergeDeep(defaults, { ...legacy, schemaVersion: 2 });
}

function writeProjectSettings(dataDir, settings) {
  const existing = readProjectSettings(dataDir, settings && settings.name);
  const merged = mergeDeep(existing, settings || {});
  merged.schemaVersion = 2;
  merged.updatedAt = new Date().toISOString();
  if (!merged.createdAt) merged.createdAt = new Date().toISOString();
  writeJsonFile(projectSettingsPath(dataDir), merged);
  return merged;
}

function readProjectState() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      activeProjectId: parsed.activeProjectId || null,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { activeProjectId: null, projects: [] };
  }
}

function writeProjectState(state) {
  writeJsonFile(configPath(), state);
}

function projectId() {
  return crypto.randomBytes(8).toString('hex');
}

function displayNameFromDir(dir) {
  return path.basename(path.resolve(dir)) || 'clad0 Project';
}

function minimalRoot(name) {
  return {
    id: 'catalogue-root',
    n: name || 'Catalogue Root',
    tag: 'Root',
    c: [],
    sn: '',
    r: '',
    gorge: false,
    ctx: false,
    theorized: false,
    fossil: false,
    curse: false,
    treeHidden: true,
    system: true,
    sid: 'k000001',
  };
}

function ensureEmptyDataDir(dataDir, name) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'prose'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'stats'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'media'), { recursive: true });

  const dataFile = path.join(dataDir, 'clado.json');
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(minimalRoot(name)), 'utf8');
  }

  const projectCfg = projectSettingsPath(dataDir);
  if (!fs.existsSync(projectCfg)) {
    writeJsonFile(projectCfg, defaultProjectSettings(name));
  }
}

function validateDataDir(dataDir) {
  const dataFile = path.join(dataDir, 'clado.json');
  if (!fs.existsSync(dataFile)) throw new Error(`This folder is not a clad0 /data folder: ${dataDir}\nMissing clado.json.`);
  const root = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  if (!root || typeof root !== 'object' || !root.id || !Array.isArray(root.c)) {
    throw new Error(`Invalid clad0 data file: ${dataFile}\nExpected a JSON root with id and c[].`);
  }
  fs.mkdirSync(path.join(dataDir, 'prose'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'stats'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'media'), { recursive: true });
  if (!fs.existsSync(projectSettingsPath(dataDir))) {
    writeJsonFile(projectSettingsPath(dataDir), defaultProjectSettings(displayNameFromDir(dataDir)));
  }
}


function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const item of fs.readdirSync(src)) copyRecursive(path.join(src, item), path.join(dst, item));
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

async function backupCurrentProject(parentWindow) {
  if (!currentProject) throw new Error('No active project.');
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Choose a folder to receive the project backup',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Back up here',
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const safeName = String(currentProject.name || 'clad0-project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'clad0-project';
  const backupDir = path.join(result.filePaths[0], safeName + '-backup-' + timestampForFilename());
  copyRecursive(currentProject.dataDir, backupDir);
  return { ok: true, path: backupDir };
}

function upsertProject(dataDir, name) {
  const resolved = path.resolve(dataDir);
  const state = readProjectState();
  let existing = state.projects.find(p => path.resolve(p.dataDir) === resolved);
  if (!existing) {
    existing = { id: projectId(), name: name || displayNameFromDir(resolved), dataDir: resolved, createdAt: new Date().toISOString() };
    state.projects.push(existing);
  } else if (name && existing.name !== name) {
    existing.name = name;
  }
  existing.lastOpenedAt = new Date().toISOString();
  state.activeProjectId = existing.id;
  writeProjectState(state);
  const projectSettings = readProjectSettings(resolved, existing.name);
  if (projectSettings.name && projectSettings.name !== existing.name) {
    existing.name = projectSettings.name;
    writeProjectState(state);
  }
  return existing;
}

async function promptForNewProject(parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Choose a folder for the new clad0 project /data',
    defaultPath: defaultProjectsRoot(),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Create project here',
  });
  if (result.canceled || !result.filePaths.length) return null;
  const dataDir = result.filePaths[0];
  const name = displayNameFromDir(dataDir);
  ensureEmptyDataDir(dataDir, name);
  return upsertProject(dataDir, name);
}

async function promptForExistingProject(parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Choose an existing clad0 /data folder',
    defaultPath: defaultProjectsRoot(),
    properties: ['openDirectory'],
    buttonLabel: 'Use this /data folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  const dataDir = result.filePaths[0];
  validateDataDir(dataDir);
  return upsertProject(dataDir, displayNameFromDir(dataDir));
}

function activeProject() {
  const state = readProjectState();
  let project = state.projects.find(p => p.id === state.activeProjectId) || state.projects[0] || null;
  if (!project) return null;
  validateDataDir(project.dataDir);
  const settings = readProjectSettings(project.dataDir, project.name);
  if (settings.name && settings.name !== project.name) project = upsertProject(project.dataDir, settings.name);
  return project;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) resolve();
          else throw new Error(`HTTP ${res.status}`);
        })
        .catch((err) => {
          if (Date.now() - started > timeoutMs) reject(err);
          else setTimeout(attempt, 150);
        });
    };
    attempt();
  });
}

function stopServer() {
  if (serverProcess) {
    const p = serverProcess;
    serverProcess = null;
    p.kill();
  }
}

async function startServer(project) {
  validateDataDir(project.dataDir);
  const port = await findFreePort();
  const entry = path.join(serverDir(), 'server.js');
  serverProcess = fork(entry, [], {
    cwd: serverDir(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      CLAD0_DATA_DIR: project.dataDir,
    },
    stdio: app.isPackaged ? 'ignore' : 'inherit',
  });

  serverProcess.on('exit', (code, signal) => {
    if (!serverProcess) return;
    serverProcess = null;
    if (!app.isQuiting && mainWindow) {
      dialog.showErrorBox('clad0 server stopped', `The local clad0 server exited (${code ?? signal ?? 'unknown'}).`);
      app.quit();
    }
  });

  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(url);
  currentProject = project;
  currentUrl = url;
  return url;
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: currentProject ? `clad0 — ${currentProject.name}` : 'clad0',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  hardenWindow(mainWindow);

  mainWindow.loadURL(url);
}

function setSunburstMenuChecked(checked) {
  sunburstMenuState = !!checked;
  if (sunburstMenuItem) sunburstMenuItem.checked = sunburstMenuState;
}

async function toggleSunburstFromMenu(menuItem) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const desired = !!menuItem.checked;
  try {
    const actual = await mainWindow.webContents.executeJavaScript(`
      Promise.resolve(window.clad0SetSunburst ? window.clad0SetSunburst(${desired ? 'true' : 'false'}) : false)
    `);
    setSunburstMenuChecked(actual);
  } catch {
    setSunburstMenuChecked(desired);
  }
}


function listMediaFiles(){
  if(!currentProject) throw new Error('No active project.');
  const mediaDir=path.join(currentProject.dataDir,'media');
  fs.mkdirSync(mediaDir,{recursive:true});
  const files=[];
  function walk(dir, rel=''){
    for(const name of fs.readdirSync(dir)){
      const full=path.join(dir,name); const st=fs.statSync(full); const r=path.join(rel,name);
      if(st.isDirectory()) walk(full,r);
      else files.push({ name, relativePath:r.replace(/\\/g,'/'), path:full, bytes:st.size, modifiedAt:st.mtime.toISOString(), url:(currentUrl||'')+'media/'+encodeURIComponent(r.replace(/\\/g,'/')).replace(/%2F/g,'/') });
    }
  }
  walk(mediaDir);
  return { project: currentProject, mediaDir, files: files.sort((a,b)=>a.relativePath.localeCompare(b.relativePath)) };
}

function attachEditorDirtyClose(win) {
  win._clad0Dirty = false;
  win._clad0Closing = false;
  win.on('close', async (event) => {
    if (win._clad0Closing || !win._clad0Dirty) return;
    event.preventDefault();
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Unsaved editor changes',
      message: 'Discard unsaved entry edits?',
      buttons: ['Discard', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });
    if (result.response !== 0) return;
    win._clad0Closing = true;
    win.close();
  });
}

function createMediaManagerWindow(){
  if(mediaManagerWindow && !mediaManagerWindow.isDestroyed()){ mediaManagerWindow.focus(); return mediaManagerWindow; }
  const win=new BrowserWindow({ width:1120, height:760, minWidth:820, minHeight:560, title:'clad0 Media Library', autoHideMenuBar:true, webPreferences:{ preload:path.join(__dirname,'preload-media.js'), contextIsolation:true, nodeIntegration:false, sandbox:false }});
  mediaManagerWindow=win; win.on('closed',()=>{ mediaManagerWindow=null; });
  win.loadFile(path.join(__dirname,'media-manager.html'));
  return win;
}
async function exportPdfFromHtml(parentWindow, payload){
  if(!payload || !payload.html) throw new Error('Missing PDF HTML.');
  const result=await dialog.showSaveDialog(parentWindow,{ title:'Export PDF', defaultPath:path.join(app.getPath('documents'), String(payload.filename||'entry.pdf')), filters:[{name:'PDF',extensions:['pdf']}] });
  if(result.canceled || !result.filePath) return { canceled:true };
  const win=new BrowserWindow({ show:false, webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:true }});
  try{
    await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(payload.html));
    const pdf=await win.webContents.printToPDF({ printBackground:true, pageSize:'Letter', margins:{ marginType:'default' } });
    fs.writeFileSync(result.filePath, pdf);
    return { ok:true, path:result.filePath };
  } finally { if(!win.isDestroyed()) win.destroy(); }
}

function createEditorWindow(entryId, fieldKey) {
  if (!currentUrl) throw new Error('No active project server URL.');
  const win = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: 'clad0 Entry Editor',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  editorWindows.add(win);
  attachEditorDirtyClose(win);
  win.on('closed', () => editorWindows.delete(win));
  hardenWindow(win);
  const u = new URL(currentUrl);
  u.searchParams.set('editor', String(entryId || ''));
  if (fieldKey) u.searchParams.set('editorField', String(fieldKey));
  win.once('ready-to-show', () => win.show());
  win.loadURL(u.toString());
  return win;
}

function createViewerWindow(entryId) {
  if (!currentUrl) throw new Error('No active project server URL.');
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    title: 'clad0 Viewer',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-main.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  hardenWindow(win);
  const u = new URL(currentUrl);
  if (entryId) u.searchParams.set('entry', String(entryId));
  win.loadURL(u.toString());
  return win;
}

function sendEntryAction(webContents, action, id, extra = {}) {
  if (webContents && !webContents.isDestroyed()) webContents.send('entry:contextAction', { action, id, ...extra });
}

function buildEntryContextMenu(sender, payload = {}) {
  const id = String(payload.id || '');
  const name = String(payload.name || id || 'Entry');
  const isRoot = !!payload.isRoot;
  const allowEdits = payload.allowEdits !== false;
  const templates = Array.isArray(payload.templates) ? payload.templates : [];
  const menuItems = [];
  if (allowEdits) {
    menuItems.push({ label: 'Edit entry', click: () => createEditorWindow(id) });
    menuItems.push({ label: 'Open in New Viewer Window', click: () => createViewerWindow(id) });
    menuItems.push({ label: 'Add child', click: () => sendEntryAction(sender, 'addChild', id) });
    menuItems.push({
      label: 'New child from template',
      submenu: [{ label: 'Empty entry', click: () => sendEntryAction(sender, 'addChild', id) }].concat(templates.map(t => ({
        label: String(t.name || t.id || 'Template'),
        click: () => sendEntryAction(sender, 'addFromTemplate', id, { templateId: t.id }),
      }))),
    });
    menuItems.push({ label: 'Duplicate (with subtree)', click: () => sendEntryAction(sender, 'duplicate', id) });
    menuItems.push({ type: 'separator' });
  } else {
    menuItems.push({ label: 'Open in Editor Window', enabled: false });
    menuItems.push({ label: 'Open in New Viewer Window', click: () => createViewerWindow(id) });
  }
  menuItems.push({
    label: 'Export as…',
    submenu: [
      { label: 'JSON (entry)', click: () => sendEntryAction(sender, 'export', id, { format: 'json', scope: 'entry' }) },
      { label: 'Markdown (entry)', click: () => sendEntryAction(sender, 'export', id, { format: 'markdown', scope: 'entry' }) },
      { label: 'PDF (entry)', click: () => sendEntryAction(sender, 'export', id, { format: 'pdf', scope: 'entry' }) },
      { type: 'separator' },
      { label: 'JSON (subtree)', click: () => sendEntryAction(sender, 'export', id, { format: 'json', scope: 'subtree' }) },
      { label: 'Markdown (subtree)', click: () => sendEntryAction(sender, 'export', id, { format: 'markdown', scope: 'subtree' }) },
      { label: 'PDF (subtree)', click: () => sendEntryAction(sender, 'export', id, { format: 'pdf', scope: 'subtree' }) },
    ],
  });
  if (allowEdits && !isRoot) {
    menuItems.push({ type: 'separator' });
    menuItems.push({ label: 'Delete…', click: () => sendEntryAction(sender, 'delete', id) });
  }
  return Menu.buildFromTemplate([{ label: name, enabled: false }, { type: 'separator' }, ...menuItems]);
}

function installMenu() {
  const projectSettingsForMenu = currentProject ? readProjectSettings(currentProject.dataDir, currentProject.name) : null;
  const sunburstEnabledForMenu = !projectSettingsForMenu || !projectSettingsForMenu.features || projectSettingsForMenu.features.sunburstEnabled !== false;
  const template = [
    {
      label: 'Project',
      submenu: [
        { label: 'Switch Project…', click: () => showProjectPicker({ switching: true }) },
        { label: 'Create Empty Project…', click: async () => { const p = await promptForNewProject(mainWindow); if (p) await switchToProject(p); } },
        { label: 'Use Existing Data Folder…', click: async () => { const p = await promptForExistingProject(mainWindow); if (p) await switchToProject(p); } },
        { type: 'separator' },
        { label: 'Project Settings…', click: () => showProjectSettingsWindow() },
        { label: 'App Settings…', click: () => showAppSettingsWindow() },
        { type: 'separator' },
        { label: 'Open Data Folder', click: () => { if (currentProject) shell.openPath(currentProject.dataDir); } },
        { label: 'Media Library Manager…', click: () => createMediaManagerWindow(), enabled: !!currentProject },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => { if (mainWindow) mainWindow.reload(); } },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Sunburst View',
          type: 'checkbox',
          checked: sunburstEnabledForMenu ? sunburstMenuState : false,
          enabled: sunburstEnabledForMenu,
          click: toggleSunburstFromMenu,
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools', visible: readAppSettings().advanced && readAppSettings().advanced.developerTools },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  sunburstMenuItem = menu.items[1].submenu.items[0];
}

function createProjectWindow() {
  if (projectWindow && !projectWindow.isDestroyed()) {
    projectWindow.focus();
    return projectWindow;
  }
  projectWindow = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 720,
    minHeight: 500,
    title: 'Choose clad0 Project',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-projects.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  projectWindow.loadFile(path.join(__dirname, 'project-picker.html'));
  projectWindow.on('closed', () => { projectWindow = null; });
  return projectWindow;
}

function showProjectPicker() {
  createProjectWindow();
}


function attachDirtyClose(win) {
  win._clad0Dirty = false;
  win._clad0Closing = false;
  win.on('close', async (event) => {
    if (win._clad0Closing || !win._clad0Dirty) return;
    event.preventDefault();
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Unsaved changes',
      message: 'Save changes before closing?',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
    if (result.response === 2) return;
    if (result.response === 0) {
      try { await win.webContents.executeJavaScript('window.clad0SettingsPage && window.clad0SettingsPage.saveNow()'); }
      catch (err) { dialog.showErrorBox('Unable to save settings', err && err.message ? err.message : String(err)); return; }
    }
    win._clad0Closing = true;
    win.close();
  });
}

function createSettingsWindow(kind) {
  const isApp = kind === 'app';
  const title = isApp ? 'clad0 App Settings' : 'clad0 Project Settings';
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    title,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, isApp ? 'app-settings.html' : 'project-settings.html'));
  attachDirtyClose(win);
  win.on('closed', () => { if (isApp) appSettingsWindow = null; else projectSettingsWindow = null; });
  return win;
}

function showProjectSettingsWindow() {
  if (projectSettingsWindow && !projectSettingsWindow.isDestroyed()) { projectSettingsWindow.focus(); return projectSettingsWindow; }
  projectSettingsWindow = createSettingsWindow('project');
  return projectSettingsWindow;
}

function showAppSettingsWindow() {
  if (appSettingsWindow && !appSettingsWindow.isDestroyed()) { appSettingsWindow.focus(); return appSettingsWindow; }
  appSettingsWindow = createSettingsWindow('app');
  return appSettingsWindow;
}

async function switchToProject(project) {
  if (!project) return;
  validateDataDir(project.dataDir);
  const normalized = upsertProject(project.dataDir, project.name);
  const pSettings = readProjectSettings(normalized.dataDir, normalized.name);
  normalized.name = pSettings.name || normalized.name;
  stopServer();
  const url = await startServer(normalized);
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow(url);
  else {
    mainWindow.setTitle(`clad0 — ${normalized.name}`);
    await mainWindow.loadURL(url);
  }
  setSunburstMenuChecked(false);
  if (projectWindow && !projectWindow.isDestroyed()) projectWindow.close();
}


const THEME_LABELS = {
  parchment: 'Default Parchment',
  'wiki-whitepage': 'Wiki Whitepage',
  'discord-dark': 'Discord Dark',
  'scifi-solar': 'Sci-Fi Solarized',
};
const CORE_THEME_ORDER = ['parchment', 'wiki-whitepage', 'discord-dark', 'scifi-solar'];
function themeLabel(id) { return THEME_LABELS[id] || String(id || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function sortThemeIds(ids) {
  return ids.sort((a, b) => {
    const ai = CORE_THEME_ORDER.indexOf(a), bi = CORE_THEME_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
}
function availableThemes() {
  const themeDir = path.join(serverDir(), 'public', 'themes');
  try {
    return CORE_THEME_ORDER.filter(id => fs.existsSync(path.join(themeDir, id + '.css')))
      .map(id => ({ id, label: themeLabel(id), href: '/themes/' + id + '.css' }));
  } catch {
    return [];
  }
}
function availableShellThemes() {
  const themeDir = path.join(__dirname, 'shell-themes');
  try {
    return CORE_THEME_ORDER.filter(id => fs.existsSync(path.join(themeDir, id + '.css')))
      .map(id => ({ id, label: themeLabel(id), href: './shell-themes/' + id + '.css' }));
  } catch {
    return CORE_THEME_ORDER.map(id => ({ id, label: themeLabel(id), href: './shell-themes/' + id + '.css' }));
  }
}

function updateProjectRegistryName(projectIdToUpdate, name) {
  const state = readProjectState();
  const project = state.projects.find(p => p.id === projectIdToUpdate);
  if (project) {
    project.name = name;
    writeProjectState(state);
    if (currentProject && currentProject.id === project.id) currentProject.name = name;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(`clad0 — ${name}`);
  }
}

ipcMain.handle('projects:list', () => readProjectState());
ipcMain.handle('projects:select', async (_event, id) => {
  const state = readProjectState();
  const project = state.projects.find(p => p.id === id);
  if (!project) throw new Error('Project not found.');
  await switchToProject(project);
  return { ok: true };
});
ipcMain.handle('projects:create', async (event) => {
  const p = await promptForNewProject(BrowserWindow.fromWebContents(event.sender));
  if (p) await switchToProject(p);
  return p || { canceled: true };
});
ipcMain.handle('projects:addExisting', async (event) => {
  const p = await promptForExistingProject(BrowserWindow.fromWebContents(event.sender));
  if (p) await switchToProject(p);
  return p || { canceled: true };
});
ipcMain.handle('projects:reveal', async (_event, id) => {
  const state = readProjectState();
  const project = state.projects.find(p => p.id === id);
  if (!project) throw new Error('Project not found.');
  await shell.openPath(project.dataDir);
  return { ok: true };
});

ipcMain.on('view:sunburstState', (_event, state) => {
  setSunburstMenuChecked(!!state);
});

ipcMain.handle('settings:get', (_event, kind) => {
  if (kind === 'app') {
    return {
      kind: 'app',
      settings: readAppSettings(),
      paths: {
        appConfigFolder: app.getPath('userData'),
        appSettingsPath: appSettingsPath(),
        projectsRegistryPath: configPath(),
        defaultProjectsRoot: defaultProjectsRoot(),
        advancedInstallFolder: installFolder(),
        advancedAppRoot: appRoot(),
      },
      shellThemes: availableShellThemes(),
      app: {
        name: app.getName(),
        version: app.getVersion(),
        packaged: app.isPackaged,
      },
    };
  }
  if (!currentProject) throw new Error('No active project.');
  return {
    kind: 'project',
    project: currentProject,
    settings: readProjectSettings(currentProject.dataDir, currentProject.name),
    paths: {
      dataDir: currentProject.dataDir,
      projectSettingsPath: projectSettingsPath(currentProject.dataDir),
      cladoJsonPath: path.join(currentProject.dataDir, 'clado.json'),
      proseDir: path.join(currentProject.dataDir, 'prose'),
      statsDir: path.join(currentProject.dataDir, 'stats'),
      mediaDir: path.join(currentProject.dataDir, 'media'),
    },
    themes: availableThemes(),
    shellTheme: readAppSettings().appearance && readAppSettings().appearance.theme || 'parchment',
  };
});

ipcMain.handle('settings:save', (_event, kind, payload) => {
  if (kind === 'app') {
    const settings = writeAppSettings(payload || {});
    installMenu();
    return settings;
  }
  if (!currentProject) throw new Error('No active project.');
  const settings = writeProjectSettings(currentProject.dataDir, payload || {});
  updateProjectRegistryName(currentProject.id, settings.name);
  installMenu();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('project-settings:updated', settings);
  return settings;
});

ipcMain.on('settings:dirty', (event, dirty) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win._clad0Dirty = !!dirty;
});

ipcMain.handle('project:backup', async (event) => {
  return backupCurrentProject(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.handle('settings:openPath', async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') throw new Error('Missing path.');
  const roots = [app.getPath('userData'), defaultProjectsRoot(), installFolder(), appRoot()];
  if (currentProject) roots.push(currentProject.dataDir);
  if (!roots.some((r) => pathWithin(targetPath, r))) throw new Error('Refused to open a path outside known app/project folders.');
  await shell.openPath(targetPath);
  return { ok: true };
});



ipcMain.handle('media:list', () => listMediaFiles());
ipcMain.handle('media:openFile', async (_event, filePath) => { if(!filePath) throw new Error('Missing file path.'); if(!currentProject) throw new Error('No active project.'); const mediaRoot=path.join(currentProject.dataDir,'media'); if(!pathWithin(filePath, mediaRoot)) throw new Error('Refused to open a file outside the project media folder.'); await shell.openPath(filePath); return { ok:true }; });
ipcMain.handle('media:openFolder', async () => { if(!currentProject) throw new Error('No active project.'); await shell.openPath(path.join(currentProject.dataDir,'media')); return { ok:true }; });
ipcMain.handle('export:pdf', async (event, payload) => exportPdfFromHtml(BrowserWindow.fromWebContents(event.sender), payload));

ipcMain.handle('app:getShellTheme', () => {
  const settings = readAppSettings();
  return settings.appearance && settings.appearance.theme || 'parchment';
});

ipcMain.handle('entry:openEditorWindow', (_event, id, field) => {
  createEditorWindow(id, field);
  return { ok: true };
});

ipcMain.handle('entry:openViewerWindow', (_event, id) => {
  createViewerWindow(id);
  return { ok: true };
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
  return { ok: true };
});

ipcMain.handle('entry:contextMenu', (event, payload) => {
  const menu = buildEntryContextMenu(event.sender, payload || {});
  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win || undefined });
  return { ok: true };
});
ipcMain.handle('editor:setDirty', (event, dirty) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win._clad0Dirty = !!dirty;
  return { ok: true };
});

ipcMain.handle('entry:saved', (event, id) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents && win.webContents !== event.sender) {
      win.webContents.send('entry:saved', id || null);
    }
  }
  return { ok: true };
});


if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
app.on('second-instance', () => {
  const win = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : BrowserWindow.getAllWindows()[0];
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(async () => {
  writeAppSettings(readAppSettings());
  installMenu();
  try {
    const settings = readAppSettings();
    const project = settings.startup && settings.startup.openProjectPickerOnLaunch ? null : activeProject();
    if (project) {
      const url = await startServer(project);
      createMainWindow(url);
    } else {
      showProjectPicker();
    }
  } catch (err) {
    dialog.showErrorBox('Unable to start clad0', err && err.stack ? err.stack : String(err));
    showProjectPicker();
  }
});
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (currentUrl) createMainWindow(currentUrl);
    else showProjectPicker();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  app.quit();
});
