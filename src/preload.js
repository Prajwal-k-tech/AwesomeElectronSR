const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
});
