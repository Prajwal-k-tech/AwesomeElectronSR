const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const timer = document.getElementById('timer');
const statusMessage = document.getElementById('statusMessage');
const sourceBtn = document.getElementById('sourceBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearSourceBtn = document.getElementById('clearSourceBtn');
const saveAgainBtn = document.getElementById('saveAgainBtn');
const discardBtn = document.getElementById('discardBtn');
const audioToggle = document.getElementById('audioToggle');
const sourceModal = document.getElementById('sourceModal');
const sourcesList = document.getElementById('sourcesList');
const closeModal = document.getElementById('closeModal');

const { createMediaRecorder, stopTracks, formatTime } = window.ScreenRecorderUtils;

let state = 'idle';
let selectedSource = null;
let captureStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let pendingBlob = null;
let startedAt = 0;
let timerInterval = null;
let captureRequest = 0;
let sourceListRequest = 0;
let recorderError = null;
let recordingEndReason = 'manual';

sourceBtn.addEventListener('click', openSourcePicker);
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', () => stopRecording('manual'));
clearSourceBtn.addEventListener('click', stopPreview);
saveAgainBtn.addEventListener('click', savePendingRecording);
discardBtn.addEventListener('click', discardPendingRecording);
closeModal.addEventListener('click', closeSourcePicker);
audioToggle.addEventListener('change', handleAudioToggle);

sourceModal.addEventListener('click', (event) => {
  if (event.target === sourceModal) closeSourcePicker();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !sourceModal.hidden) closeSourcePicker();
});

window.addEventListener('pagehide', () => {
  captureRequest += 1;
  sourceListRequest += 1;
  clearInterval(timerInterval);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {
      // The recorder may already have stopped as the window is closing.
    }
  }
  mediaRecorder = null;
  recordedChunks = [];
  pendingBlob = null;
  releaseCapture();
});

renderControls();

async function openSourcePicker() {
  const request = ++sourceListRequest;
  sourceModal.hidden = false;
  sourcesList.replaceChildren(makeEmptyMessage('Looking for screens and windows…'));
  closeModal.focus();

  try {
    const sources = await window.electronAPI.getSources();
    if (request !== sourceListRequest || sourceModal.hidden) return;

    sourcesList.replaceChildren();
    if (sources.length === 0) {
      sourcesList.append(makeEmptyMessage('No capture sources are available. Check your desktop capture permissions and try again.'));
      return;
    }

    for (const source of sources) {
      const item = document.createElement('button');
      item.className = 'source-item';
      item.type = 'button';
      item.setAttribute('aria-label', `Preview ${source.name}`);

      if (source.thumbnailDataUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = source.thumbnailDataUrl;
        thumbnail.alt = '';
        thumbnail.draggable = false;
        item.append(thumbnail);
      } else {
        const emptyThumbnail = document.createElement('span');
        emptyThumbnail.className = 'source-placeholder';
        emptyThumbnail.textContent = 'Preview unavailable';
        item.append(emptyThumbnail);
      }

      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = source.name;
      item.append(name);
      item.addEventListener('click', () => {
        closeSourcePicker();
        void selectSource(source);
      });
      sourcesList.append(item);
    }
  } catch (error) {
    if (request !== sourceListRequest || sourceModal.hidden) return;
    sourcesList.replaceChildren(makeEmptyMessage(error.message || 'Could not list capture sources. Try again.'));
    setStatus('Could not list screens and windows. Check desktop capture permissions, then try again.', 'error');
  }
}

function closeSourcePicker() {
  sourceListRequest += 1;
  sourceModal.hidden = true;
  sourceBtn.focus();
}

function makeEmptyMessage(message) {
  const element = document.createElement('p');
  element.className = 'empty-sources';
  element.textContent = message;
  return element;
}

