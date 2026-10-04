const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { saveRecording } = require('../src/recording-save');

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'screenrec-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('saves exact recording bytes atomically and adds the WebM extension', async (t) => {
  const directory = await temporaryDirectory(t);
  const destination = path.join(directory, 'capture');
  const bytes = Buffer.from('synthetic video bytes');
  const dialogCalls = [];
  const result = await saveRecording({
    buffer: bytes,
    owner: { isDestroyed: () => false },
    dialog: { showSaveDialog: async (...args) => {
      dialogCalls.push(args);
      return { canceled: false, filePath: destination };
    } },
    options: { title: 'Save WebM recording' },
    pid: 123,
    now: 456,
  });

  assert.deepEqual(result, { saved: true, path: `${destination}.webm` });
  assert.deepEqual(await fs.readFile(result.path), bytes);
  assert.equal(dialogCalls[0][0].isDestroyed(), false);
  assert.equal(dialogCalls[0][1].title, 'Save WebM recording');
  assert.deepEqual(await fs.readdir(directory), ['capture.webm']);
});

test('reports save-dialog cancellation without creating a file', async (t) => {
  const directory = await temporaryDirectory(t);
  const result = await saveRecording({
    buffer: Buffer.from('synthetic video bytes'),
    dialog: { showSaveDialog: async () => ({ canceled: true }) },
    options: {},
  });

  assert.deepEqual(result, { saved: false });
  assert.deepEqual(await fs.readdir(directory), []);
});

test('removes the temporary file if the final rename fails', async (t) => {
  const directory = await temporaryDirectory(t);
  const destination = path.join(directory, 'capture.webm');
  const fsImpl = {
    writeFile: fs.writeFile,
    rm: fs.rm,
    rename: async () => { throw new Error('simulated disk failure'); },
  };

  await assert.rejects(saveRecording({
    buffer: Buffer.from('synthetic video bytes'),
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) },
    options: {},
    fsImpl,
    pid: 123,
    now: 456,
  }), /simulated disk failure/);
  assert.deepEqual(await fs.readdir(directory), []);
});
