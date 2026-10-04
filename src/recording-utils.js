(function exposeRecordingUtils(root, factory) {
  const utils = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
  if (root) {
    root.ScreenRecorderUtils = utils;
  }
})(typeof window === 'undefined' ? null : window, function createRecordingUtils() {
  const MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  function createMediaRecorder(stream, MediaRecorderImpl = globalThis.MediaRecorder) {
    if (typeof MediaRecorderImpl !== 'function') {
      throw new Error('MediaRecorder is not available in this Electron build.');
    }

    for (const mimeType of MIME_TYPES) {
      let supported = true;
      if (typeof MediaRecorderImpl.isTypeSupported === 'function') {
        try {
          supported = MediaRecorderImpl.isTypeSupported(mimeType);
        } catch {
          supported = false;
        }
      }
      if (!supported) continue;

      try {
        const recorder = new MediaRecorderImpl(stream, { mimeType });
        return { recorder, mimeType: recorder.mimeType || mimeType };
      } catch {
        // Some Chromium builds report support but still reject construction.
      }
    }

    try {
      const recorder = new MediaRecorderImpl(stream);
      return { recorder, mimeType: recorder.mimeType || 'video/webm' };
    } catch (error) {
      throw new Error(`This system cannot record the selected source: ${error.message}`);
    }
  }

  function stopTracks(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;

    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // A track may already have ended while a source is being replaced.
      }
    }
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    const pad = (number) => String(number).padStart(2, '0');

    return hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(remainder)}`
      : `${pad(minutes)}:${pad(remainder)}`;
  }

  return { MIME_TYPES, createMediaRecorder, stopTracks, formatTime };
});
