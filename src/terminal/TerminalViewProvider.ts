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
