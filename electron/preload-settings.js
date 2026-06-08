'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clad0Settings', {
  get: (kind) => ipcRenderer.invoke('settings:get', kind),
  save: (kind, payload) => ipcRenderer.invoke('settings:save', kind, payload),
  openPath: (targetPath) => ipcRenderer.invoke('settings:openPath', targetPath),
  setDirty: (dirty) => ipcRenderer.send('settings:dirty', !!dirty),
  backupProject: () => ipcRenderer.invoke('project:backup'),
});
