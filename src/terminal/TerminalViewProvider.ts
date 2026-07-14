import * as fs from "node:fs";
import * as os from "node:os";
import * as nodePath from "node:path";

import * as vscode from "vscode";

import {
  getExecutable,
  getTerminalFont,
  resolveWorkingDirectory,
} from "../config";
import { parseTerminalMessage } from "../messages";
import { PtySession } from "./ptySession";
import { buildTerminalHtml } from "./terminalHtml";

export class TerminalViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "ohMyPi.terminal";

  #view: vscode.WebviewView | undefined;
  #pty = new PtySession();
  #cols = 80;
  #rows = 24;
  #spawned = false;
  #exited = false;
  #viewDisposables: vscode.Disposable[] = [];
  #globalDisposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {
    this.#globalDisposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.#syncAppearance()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("ohMyPi.executablePath") ||
          e.affectsConfiguration("ohMyPi.workingDirectory")
        ) {
          this.restart();
        } else if (
          e.affectsConfiguration("terminal.integrated.fontFamily") ||
          e.affectsConfiguration("terminal.integrated.fontSize")
        ) {
          this.#syncAppearance();
        }
      }),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.#clearViewDisposables();
    this.#pty.dispose();
    this.#resetSessionState();
    this.#view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    this.#setWebviewHtml(webviewView.webview);

    this.#viewDisposables.push(
      webviewView.webview.onDidReceiveMessage((raw) => {
        const msg = parseTerminalMessage(raw);
        if (!msg) {
          return;
        }

        switch (msg.type) {
          case "ready":
            this.#cols = msg.cols ?? this.#cols;
            this.#rows = msg.rows ?? this.#rows;
            this.#ensurePty();
            break;
          case "resize":
            this.#cols = msg.cols ?? this.#cols;
            this.#rows = msg.rows ?? this.#rows;
            this.#pty.resize(this.#cols, this.#rows);
            break;
          case "input":
            if (this.#exited) {
              this.#restart();
            }
            this.#writeInput(msg.data ?? "");
            break;
          case "openUrl":
            if (msg.uri) {
              void vscode.env.openExternal(vscode.Uri.parse(msg.uri));
            }
            break;
          case "openFile":
            if (msg.path) {
              this.#openFile(msg.path, msg.line, msg.col);
            }
            break;
        }
      }),
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          webviewView.webview.postMessage({ type: "focus" });
        }
      }),
      webviewView.onDidDispose(() => {
        this.#clearViewDisposables();
        this.#pty.dispose();
        this.#view = undefined;
        this.#resetSessionState();
      }),
    );
  }

  reveal(): void {
    void vscode.commands.executeCommand(`${TerminalViewProvider.viewType}.focus`);
  }

  restart(): void {
    if (!this.#view) {
      return;
    }
    this.#restart();
  }

  search(): void {
    this.#view?.webview.postMessage({ type: "search" });
  }

  dispose(): void {
    this.#clearViewDisposables();
    for (const d of this.#globalDisposables) {
      d.dispose();
    }
    this.#globalDisposables = [];
    this.#pty.dispose();
    this.#view = undefined;
  }

  #setWebviewHtml(webview: vscode.Webview): void {
    const result = buildTerminalHtml(this.extensionUri.fsPath, getTerminalFont());
    webview.html = result.html;

    if (!result.ok) {
      void vscode.window.showErrorMessage(`Oh My Pi: ${result.error}`);
    }
  }

  #syncAppearance(): void {
    if (!this.#view) {
      return;
    }

    this.#view.webview.postMessage({ type: "theme" });
    this.#view.webview.postMessage({
      type: "font",
      ...getTerminalFont(),
    });
  }

  #writeInput(data: string): void {
    this.#pty.write(data);

    // Help recover terminal state after Ctrl+C in nested TUIs.
    if (data === "\x03") {
      setTimeout(() => this.#pty.write("\r"), 20);
    }
  }
  #openFile(filePath: string, line?: number, col?: number): void {
    const resolved = this.#resolveFilePath(filePath);
    if (!resolved) {
      return;
    }

    void vscode.workspace.openTextDocument(vscode.Uri.file(resolved)).then(
      (doc) => {
        void vscode.window.showTextDocument(doc).then((editor) => {
          if (line === undefined || line < 1) {
            return;
          }
          const targetLine = Math.min(line - 1, doc.lineCount - 1);
          const targetCol = col !== undefined && col >= 1 ? col - 1 : 0;
          const pos = new vscode.Position(targetLine, targetCol);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter,
          );
        });
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Oh My Pi: cannot open ${filePath} — ${message}`);
      },
    );
  }

  #resolveFilePath(filePath: string): string | undefined {
    const expanded = filePath.startsWith("~")
      ? nodePath.join(os.homedir(), filePath.slice(1))
      : filePath;

    if (nodePath.isAbsolute(expanded) && this.#isFile(expanded)) {
      return expanded;
    }

    const base = resolveWorkingDirectory();
    const candidate = nodePath.resolve(base, expanded);
    if (this.#isFile(candidate)) {
      return candidate;
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const alt = nodePath.resolve(folder.uri.fsPath, expanded);
      if (this.#isFile(alt)) {
        return alt;
      }
    }

    return undefined;
  }

  #isFile(fsPath: string): boolean {
    try {
      return fs.existsSync(fsPath) && fs.statSync(fsPath).isFile();
    } catch {
      return false;
    }
  }

  #ensurePty(): void {
    if (this.#spawned && !this.#exited) {
      this.#pty.resize(this.#cols, this.#rows);
      return;
    }

    this.#spawned = true;
    this.#exited = false;

    try {
      this.#pty.spawn({
        executable: getExecutable(),
        cwd: resolveWorkingDirectory(),
        cols: this.#cols,
        rows: this.#rows,
        onData: (data) => {
          this.#view?.webview.postMessage({ type: "data", data });
        },
        onExit: (code) => {
          this.#exited = true;
          this.#spawned = false;
          this.#view?.webview.postMessage({ type: "exit", code });
        },
      });
    } catch (err) {
      this.#spawned = false;
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Oh My Pi: failed to start omp — ${message}`);
      this.#view?.webview.postMessage({
        type: "data",
        data: `\r\n\x1b[31mFailed to start omp: ${message}\x1b[0m\r\n`,
      });
    }
  }

  #restart(): void {
    this.#pty.dispose();
    this.#spawned = false;
    this.#exited = false;
    this.#view?.webview.postMessage({ type: "clear" });
    this.#ensurePty();
  }

  #resetSessionState(): void {
    this.#spawned = false;
    this.#exited = false;
  }

  #clearViewDisposables(): void {
    for (const d of this.#viewDisposables) {
      d.dispose();
    }
    this.#viewDisposables = [];
  }
}
