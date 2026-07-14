# Changelog

All notable changes to **Oh My Pi for VS Code** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Status bar indicator** — a five-state status bar shows live omp status at a glance: **Starting** (yellow), **Ready** (default), **Running** (blue), **Done** (green), and **Exited** (red). Running triggers instantly when you press Enter and confirms once output flows; Done appears when a task finishes and auto-reverts to Ready after 5 seconds (panel visible) or when you return to the panel (panel hidden). Click the status bar to reveal the terminal.
- **Task completion notification** — when omp finishes a long-running task while the panel is hidden, a notification toast appears with an **Open** button to jump back. The status bar also turns green (Done). Detection is based on PTY output volume (256+ bytes) followed by 5 seconds of silence, which filters out typing echoes. Enabled by default; disable via `ohMyPi.notifyOnIdle`.


## [1.1.0] - 2026-07-14

### Added

- **Find in Terminal** — search the terminal scrollback with a webview search bar: type-ahead matching, next/previous navigation (`Enter` / `Shift+Enter`), and a live match counter (`N/M`). Toggles for **Match Case**, **Match Whole Word**, and **Regular Expression**.
- Match highlighting and the active-result counter powered by `@xterm/addon-search`, with colors resolved live from the active VS Code theme (`--vscode-editor-findMatch*` variables).
- Open search via `Cmd/Ctrl+F` (intercepted inside the terminal so the keystroke never leaks to the shell), the **Find in Terminal** command, the search toolbar icon, or the command palette. Close with `Escape`.
- **Send Line(s) to omp** — sends a line reference to the embedded terminal and presses Enter: `path/to/file:42` for a single line, or `path/to/file:20-25` for a selection. Paths are relative to the workspace and line numbers match the editor.
- **Send Selection to omp** — sends the exact selected text (or the active line if nothing is selected) to the terminal, with no trailing newline.
- **Send File Path to omp** — sends the file path relative to the workspace and presses Enter.
- All three are reachable from the editor right-click menu and the Command Palette.
- Clickable links in terminal output — URLs are detected automatically by the `WebLinksAddon` and open in the system browser on click.
- Clickable file paths in terminal output — absolute paths (`/usr/src/app.ts`), home paths (`~/config.json`), relative paths (`./src/foo.ts`, `src/foo.ts`, `../lib/bar.js`), and Windows drive paths (`C:\Users\file.ts`) are detected and open in the editor on click, with optional `:line` or `:line:col` suffix support for cursor positioning.

### Fixed

- `Shift+Enter` now inserts a newline in the `omp` composer instead of submitting the message. xterm.js hardcodes the Enter key to a bare carriage return and ignores the Shift modifier, so both Enter and Shift+Enter arrived identically and were read as "submit". Shift+Enter is now intercepted in the webview (where the Shift modifier is still visible) and re-injected as the legacy `ESC [ 13 ; 2 ~` sequence that `omp` maps to "insert newline".

## [1.0.1] - 2026-07-11

### Fixed

- Double-paste when using `Cmd/Ctrl+V` — removed a redundant document-level keyboard paste handler that was duplicating xterm.js's built-in native paste handling.

## [1.0.0] - 2026-07-11

First stable release.

### Added

- Embedded terminal panel in a dedicated activity-bar sidebar running `omp` via a real pseudo-terminal (PTY).
- xterm.js rendering with optional WebGL acceleration.
- Terminal colors read live from the active VS Code theme via `--vscode-terminal-*` CSS variables; update automatically when the theme changes.
- Font family and size inherit from `terminal.integrated.fontFamily` / `terminal.integrated.fontSize`.
- Commands: **Open Terminal** (`Cmd/Ctrl+Shift+Alt+I`) and **Restart Terminal**.
- Settings: `ohMyPi.executablePath`, `ohMyPi.autoStart`, `ohMyPi.workingDirectory`.
- `omp` launched through a login shell on macOS/Linux and PowerShell on Windows so shell profile PATH is respected.
- Auto-restart on exit (press any key); automatic restart when `executablePath` or `workingDirectory` changes.
- Paste via `Cmd/Ctrl+V` or middle-click.
- Cross-platform prebuilt native binaries for macOS, Linux, and Windows (x64 + arm64).

[1.1.0]: https://github.com/shohihul/oh-my-pi-vscode/releases/tag/v1.1.0

[1.0.0]: https://github.com/shohihul/oh-my-pi-vscode/releases/tag/v1.0.0
