import * as fs from "node:fs";
import * as path from "node:path";

import type { TerminalAppearance } from "../appearance";
import { themeReaderScript } from "../theme/xtermTheme";

type XtermAssets = {
  xtermJs: string;
  xtermCss: string;
  fitJs: string;
  webglJs: string;
};

let cachedAssets: XtermAssets | undefined;

function loadAssets(extensionPath: string): XtermAssets {
  if (!cachedAssets) {
    const read = (...parts: string[]) =>
      fs.readFileSync(path.join(extensionPath, "node_modules", ...parts), "utf8");

    cachedAssets = {
      xtermJs: read("@xterm", "xterm", "lib", "xterm.js"),
      xtermCss: read("@xterm", "xterm", "css", "xterm.css"),
      fitJs: read("@xterm", "addon-fit", "lib", "addon-fit.js"),
      webglJs: read("@xterm", "addon-webgl", "lib", "addon-webgl.js"),
    };
  }
  return cachedAssets;
}

/** Clears cached xterm assets (for tests). */
export function clearAssetCache(): void {
  cachedAssets = undefined;
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export type TerminalHtmlResult =
  | { ok: true; html: string }
  | { ok: false; error: string; html: string };

export function buildTerminalHtml(
  extensionPath: string,
  appearance: TerminalAppearance,
): TerminalHtmlResult {
  let assets: XtermAssets;
  try {
    assets = loadAssets(extensionPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Failed to load terminal assets: ${message}`,
      html: buildErrorHtml(`Failed to load terminal assets.\n\n${message}`),
    };
  }

  const nonce = generateNonce();

  return {
    ok: true,
    html: buildTerminalHtmlInner(assets, nonce, appearance.font),
  };
}

function buildErrorHtml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px;
      color: var(--vscode-errorForeground, #f48771);
      background: var(--vscode-editor-background, #1e1e1e);
      white-space: pre-wrap;
    }
  </style>
</head>
<body>${escaped}</body>
</html>`;
}

function buildTerminalHtmlInner(
  assets: XtermAssets,
  nonce: string,
  font: { family: string; size: number },
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>${assets.xtermCss}</style>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-terminal-background, var(--vscode-editor-background, #1e1e1e));
    }
    #terminal-container {
      position: absolute;
      inset: 0;
      padding: 4px;
    }
  </style>
</head>
<body>
  <div id="terminal-container"></div>
  <script nonce="${nonce}">${assets.xtermJs}</script>
  <script nonce="${nonce}">${assets.fitJs}</script>
  <script nonce="${nonce}">${assets.webglJs}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const container = document.getElementById('terminal-container');

    const term = new Terminal({
      cursorBlink: true,
      fontSize: ${font.size},
      fontFamily: ${JSON.stringify(font.family)},
      scrollback: 10000,
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    ${themeReaderScript()}

    try {
      const webglAddon = new WebglAddon.WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch (_) {}

    applyTheme();

    let ready = false;
    let exited = false;

    function fitAndNotify() {
      try {
        fitAddon.fit();
        if (ready) {
          vscode.postMessage({ type: 'resize', cols: term.cols, rows: term.rows });
        }
      } catch (_) {}
    }

    function notifyReady() {
      if (ready) return;
      ready = true;
      fitAndNotify();
      vscode.postMessage({ type: 'ready', cols: term.cols, rows: term.rows });
      term.focus();
    }

    function pasteText(text) {
      if (!text) return;
      if (exited) {
        exited = false;
        term.clear();
      }
      vscode.postMessage({ type: 'input', data: text });
    }

    requestAnimationFrame(() => requestAnimationFrame(notifyReady));

    term.onData(data => {
      if (exited) {
        exited = false;
        term.clear();
      }
      vscode.postMessage({ type: 'input', data });
    });

    document.addEventListener('paste', (e) => {
      e.preventDefault();
      pasteText(e.clipboardData?.getData('text') ?? '');
    });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault();
        navigator.clipboard.readText().then(pasteText).catch(() => {});
      }
    });

    container.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    container.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        navigator.clipboard.readText().then(pasteText).catch(() => {});
        return;
      }
      term.focus();
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'data') {
        term.write(msg.data);
      } else if (msg.type === 'exit') {
        exited = true;
        term.write('\\r\\n\\x1b[90m[omp exited — press any key to restart]\\x1b[0m\\r\\n');
      } else if (msg.type === 'focus') {
        term.focus();
      } else if (msg.type === 'clear') {
        term.clear();
        exited = false;
      } else if (msg.type === 'theme') {
        applyTheme();
      } else if (msg.type === 'font') {
        term.options.fontSize = msg.size;
        term.options.fontFamily = msg.family;
        fitAndNotify();
      }
    });

    window.addEventListener('focus', () => term.focus());

    const ro = new ResizeObserver(() => fitAndNotify());
    ro.observe(container);
  </script>
</body>
</html>`;
}
