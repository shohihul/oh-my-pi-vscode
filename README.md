# Oh My Pi for VS Code

Embedded terminal panel for [Oh My Pi](https://github.com/can1357/oh-my-pi). Runs `omp` in a dedicated sidebar terminal powered by xterm.js and a real pseudo-terminal (PTY).

This extension does **not** use VS Code's built-in terminal panel. It renders its own terminal inside a webview.

## Requirements

- VS Code 1.85+ (desktop — macOS, Linux, or Windows)
- `omp` installed and available, or configured via settings
- Not supported in VS Code for the Web

## Usage

### Opening the terminal

Any of these opens the panel:

- Click the **Oh My Pi** icon in the activity bar
- Run **Oh My Pi for VS Code: Open Terminal** from the Command Palette
- Press **Cmd+Shift+Alt+I** (macOS) / **Ctrl+Shift+Alt+I** (Windows/Linux)

`omp` launches as soon as the panel opens. To restart it manually, click the toolbar button or run **Restart Terminal** from the Command Palette. If `omp` exits on its own, just press any key to relaunch it.

### Inside the terminal

| Action | Shortcut |
|--------|----------|
| Paste | Cmd/Ctrl+V or middle-click |
| Find | Cmd/Ctrl+F (or the search toolbar button) |
| New line in the `omp` composer | Shift+Enter |

The find bar supports case-sensitive, whole-word, and regex matching with a live result counter. Press **Enter** / **Shift+Enter** to jump to the next / previous match, and **Esc** to close.

**Clickable links** — URLs open in your external browser. File paths — with an optional `:line` or `:line:col` suffix — open directly in the editor.

### Sending code from the editor

Available from the editor's right-click menu or the Command Palette:

| Command | What it sends |
|---------|---------------|
| **Send Line(s) to omp** | A workspace-relative line reference like `path/to/file.ts:20` (single line) or `path/to/file.ts:20-25` (selection range), then Enter. |
| **Send Selection to omp** | The exact selected text — or the active line if nothing is selected. |
| **Send File Path to omp** | The workspace-relative file path, then Enter. |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `ohMyPi.executablePath` | `omp` | Command to run. Use a full path if `omp` is not on VS Code's PATH. Shell arguments are supported (e.g. `omp --flag`). |
| `ohMyPi.autoStart` | `false` | Open the panel automatically when VS Code starts. |
| `ohMyPi.workingDirectory` | workspace / home | Working directory passed to `omp`. Invalid paths fall back to home. |

Font size and family follow `terminal.integrated.fontSize` and `terminal.integrated.fontFamily`.

Terminal colors (background, foreground, cursor, selection, and all 16 ANSI colors) are read from your active VS Code theme via `--vscode-terminal-*` CSS variables — they update automatically when you switch themes.

Changing `executablePath` or `workingDirectory` restarts the terminal automatically.

## Troubleshooting

**`omp` not found**

Set the full path in settings:

```json
{
  "ohMyPi.executablePath": "/Users/you/.bun/bin/omp"
}
```

On macOS/Linux, `omp` runs via a login shell (`$SHELL -l -c`) so your shell profile PATH is loaded. On Windows it launches through PowerShell 7 (`pwsh`), falling back to Windows PowerShell, then `cmd.exe`.

**Blank panel**

Reinstall the extension or run `npm install && npm run build` when developing. xterm assets ship inside the VSIX under `node_modules/@xterm/`.

## Development

```bash
npm install
npm run build      # production build
npm run watch      # watch mode
npm run typecheck  # TypeScript check
npm test           # unit tests
npm run package    # create .vsix for the current platform
npm run package:all # create one .vsix per platform (macOS/Linux/Windows × x64/arm64)
```

Press **F5** in VS Code to launch an Extension Development Host.

## Architecture

```
Activity Bar → Webview (xterm.js + WebGL) ↔ Extension Host ↔ @lydell/node-pty → omp
```

## License

MIT
