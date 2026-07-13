import * as fs from "node:fs";
import * as path from "node:path";

import type { TerminalFont } from "../appearance";
import { themeReaderScript } from "../theme/xtermTheme";

type XtermAssets = {
  xtermJs: string;
  xtermCss: string;
  fitJs: string;
  webglJs: string;
  searchJs: string;
  webLinksJs: string;
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
      searchJs: read("@xterm", "addon-search", "lib", "addon-search.js"),
      webLinksJs: read("@xterm", "addon-web-links", "lib", "addon-web-links.js"),
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
  font: TerminalFont,
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
    html: buildTerminalHtmlInner(assets, nonce, font),
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
    #search-bar {
      position: absolute;
      top: 8px;
      right: 14px;
      z-index: 10;
      display: flex;
      gap: 3px;
      align-items: center;
      padding: 4px 6px;
      border-radius: 4px;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #454545);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    #search-bar.hidden { display: none; }
    #search-bar input {
      width: 200px;
      padding: 3px 6px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      font-size: 12px;
      outline: none;
    }
    #search-bar input:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }
    #search-bar button {
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #search-bar button:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1));
    }
    #search-bar button.active {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
    }
    #search-bar button.active:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }
    #search-results {
      min-width: 56px;
      text-align: center;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
  </style>
