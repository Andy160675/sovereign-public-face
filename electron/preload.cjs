/**
 * Sovereign Sanctuary Systems — Electron Preload
 * Exposes safe APIs to the renderer process via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sovereign', {
  platform: process.platform,
  isElectron: true,
  version: process.env.npm_package_version || '1.0.0',
  
  // Safe IPC methods
  send: (channel, data) => {
    const validChannels = ['navigate', 'notification', 'update-check'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    const validChannels = ['update-available', 'notification-response'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
