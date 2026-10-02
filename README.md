# AwesomeElectronSR

An Electron screen-recorder prototype built while learning desktop application development.

## Implemented flow

- List available screens and windows through Electron's desktop capture API.
- Select a source and preview its stream.
- Record using the browser MediaRecorder API, with a recording timer.
- Save the captured data as a WebM file through a native save dialog.

The renderer exposes an audio toggle; capture support and audio behavior depend on the operating system and permissions. This is a learning prototype, with desktop capture and packaging still requiring testing on each target platform.

## Development

```sh
npm install
npm start
```

Electron Forge launches the application. To generate a local application bundle:

```sh
npm run package
```

`npm run make` uses the configured Windows, macOS or Linux makers and requires the corresponding platform tools. Packaged releases are not established by the configuration alone.

## Source

- `src/index.js`: desktop window, source enumeration and save dialog.
- `src/preload.js`: renderer-facing IPC bridge.
- `src/renderer.js`: capture, preview, recorder and timer.
- `src/index.html` and `src/index.css`: interface.
- `forge.config.js`: packaging configuration.

Created by Prajwal K as an Electron learning project.
