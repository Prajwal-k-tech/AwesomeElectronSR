const { app, BrowserWindow, desktopCapturer, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { saveRecording } = require('./recording-save');

if (require('electron-squirrel-startup')) app.quit();

const INDEX_FILE = path.join(__dirname, 'index.html');
const MAX_RECORDING_BYTES = 2 * 1024 * 1024 * 1024;

function createWindow() {
  const window = new BrowserWindow({
    width: 1040,
    height: 790,
    minWidth: 600,
    minHeight: 570,
    backgroundColor: '#111319',
    title: 'Screen Recorder',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.loadFile(INDEX_FILE);
  return window;
}

function assertTrustedRenderer(event) {
  let senderFile;
  try {
    senderFile = fileURLToPath(event.senderFrame.url);
  } catch {
    throw new Error('This request must come from the Screen Recorder window.');
  }
  if (path.resolve(senderFile) !== path.resolve(INDEX_FILE)) {
    throw new Error('This request must come from the Screen Recorder window.');
  }
}

function recordingBufferFrom(value) {
  let buffer;
  if (value instanceof ArrayBuffer) {
    buffer = Buffer.from(value);
  } else if (ArrayBuffer.isView(value)) {
    buffer = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  } else if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    buffer = Buffer.from(value.data);
  } else {
    throw new Error('The recording data was not in a supported format.');
  }

  if (buffer.length === 0) throw new Error('The recording is empty.');
  if (buffer.length > MAX_RECORDING_BYTES) {
    throw new Error('This recording is too large to save (maximum 2 GB).');
  }
  return buffer;
}

ipcMain.handle('get-sources', async (event) => {
  assertTrustedRenderer(event);
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 240, height: 135 },
  });

  // Electron NativeImage and DesktopCapturerSource objects cannot be cloned
  // through IPC. Send only ordinary data and encode the small preview locally.
  return sources.map((source) => ({
    id: source.id,
    name: source.name || 'Desktop capture source',
    thumbnailDataUrl: source.thumbnail && !source.thumbnail.isEmpty()
      ? source.thumbnail.toDataURL()
      : '',
  }));
});

ipcMain.handle('save-recording', async (event, data) => {
  assertTrustedRenderer(event);
  const buffer = recordingBufferFrom(data);
  const owner = BrowserWindow.fromWebContents(event.sender);
  const defaultName = `ScreenRec-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
  const options = {
    title: 'Save WebM recording',
    buttonLabel: 'Save recording',
    defaultPath: path.join(app.getPath('videos'), defaultName),
    filters: [{ name: 'WebM video', extensions: ['webm'] }],
  };

  return saveRecording({ buffer, owner, dialog, options });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