</head>
<body>
  <div id="terminal-container"></div>
  <div id="search-bar" class="hidden">
    <input id="search-input" type="text" placeholder="Find" spellcheck="false" autocomplete="off" />
    <span id="search-results" aria-live="polite"></span>
    <button id="search-case" type="button" title="Match Case (Alt+C)" aria-label="Match Case">Aa</button>
    <button id="search-word" type="button" title="Match Whole Word (Alt+W)" aria-label="Match Whole Word">&#9109;</button>
    <button id="search-regex" type="button" title="Use Regular Expression (Alt+R)" aria-label="Use Regular Expression">.*</button>
    <button id="search-prev" type="button" title="Previous (Shift+Enter)" aria-label="Previous">&#9650;</button>
    <button id="search-next" type="button" title="Next (Enter)" aria-label="Next">&#9660;</button>
    <button id="search-close" type="button" title="Close (Escape)" aria-label="Close">&#10005;</button>
  </div>
  <script nonce="${nonce}">${assets.xtermJs}</script>
  <script nonce="${nonce}">${assets.fitJs}</script>
  <script nonce="${nonce}">${assets.searchJs}</script>
  <script nonce="${nonce}">${assets.webglJs}</script>
  <script nonce="${nonce}">${assets.webLinksJs}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const container = document.getElementById('terminal-container');

    const term = new Terminal({
      allowProposedApi: true,
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
    const searchAddon = new SearchAddon.SearchAddon();
    term.loadAddon(searchAddon);

    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const btnCase = document.getElementById('search-case');
    const btnWord = document.getElementById('search-word');
    const btnRegex = document.getElementById('search-regex');
    const btnPrev = document.getElementById('search-prev');
    const btnNext = document.getElementById('search-next');
    const btnClose = document.getElementById('search-close');

    let caseSensitive = false;
    let wholeWord = false;
    let useRegex = false;
    function resolveColor(cssVar, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
        return v || fallback;
      } catch {
        return fallback;
      }
    }

    function searchOptions() {
      return {
        caseSensitive,
        wholeWord,
        regex: useRegex,
        decorations: {
          matchBackground: resolveColor('--vscode-editor-findMatchHighlightBackground', 'rgba(234, 92, 0, 0.44)'),
          activeMatchBackground: resolveColor('--vscode-editor-findMatchBackground', 'rgba(234, 92, 0, 0.7)'),
          matchOverviewRuler: resolveColor('--vscode-editorOverviewRuler-findMatchForeground', '#d13636'),
          activeMatchColorOverviewRuler: resolveColor('--vscode-editorOverviewRuler-selectionHighlightForeground', '#d13636'),
        },
      };
    }

    function find(direction) {
      const query = searchInput.value;
      if (!query) {
        searchResults.textContent = '';
        searchAddon.clearDecorations();
        return;
      }
      try {
        if (direction === 'prev') {
          searchAddon.findPrevious(query, searchOptions());
        } else {
          searchAddon.findNext(query, searchOptions());
        }
      } catch {
        // Invalid regex or search error — clear decorations silently.
        searchAddon.clearDecorations();
      }
    }

    searchAddon.onDidChangeResults((results) => {
      if (results && results.resultCount > 0) {
        searchResults.textContent = (results.resultIndex + 1) + '/' + results.resultCount;
      } else {
        searchResults.textContent = '';
      }
    });

    function openSearch() {
      searchBar.classList.remove('hidden');
      searchInput.focus();
      searchInput.select();
    }

    function closeSearch() {
      searchBar.classList.add('hidden');
      searchInput.value = '';
      searchResults.textContent = '';
      searchAddon.clearDecorations();
      term.focus();
    }

    function toggleButton(btn, getValue, setValue) {
      const next = !getValue();
      setValue(next);
      if (next) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      find('next');
    }

    btnCase.addEventListener('click', () => toggleButton(btnCase, () => caseSensitive, (v) => { caseSensitive = v; }));
    btnWord.addEventListener('click', () => toggleButton(btnWord, () => wholeWord, (v) => { wholeWord = v; }));
    btnRegex.addEventListener('click', () => toggleButton(btnRegex, () => useRegex, (v) => { useRegex = v; }));
    btnPrev.addEventListener('click', () => find('prev'));
    btnNext.addEventListener('click', () => find('next'));
    btnClose.addEventListener('click', closeSearch);

    searchInput.addEventListener('input', () => find('next'));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        find(e.shiftKey ? 'prev' : 'next');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      }
      e.stopPropagation();
    });

    // Ctrl/Cmd+F opens search directly in the webview. The VS Code keybinding
    // (when: view == ohMyPi.terminal) does not fire while focus is inside the
    // webview's xterm textarea, so intercept the keystroke here on capture
    // phase, before xterm can forward it to the pty.
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key !== 'f' && e.key !== 'F') return;
      e.preventDefault();
      e.stopPropagation();
      if (searchBar.classList.contains('hidden')) {
        openSearch();
      } else {
        searchInput.focus();
        searchInput.select();
      }
    }, true);
    // Clickable URLs — handled by WebLinksAddon, forwarded to extension host
    // which opens them via vscode.env.openExternal.
    const webLinksAddon = new WebLinksAddon.WebLinksAddon((_event, uri) => {
      vscode.postMessage({ type: 'openUrl', uri });
    });
    term.loadAddon(webLinksAddon);

    // Clickable file paths — custom link provider that matches absolute/relative
    // paths with optional :line:col suffix and forwards them to the extension host
    // which opens them in the editor.
    const FILE_PATH_RE = /(?<![:\\/\\w.])((?:[A-Za-z]:[\\\\/]|[\\/~]|\\.\\.?\\/|[\\w@-]+\\/)[^\\s\`'"<>()]+?\\.([a-zA-Z0-9]{1,16}))(?::(\\d+))?(?::(\\d+))?(?![a-zA-Z0-9.])/g;
    term.registerLinkProvider({
      provideLinks(lineNumber, callback) {
        const line = term.buffer.active.getLine(lineNumber - 1);
        if (!line) { callback(undefined); return; }
        const text = line.translateToString(true);
        const links = [];
        FILE_PATH_RE.lastIndex = 0;
        let m;
        while ((m = FILE_PATH_RE.exec(text)) !== null) {
          const filePath = m[1];
          const startCol = m.index;
          const endCol = startCol + m[0].length;
          const lineNum = m[3] ? parseInt(m[3], 10) : undefined;
          const colNum = m[4] ? parseInt(m[4], 10) : undefined;
          links.push({
            text: m[0],
            range: {
              start: { x: startCol + 1, y: lineNumber },
              end: { x: endCol, y: lineNumber },
            },
            decorations: { pointerCursor: true, underline: true },
            activate() {
              vscode.postMessage({ type: 'openFile', path: filePath, line: lineNum, col: colNum });
            },
          });
        }
        callback(links.length ? links : undefined);
      },
    });

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

    // Paste via keyboard (Cmd/Ctrl+V) and right-click context menu is handled
    // natively by xterm.js — its paste handler reads clipboardData and calls
    // stopPropagation, so a document-level handler is redundant and causes
    // double-paste. Middle-click paste is handled in the mousedown listener below.

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
      } else if (msg.type === 'search') {
        openSearch();
      }
    });

    window.addEventListener('focus', () => term.focus());

    const ro = new ResizeObserver(() => fitAndNotify());
    ro.observe(container);
  </script>
</body>
</html>`;
}
