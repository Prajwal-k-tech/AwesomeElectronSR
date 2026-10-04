const fs = require('node:fs/promises');
const path = require('node:path');

async function saveRecording({ buffer, owner, dialog, options, fsImpl = fs, pid = process.pid, now = Date.now() }) {
  const result = owner && !owner.isDestroyed()
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false };

  let filePath = result.filePath;
  if (path.extname(filePath).toLowerCase() !== '.webm') filePath += '.webm';
  const temporaryPath = `${filePath}.screenrec-${pid}-${now}.tmp`;
  try {
    await fsImpl.writeFile(temporaryPath, buffer, { flag: 'wx' });
    await fsImpl.rename(temporaryPath, filePath);
  } catch (error) {
    await fsImpl.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return { saved: true, path: filePath };
}

module.exports = { saveRecording };
