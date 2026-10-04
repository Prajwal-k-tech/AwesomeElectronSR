const test = require('node:test');
const assert = require('node:assert/strict');
const { createMediaRecorder, formatTime, stopTracks } = require('../src/recording-utils');

test('selects the first supported WebM codec', () => {
  const attempts = [];
  class FakeRecorder {
    static isTypeSupported(type) { return type.includes('vp8,opus') || type === 'video/webm'; }
    constructor(_stream, options) {
      attempts.push(options?.mimeType);
      this.mimeType = options.mimeType;
    }
  }

  const result = createMediaRecorder({}, FakeRecorder);
  assert.equal(result.mimeType, 'video/webm;codecs=vp8,opus');
  assert.deepEqual(attempts, ['video/webm;codecs=vp8,opus']);
});

test('tries a later codec when Chromium reports a codec supported but rejects its constructor', () => {
  const attempts = [];
  class FakeRecorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) {
      attempts.push(options?.mimeType);
      if (options?.mimeType.includes('vp9')) throw new Error('unsupported encoder');
      this.mimeType = options?.mimeType || 'video/webm';
    }
  }

  const result = createMediaRecorder({}, FakeRecorder);
  assert.equal(result.mimeType, 'video/webm;codecs=vp8,opus');
  assert.deepEqual(attempts, [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
  ]);
});

test('uses the browser-selected format when no explicit WebM MIME type is supported', () => {
  let optionsUsed;
  class FakeRecorder {
    static isTypeSupported() { return false; }
    constructor(_stream, options) {
      optionsUsed = options;
      this.mimeType = '';
    }
  }

  const result = createMediaRecorder({}, FakeRecorder);
  assert.equal(optionsUsed, undefined);
  assert.equal(result.mimeType, 'video/webm');
});

test('reports when MediaRecorder cannot be constructed in any supported format', () => {
  class FakeRecorder {
    static isTypeSupported() { return true; }
    constructor() { throw new Error('encoder unavailable'); }
  }

  assert.throws(() => createMediaRecorder({}, FakeRecorder), /cannot record.*encoder unavailable/i);
});

test('stops every capture track even if one track already threw', () => {
  const stopped = [];
  const stream = {
    getTracks: () => [
      { stop: () => stopped.push('video') },
      { stop: () => { stopped.push('audio'); throw new Error('already stopped'); } },
      { stop: () => stopped.push('second video') },
    ],
  };

  stopTracks(stream);
  stopTracks(null);
  assert.deepEqual(stopped, ['video', 'audio', 'second video']);
});

test('formats short and long recording durations', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65.9), '01:05');
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(3600), '01:00:00');
});
