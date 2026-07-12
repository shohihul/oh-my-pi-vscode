# Changelog

All notable changes to **Oh My Pi for VS Code** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[1.0.0]: https://github.com/shohihul/oh-my-pi-vscode/releases/tag/v1.0.0