async function selectSource(source) {
  if (!['idle', 'ready'].includes(state)) return;

  const request = ++captureRequest;
  const previousStream = captureStream;
  const requestedAudio = audioToggle.checked;
  state = 'previewing';
  renderControls();
  setStatus(`Preparing preview for ${source.name}…`);

  let nextStream;
  let audioWarning = '';
  try {
    if (requestedAudio) {
      try {
        nextStream = await requestCapture(source, true);
        if (nextStream.getAudioTracks().length === 0) {
          audioWarning = 'System audio was not provided by this source.';
        }
      } catch {
        nextStream = await requestCapture(source, false);
        audioWarning = 'System audio is not available for this source; previewing video only.';
      }
    } else {
      nextStream = await requestCapture(source, false);
    }

    if (request !== captureRequest) {
      stopTracks(nextStream);
      return;
    }

    captureStream = nextStream;
    selectedSource = source;
    const audioAvailable = nextStream.getAudioTracks().length > 0;
    if (requestedAudio && !audioAvailable) {
      audioToggle.checked = false;
    }
    preview.srcObject = nextStream;
    placeholder.hidden = true;
    void preview.play().catch(() => {});
    watchVideoTrack(nextStream);
    if (previousStream && previousStream !== nextStream) stopTracks(previousStream);

    state = 'ready';
    renderControls();
    if (audioWarning || (requestedAudio && !audioAvailable)) {
      setStatus(`${audioWarning || 'System audio is not available for this source.'} ${source.name} is ready to record.`, 'warning');
    } else {
      setStatus(`${source.name} is ready to record. The preview is live; recording has not started.`);
    }
  } catch (error) {
    if (request !== captureRequest) return;
    state = previousStream ? 'ready' : 'idle';
    if (!previousStream) {
      selectedSource = null;
    } else {
      audioToggle.checked = previousStream.getAudioTracks().length > 0;
    }
    renderControls();
    setStatus(formatCaptureError(error), 'error');
  }
}

function requestCapture(source, includeAudio) {
  const sourceConstraints = {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: source.id,
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 30,
    },
  };
  const audioConstraints = includeAudio
    ? { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id } }
    : false;

  return navigator.mediaDevices.getUserMedia({ video: sourceConstraints, audio: audioConstraints });
}

function watchVideoTrack(stream) {
  const [videoTrack] = stream.getVideoTracks();
  if (!videoTrack) return;

  videoTrack.addEventListener('ended', () => {
    if (captureStream !== stream) return;
    if (state === 'recording') {
      stopRecording('source-ended');
    } else if (state === 'ready') {
      releaseCapture();
      state = 'idle';
      renderControls();
      setStatus('The selected source stopped sharing. Choose a source to continue.', 'warning');
    }
  }, { once: true });
}

function formatCaptureError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Screen capture was denied. Allow it in your desktop privacy settings, then choose the source again.';
    case 'NotFoundError':
      return 'That capture source is no longer available. Choose a screen or window again.';
    case 'NotReadableError':
      return 'The selected source could not be read. Close another capture session and try again.';
    case 'OverconstrainedError':
      return 'This source does not support the requested capture settings. Choose a different source.';
    default:
      return `Could not preview that source: ${error?.message || 'unknown capture error'}`;
  }
}

async function handleAudioToggle() {
  if (state === 'ready' && selectedSource) {
    await selectSource(selectedSource);
  } else if (state === 'idle') {
    setStatus(audioToggle.checked
      ? 'System audio will be requested when you choose a source. Support depends on your operating system.'
      : 'Microphone audio is not recorded.');
  }
}

function startRecording() {
  if (state !== 'ready' || !captureStream) return;

  let recorderSetup;
  try {
    recorderSetup = createMediaRecorder(captureStream);
  } catch (error) {
    setStatus(error.message, 'error');
    return;
  }

  mediaRecorder = recorderSetup.recorder;
  recordedChunks = [];
  recorderError = null;
  recordingEndReason = 'manual';
  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  });
  mediaRecorder.addEventListener('error', (event) => {
    recorderError = event.error || new Error('The recorder stopped unexpectedly.');
  });
  mediaRecorder.addEventListener('stop', () => {
    void finishRecording(recorderSetup.mimeType);
  }, { once: true });

  try {
    mediaRecorder.start(1000);
  } catch (error) {
    mediaRecorder = null;
    setStatus(`Could not start recording: ${error.message}`, 'error');
    return;
  }

  startedAt = Date.now();
  timer.hidden = false;
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
  state = 'recording';
  renderControls();
  setStatus(`Recording ${selectedSource.name}. Press Stop and save when you are done.`);
}

