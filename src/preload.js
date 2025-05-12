const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get available sources for screen recording
  getSources: async () => {
    return await ipcRenderer.invoke('get-sources');
  },
  
  // Save recording buffer
  saveRecording: async (buffer) => {
    return await ipcRenderer.invoke('save-recording', buffer);
  }
});

// Add extra utilities for better UI experience
contextBridge.exposeInMainWorld('utils', {
  formatTime: (seconds) => {
    const pad = (num) => num.toString().padStart(2, '0');
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return `${pad(minutes)}:${pad(Math.floor(seconds))}`;
  }
});
