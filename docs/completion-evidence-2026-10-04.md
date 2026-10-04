# ScreenRec verification evidence — 2026-10-04

## Verified

- `npm test`: 9 tests passed. Coverage includes MediaRecorder codec fallback, resilient track stopping, timer formatting, exact saved bytes, `.webm` extension handling, save-dialog cancellation, and temporary-file cleanup after a simulated rename failure.
- Renderer syntax checks (`node --check`) and `git diff --check` passed.
- Ran the actual Electron UI on Linux with a synthetic 640×360 canvas stream. Source selection, preview, optional system-audio failure falling back to video-only, recording start, elapsed timer, stop/finalization, and capture-track cleanup all worked.
- The actual native “Save WebM recording” dialog opened. Canceling that exact dialog returned the expected cancellation status, discarded the clip, and left the preview stream closed. The app never requested microphone access.
- The host uses Linux/PipeWire via a Hyprland desktop portal. Electron returned the host display even when the app window was launched on Xvfb. Preview was stopped immediately; no desktop-source recording was started or saved. Linux PipeWire source enumeration is limited by Electron/portal behavior.

## Packaging limitation on this machine

`npm run package` exits with code 0 here but does not produce the expected `out/` directory. Electron Forge's packager reaches “Finalizing package” without an application bundle. Isolating the extraction step with the installed Node v26.8.1 and `extract-zip` 2.0.1 shows the Electron 36.2.0 Linux archive stalls while streaming the first 2.1 MB entry: the process remains alive until an 8-second timeout, while the archive itself passes `unzip -t`. The repository source/package configuration is not the observed failure point. A distributable should be built on a supported Node runtime or after resolving that local extraction/streaming issue.

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
