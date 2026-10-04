# ScreenRec verification evidence — 2026-10-04

## Verified

- `npm test`: 9 tests passed. Coverage includes MediaRecorder codec fallback, resilient track stopping, timer formatting, exact saved bytes, `.webm` extension handling, save-dialog cancellation, and temporary-file cleanup after a simulated rename failure.
- Renderer syntax checks (`node --check`) and `git diff --check` passed.
- Ran the actual Electron UI on Linux with a synthetic 640×360 canvas stream. Source selection, preview, optional system-audio failure falling back to video-only, recording start, elapsed timer, stop/finalization, and capture-track cleanup all worked.
- The actual native “Save WebM recording” dialog opened. Canceling that exact dialog returned the expected cancellation status, discarded the clip, and left the preview stream closed. The app never requested microphone access.
- The host uses Linux/PipeWire via a Hyprland desktop portal. Electron returned the host display even when the app window was launched on Xvfb. Preview was stopped immediately; no desktop-source recording was started or saved. Linux PipeWire source enumeration is limited by Electron/portal behavior.

## Packaging

`npm run package` completed on Node.js 22.23.3 and produced `out/ScreenRec-linux-x64` (about 280 MB). Node.js 26.8.1 still stalls in `extract-zip` 2.0.1 while streaming the first 2.1 MB entry of Electron 36.2.0's Linux archive; `unzip -t` passes. Use the verified Node 22 runtime to package on this host. The cross-platform installer makers have not been exercised.

## Commands

```sh
npm test
node --check src/index.js
node --check src/preload.js
node --check src/renderer.js
node --check src/recording-save.js
git diff --check
npm run package
```
