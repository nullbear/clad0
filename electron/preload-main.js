'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clad0Desktop', {
  isShell: true,
  setSunburstState: (active) => ipcRenderer.send('view:sunburstState', !!active),
  showEntryContextMenu: (payload) => ipcRenderer.invoke('entry:contextMenu', payload),
  openEditorWindow: (id, field) => ipcRenderer.invoke('entry:openEditorWindow', id, field),
  openViewerWindow: (id) => ipcRenderer.invoke('entry:openViewerWindow', id),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  getShellTheme: () => ipcRenderer.invoke('app:getShellTheme'),
  notifyEntrySaved: (id) => ipcRenderer.invoke('entry:saved', id),
  setEditorDirty: (dirty) => ipcRenderer.invoke('editor:setDirty', !!dirty),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
});

ipcRenderer.on('project-settings:updated', () => {
  window.dispatchEvent(new Event('project-settings:updated'));
});


ipcRenderer.on('entry:contextAction', (_event, action) => {
  window.dispatchEvent(new CustomEvent('entry:contextAction', { detail: action }));
});

ipcRenderer.on('entry:saved', (_event, id) => {
  window.dispatchEvent(new CustomEvent('entry:saved', { detail: { id } }));
});
