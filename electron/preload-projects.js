'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clad0Projects', {
  list: () => ipcRenderer.invoke('projects:list'),
  select: (id) => ipcRenderer.invoke('projects:select', id),
  create: () => ipcRenderer.invoke('projects:create'),
  addExisting: () => ipcRenderer.invoke('projects:addExisting'),
  reveal: (id) => ipcRenderer.invoke('projects:reveal', id),
});
