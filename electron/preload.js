const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // System Info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getVolumes: () => ipcRenderer.invoke('get-volumes'),
  getDrives: () => ipcRenderer.invoke('list-drives'),
  
  // Wipe Operations
  startWipe: (wipeParams) => ipcRenderer.invoke('start-wipe', wipeParams),
  stopWipe: (wipeId) => ipcRenderer.invoke('stop-wipe', wipeId),
  getWipeStatus: (wipeId) => ipcRenderer.invoke('get-wipe-status', wipeId),
  cleanupWipeHistory: () => ipcRenderer.invoke('cleanup-wipe-history'),
  
  // Certificate Management
  generateCertificate: (data) => ipcRenderer.invoke('generate-certificate', data),
  getCertificates: () => ipcRenderer.invoke('get-certificates'),
  downloadCertificatePdf: (certificateId) => ipcRenderer.invoke('download-certificate-pdf', certificateId),
  
  // Native Addon Testing
  testAddon: () => ipcRenderer.invoke('test-addon'),
  
  // Event Listeners for real-time updates
  onWipeProgress: (callback) => {
    ipcRenderer.on('wipe-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('wipe-progress');
  },
  
  onWipeStarted: (callback) => {
    ipcRenderer.on('wipe-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('wipe-started');
  },
  
  onWipeCompleted: (callback) => {
    ipcRenderer.on('wipe-completed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('wipe-completed');
  },
  
  onWipeError: (callback) => {
    ipcRenderer.on('wipe-error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('wipe-error');
  },
  
  onWipeCancelled: (callback) => {
    ipcRenderer.on('wipe-cancelled', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('wipe-cancelled');
  },
  
  // Generic send/receive (keeping for backward compatibility)
  send: (channel, data) => {
    const validChannels = ['wipe-progress', 'wipe-started', 'wipe-completed', 'wipe-error', 'wipe-cancelled'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    const validChannels = ['wipe-progress', 'wipe-started', 'wipe-completed', 'wipe-error', 'wipe-cancelled'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Remove specific listener
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});