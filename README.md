# ScreenRec

ScreenRec is a small Electron learning project for choosing a screen or window, previewing it, recording a WebM clip, and saving it through the native file dialog.

## Recording flow

1. **Choose source** lists the desktop capture sources and their local thumbnails.
2. Choosing a source opens a live preview. No file is being recorded yet.
3. **Start recording** begins a MediaRecorder session and timer. **Stop and save** finishes the recorder before opening the save dialog.
4. Choosing a path writes the WebM file. Canceling the dialog discards the clip and closes the capture stream. If writing fails, the clip stays in memory so it can be retried or discarded.
5. **Stop preview** releases the video and audio tracks. Replacing a source stops the previous stream, and closing the app also releases active tracks.

The recorder tries VP9 and VP8 WebM variants in order, then lets Chromium choose its default WebM format. The microphone is never requested. System audio is optional and best-effort; if it is unavailable, ScreenRec keeps the video preview and explains that the recording will be video-only.

## Platform notes

Capture availability and system-audio support come from Electron and the host desktop:

- On Linux with PipeWire, Electron currently returns one capture source when both screens and windows are requested. The desktop portal may choose that source.
- macOS screen capture follows the system's privacy permission. Packaged builds include `NSAudioCaptureUsageDescription` for desktop audio on macOS 14.2 and later. Development runs inherit the terminal or IDE's macOS permissions.
- Windows and Linux still depend on their capture backend and audio routing. A failed audio request falls back to video-only. ScreenRec never records microphone input.

This prototype has been exercised on Linux. Other platform behavior should be checked on the target OS before distributing a build.

## Development

```sh
npm ci
npm test
npm start
```

Create a local packaged application for the current platform with:

```sh
npm run package
```

The Linux x64 package was built successfully with Node.js 22.23.3. Electron Forge
produced `out/ScreenRec-linux-x64` (about 280 MB). Node.js 26.8.1 stalled while
extracting the Electron archive on this host; use the verified Node 22 runtime
for packaging here.

`npm run make` uses the configured Linux, Windows, and macOS makers. Each installer format needs its platform-specific build environment and has not been verified as a release artifact.

## Project files

- `src/index.js` creates the desktop window, returns IPC-safe source data, and handles the native save dialog.
- `src/preload.js` exposes the two narrow renderer IPC calls.
- `src/renderer.js` manages source selection, preview, audio fallback, recorder state, save/cancel feedback, and stream cleanup.
- `src/recording-utils.js` handles MediaRecorder format fallback, track cleanup, and elapsed-time formatting.
- `src/recording-save.js` writes accepted recordings through a temporary file before committing the `.webm` destination.
- `src/index.html` and `src/index.css` contain the interface.
- `test/` covers codec fallback, track cleanup, timer formatting, and save/cancel/error paths.
- `forge.config.js` defines packaging and the macOS system-audio usage string.

Created by Prajwal K as an Electron learning project.
