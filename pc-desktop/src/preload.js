const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tapbridge', {
  onStatus: (handler) => {
    ipcRenderer.on('status-update', (_event, payload) => {
      handler(payload);
    });
  }
});
