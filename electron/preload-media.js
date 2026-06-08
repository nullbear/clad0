'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clad0Media', {
  list: () => ipcRenderer.invoke('media:list'),
  openFile: (filePath) => ipcRenderer.invoke('media:openFile', filePath),
  openFolder: () => ipcRenderer.invoke('media:openFolder'),
  getShellTheme: () => ipcRenderer.invoke('app:getShellTheme'),
});
