// DOM Elements
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const timer = document.getElementById('timer');
const sourceBtn = document.getElementById('sourceBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const audioToggle = document.getElementById('audioToggle');
const sourceModal = document.getElementById('sourceModal');
const sourcesList = document.getElementById('sourcesList');
const closeModal = document.getElementById('closeModal');

// Variables
let mediaRecorder;
let recordedChunks = [];
let startTime = 0;
let timerInterval;
let selectedSource = null;
let stream = null;

// Event listeners
sourceBtn.addEventListener('click', openSourceSelection);
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
closeModal.addEventListener('click', () => sourceModal.style.display = 'none');

// Close modal if clicking outside of it
window.addEventListener('click', (e) => {
  if (e.target === sourceModal) {
    sourceModal.style.display = 'none';
  }
});

// Open source selection modal
async function openSourceSelection() {
  sourcesList.innerHTML = '';
  sourceModal.style.display = 'block';
  
  try {
    const sources = await window.electronAPI.getSources();
    
    sources.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'source-item';
      sourceItem.title = source.name;
      
      const thumbnail = document.createElement('img');
      thumbnail.src = source.thumbnail.toDataURL();
      
      const name = document.createElement('div');
      name.className = 'source-name';
      name.textContent = source.name;
      
      sourceItem.appendChild(thumbnail);
      sourceItem.appendChild(name);
      
      sourceItem.addEventListener('click', () => {
        selectSource(source);
        sourceModal.style.display = 'none';
      });
      
      sourcesList.appendChild(sourceItem);
    });
  } catch (error) {
    console.error('Failed to get sources:', error);
    sourceModal.style.display = 'none';
    alert('Failed to get sources. Please try again.');
  }
}

// Select a source for recording
async function selectSource(source) {
  selectedSource = source;
  
  // Stop any existing stream
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  try {
    const constraints = {
      audio: audioToggle.checked,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    };
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Show video preview
    preview.srcObject = stream;
    placeholder.style.display = 'none';
    
    // Enable start button
    startBtn.disabled = false;
  } catch (error) {
    console.error('Error selecting source:', error);
    alert(`Failed to access source: ${error.message}`);
  }
}

// Start recording
function startRecording() {
  recordedChunks = [];
  
  // Update UI
  startBtn.disabled = true;
  stopBtn.disabled = false;
  sourceBtn.disabled = true;
  audioToggle.disabled = true;
  timer.style.display = 'block';
  
  // Set up MediaRecorder
  const options = { mimeType: 'video/webm; codecs=vp9' };
  mediaRecorder = new MediaRecorder(stream, options);
  
  // Record data
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  
  // Start timer
  startTime = Date.now();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
  
  // Start recording
  mediaRecorder.start(100);
}

// Stop recording
function stopRecording() {
  mediaRecorder.stop();
  
  // Clean up timer
  clearInterval(timerInterval);
  
  // Update UI
  startBtn.disabled = false;
  stopBtn.disabled = true;
  sourceBtn.disabled = false;
  audioToggle.disabled = false;
  
  // Wait for all chunks and then save
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, {
      type: 'video/webm'
    });
    
    try {
      // Convert blob to buffer and save file
      const buffer = await blob.arrayBuffer();
      const result = await window.electronAPI.saveRecording(buffer);
      
      if (result.saved) {
        console.log('Video saved successfully at:', result.path);
      } else {
        console.log('User cancelled save dialog');
      }
    } catch (error) {
      console.error('Failed to save recording:', error);
      alert('Failed to save recording. Please try again.');
    }
  };
}

// Update recording timer display
function updateTimer() {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  timer.textContent = window.utils.formatTime(seconds);
}

// Toggle audio recording option
audioToggle.addEventListener('change', () => {
  if (selectedSource) {
    // If we have a source, reselect it to update audio constraints
    selectSource(selectedSource);
  }
});