function stopRecording(reason) {
  if (state !== 'recording' || !mediaRecorder) return;

  recordingEndReason = reason;
  state = 'finalizing';
  clearInterval(timerInterval);
  timerInterval = null;
  renderControls();
  setStatus(reason === 'source-ended'
    ? 'The source stopped. Finishing the recording…'
    : 'Finishing the recording…');

  try {
    mediaRecorder.stop();
  } catch (error) {
    mediaRecorder = null;
    recordedChunks = [];
    releaseCapture();
    state = 'idle';
    timer.hidden = true;
    renderControls();
    setStatus(`Could not finish recording: ${error.message}`, 'error');
  }
}

async function finishRecording(fallbackMimeType) {
  clearInterval(timerInterval);
  timerInterval = null;
  timer.hidden = true;
  mediaRecorder = null;

  const mimeType = recordedChunks.find((chunk) => chunk.type)?.type || fallbackMimeType || 'video/webm';
  const blob = new Blob(recordedChunks, { type: mimeType });
  recordedChunks = [];
  releaseCapture();

  if (blob.size === 0) {
    state = 'idle';
    renderControls();
    setStatus('No video data was captured, so nothing was saved. Choose the source again and retry.', 'error');
    return;
  }

  pendingBlob = blob;
  state = 'pending';
  renderControls();
  setStatus(recorderError
    ? 'The recorder stopped early. Choose where to save the clip, then check the result.'
    : recordingEndReason === 'source-ended'
      ? 'The source ended. Choose where to save the finished clip.'
      : 'Choose where to save your WebM recording.');
  await savePendingRecording();
}

async function savePendingRecording() {
  if (!pendingBlob || state === 'saving') return;

  state = 'saving';
  renderControls();
  setStatus('Waiting for the save dialog…');

  try {
    const bytes = await pendingBlob.arrayBuffer();
    const result = await window.electronAPI.saveRecording(bytes);
    pendingBlob = null;
    state = 'idle';
    renderControls();

    if (result.saved) {
      setStatus(`Saved recording: ${result.path}`, 'success');
    } else {
      setStatus('Save canceled. The recording was discarded and the capture stream was closed.');
    }
  } catch (error) {
    state = 'pending';
    renderControls();
    setStatus(`Could not save the recording: ${error.message}. Try saving again or discard the clip.`, 'error');
  }
}

function discardPendingRecording() {
  pendingBlob = null;
  state = 'idle';
  renderControls();
  setStatus('Recording discarded. The capture stream is closed.');
}

function stopPreview() {
  captureRequest += 1;
  releaseCapture();
  state = 'idle';
  renderControls();
  setStatus('Preview stopped and capture tracks released. Choose a source to record.');
}

function releaseCapture() {
  const stream = captureStream;
  captureStream = null;
  selectedSource = null;
  preview.pause();
  preview.srcObject = null;
  placeholder.hidden = false;
  stopTracks(stream);
}

function updateTimer() {
  timer.textContent = formatTime((Date.now() - startedAt) / 1000);
}

function setStatus(message, kind = 'info') {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function renderControls() {
  const canChooseSource = ['idle', 'ready'].includes(state);
  sourceBtn.disabled = !canChooseSource;
  startBtn.disabled = state !== 'ready' || !captureStream;
  stopBtn.disabled = state !== 'recording';
  clearSourceBtn.hidden = state !== 'ready';
  clearSourceBtn.disabled = state !== 'ready';
  audioToggle.disabled = !['idle', 'ready'].includes(state);
  saveAgainBtn.hidden = state !== 'pending';
  discardBtn.hidden = state !== 'pending';
  saveAgainBtn.disabled = state !== 'pending';
  discardBtn.disabled = state !== 'pending';
}
