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
import { IdleDetector } from "../idleDetector";

export class TerminalViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "ohMyPi.terminal";

  #view: vscode.WebviewView | undefined;
  #pty = new PtySession();
  #cols = 80;
  #rows = 24;
  #spawned = false;
  #exited = false;
  #statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  #idleDetector = new IdleDetector({
    minBytes: 256,
    idleTimeoutMs: 5000,
    onActive: () => this.#onTaskActive(),
    onIdle: () => this.#onTaskIdle(),
  });
  #taskPending = false;
  #taskDone = false;
  #pendingTimer: NodeJS.Timeout | undefined;
  #doneTimer: NodeJS.Timeout | undefined;
  #lastInputAt = 0;
  #viewDisposables: vscode.Disposable[] = [];
  #globalDisposables: vscode.Disposable[] = [];
  #pendingSend: string | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.#statusBar.command = "ohMyPi.open";
    this.#updateStatusBar();

    this.#globalDisposables.push(
      this.#statusBar,
      this.#idleDetector,
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
    this.#updateStatusBar();

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
          if (this.#taskDone) {
            this.#clearDoneTimer();
            this.#taskDone = false;
            this.#updateStatusBar();
          }
        }
      }),
      webviewView.onDidDispose(() => {
        this.#clearViewDisposables();
        this.#pty.dispose();
        this.#view = undefined;
        this.#resetSessionState();
        this.#statusBar.hide();
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
  
  send(data: string): void {
    if (!data) {
      return;
    }
    if (!this.#view) {
      // Panel not yet open — queue and reveal. #ensurePty() flushes after spawn.
      this.#pendingSend = data;
      this.reveal();
      return;
    }
    if (this.#exited) {
      this.#restart();
    }
    this.#ensurePty();
    this.#writeInput(data);
  }

  dispose(): void {
    this.#clearViewDisposables();
    this.#clearPendingTimer();
    this.#clearDoneTimer();
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
    this.#lastInputAt = Date.now();

    if (data.includes("\r") && this.#spawned && !this.#exited) {
      this.#onEnterPressed();
    }

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
          if (Date.now() - this.#lastInputAt > 500) {
            this.#idleDetector.onData(data);
          }
        },
        onExit: (code) => {
          this.#exited = true;
          this.#spawned = false;
          this.#idleDetector.reset();
          this.#clearPendingTimer();
          this.#clearDoneTimer();
          this.#taskPending = false;
          this.#taskDone = false;
          this.#view?.webview.postMessage({ type: "exit", code });
          this.#updateStatusBar();
        },
      });
      this.#updateStatusBar();
    } catch (err) {
      this.#spawned = false;
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Oh My Pi: failed to start omp — ${message}`);
      this.#view?.webview.postMessage({
        type: "data",
        data: `\r\n\x1b[31mFailed to start omp: ${message}\x1b[0m\r\n`,
      });
      this.#updateStatusBar();
    }

    const pending = this.#pendingSend;
    this.#pendingSend = undefined;
    if (pending !== undefined && this.#spawned && !this.#exited) {
      this.#writeInput(pending);
    }
  }

  #restart(): void {
    this.#pty.dispose();
    this.#spawned = false;
    this.#exited = false;
    this.#idleDetector.reset();
    this.#clearPendingTimer();
    this.#clearDoneTimer();
    this.#taskPending = false;
    this.#taskDone = false;
    this.#updateStatusBar();
    this.#view?.webview.postMessage({ type: "clear" });
    this.#ensurePty();
  }

  #resetSessionState(): void {
    this.#spawned = false;
    this.#exited = false;
    this.#taskPending = false;
    this.#taskDone = false;
    this.#clearPendingTimer();
    this.#clearDoneTimer();
    this.#idleDetector.reset();
  }

  #updateStatusBar(): void {
    if (this.#exited) {
      this.#statusBar.text = "$(circle-slash) omp: Exited";
      this.#statusBar.tooltip = "Oh My Pi — omp has exited. Click to open and press any key to restart.";
      this.#statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
      this.#statusBar.color = undefined;
    } else if (!this.#spawned) {
      this.#statusBar.text = "$(loading~spin) omp: Starting";
      this.#statusBar.tooltip = "Oh My Pi — starting omp…";
      this.#statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.#statusBar.color = undefined;
    } else if (this.#idleDetector.isRunning || this.#taskPending) {
      this.#statusBar.text = "$(sync~spin) omp: Running";
      this.#statusBar.tooltip = "Oh My Pi — omp is processing. Click to open.";
      this.#statusBar.backgroundColor = undefined;
      this.#statusBar.color = new vscode.ThemeColor("terminal.ansiBrightBlue");
    } else if (this.#taskDone) {
      this.#statusBar.text = "$(check) omp: Done";
      this.#statusBar.tooltip = "Oh My Pi — task completed. Click to open.";
      this.#statusBar.backgroundColor = undefined;
      this.#statusBar.color = new vscode.ThemeColor("terminal.ansiBrightGreen");
    } else {
      this.#statusBar.text = "$(terminal) omp: Ready";
      this.#statusBar.tooltip = "Oh My Pi — omp is ready. Click to open.";
      this.#statusBar.backgroundColor = undefined;
      this.#statusBar.color = undefined;
    }
    this.#statusBar.show();
  }

  #onTaskIdle(): void {
    this.#taskPending = false;
    this.#clearPendingTimer();
    this.#taskDone = true;
    this.#updateStatusBar();

    if (this.#view?.visible) {
      this.#doneTimer = setTimeout(() => {
        this.#doneTimer = undefined;
        this.#taskDone = false;
        this.#updateStatusBar();
      }, 5000);
    } else if (
      vscode.workspace
        .getConfiguration("ohMyPi")
        .get<boolean>("notifyOnIdle", true)
    ) {
      void vscode.window
        .showInformationMessage("Oh My Pi: Task completed.", "Open")
        .then((action) => {
          if (action === "Open") {
            this.reveal();
          }
        });
    }
  }

  #onEnterPressed(): void {
    this.#clearDoneTimer();
    this.#taskDone = false;
    this.#taskPending = true;
    this.#updateStatusBar();

    this.#pendingTimer = setTimeout(() => {
      this.#pendingTimer = undefined;
      if (!this.#idleDetector.isRunning) {
        this.#taskPending = false;
        this.#updateStatusBar();
      }
    }, 5000);
  }

  #onTaskActive(): void {
    this.#clearPendingTimer();
    this.#taskPending = false;
    this.#clearDoneTimer();
    this.#taskDone = false;
    this.#updateStatusBar();
  }

  #clearPendingTimer(): void {
    if (this.#pendingTimer !== undefined) {
      clearTimeout(this.#pendingTimer);
      this.#pendingTimer = undefined;
    }
  }

  #clearDoneTimer(): void {
    if (this.#doneTimer !== undefined) {
      clearTimeout(this.#doneTimer);
      this.#doneTimer = undefined;
    }
  }

  #clearViewDisposables(): void {
    for (const d of this.#viewDisposables) {
      d.dispose();
    }
    this.#viewDisposables = [];
  }
}
