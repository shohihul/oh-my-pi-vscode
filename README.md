# Oh My Pi for VS Code

Embedded terminal panel for [Oh My Pi](https://github.com/can1357/oh-my-pi). Runs `omp` in a dedicated sidebar terminal powered by xterm.js and a real pseudo-terminal (PTY).

This extension does **not** use VS Code's built-in terminal panel. It renders its own terminal inside a webview.

## Requirements

- VS Code 1.85+ (desktop — macOS, Linux, or Windows)
- `omp` installed and available, or configured via settings
- Not supported in VS Code for the Web

## Usage

1. Click the **Oh My Pi** icon in the activity bar
2. Or run **Oh My Pi for VS Code: Open Terminal** from the Command Palette
3. Default shortcut: **Cmd+Shift+Alt+I** (macOS) / **Ctrl+Shift+Alt+I** (Windows/Linux)
4. Use **Oh My Pi for VS Code: Restart Terminal** (toolbar button or Command Palette) to restart `omp`

`omp` starts when the panel opens. If it exits, press any key to restart.

**Paste:** Cmd/Ctrl+V or middle-click.

**Send code from the editor** (editor right-click menu or Command Palette):

- **Send Line(s) to omp** — sends a line reference like `path/to/file.ts:20` (single line) or `path/to/file.ts:20-25` (selection range), relative to the workspace, and presses Enter.
- **Send Selection to omp** — sends the exact selected text, or the active line if nothing is selected.
- **Send File Path to omp** — sends the file path relative to the workspace and presses Enter.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `ohMyPi.executablePath` | `omp` | Command to run. Use a full path if `omp` is not on VS Code's PATH. |
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

`omp` runs via a login shell (`$SHELL -l -c`) so your shell profile PATH is loaded on macOS/Linux.

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
Activity Bar → Webview (xterm.js + WebGL) ↔ Extension Host ↔ node-pty → omp
```

## License

MIT
