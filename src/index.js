const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window with proper settings
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#121212',
    title: 'Electron Screen Recorder',
    icon: path.join(__dirname, 'icon.png'),
  });

  // Load the index.html
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  

};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle saving the recorded video
ipcMain.handle('save-recording', async (event, buffer) => {
  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save Recording',
    defaultPath: `recording-${Date.now()}.webm`,
    filters: [
      { name: 'WebM files', extensions: ['webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (filePath) {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { saved: true, path: filePath };
  }
  
  return { saved: false };
});

// Handle getting sources
ipcMain.handle('get-sources', async () => {
  const { desktopCapturer } = require('electron');
  return await desktopCapturer.getSources({ 
    types: ['window', 'screen'],
    thumbnailSize: { width: 150, height: 150 }
  });
});
