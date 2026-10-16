const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  dragStart: (id) => ipcRenderer.send('drag-start', id),
  dragMove: () => ipcRenderer.send('drag-move'),
  pointerUp: (id) => ipcRenderer.send('pointer-up', id),
  setInteractive: (on) => ipcRenderer.send('interactive', on),
  resetPosition: () => ipcRenderer.send('reset-position'),
  setMenuSpace: (extra) => ipcRenderer.invoke('set-menu-space', extra),
  quit: () => ipcRenderer.send('quit'),
  getState: () => ipcRenderer.invoke('get-state'),
  getBalance: (refresh) => ipcRenderer.invoke('get-balance', refresh === true),
  getToday: () => ipcRenderer.invoke('get-today'),
  say: (text) => ipcRenderer.invoke('say', text),
  onNotice: (callback) => {
    ipcRenderer.on('notice', (_event, payload) => callback(payload));
  },
  onOverride: (callback) => {
    ipcRenderer.on('override', (_event, value) => callback(value));
  },
});
