import * as vscode from "vscode";

import { TerminalViewProvider } from "./terminal/TerminalViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new TerminalViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TerminalViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("ohMyPi.open", () => {
      provider.reveal();
    }),
    vscode.commands.registerCommand("ohMyPi.restart", () => {
      provider.restart();
    }),
    vscode.commands.registerCommand("ohMyPi.search", () => {
      provider.search();
    }),
    vscode.commands.registerCommand("ohMyPi.sendSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const sel = editor.selection;
      const text = sel.isEmpty
        ? editor.document.lineAt(sel.active.line).text
        : editor.document.getText(sel);
      if (text.length === 0) {
        return;
      }
      provider.send(text);
    }),
    vscode.commands.registerCommand("ohMyPi.sendLines", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const { document, selection } = editor;
      const relPath = vscode.workspace.asRelativePath(document.uri);

      // Whole-line range (0-indexed internally; editor display is 1-indexed).
      let start = selection.start.line;
      let end = selection.end.line;
      // A selection ending at column 0 does not include that last line.
      if (selection.end.character === 0 && end > start) {
        end -= 1;
      }
      // Clamp to the valid document range.
      const lastLine = document.lineCount - 1;
      start = Math.max(0, Math.min(start, lastLine));
      end = Math.max(0, Math.min(end, lastLine));

      const startNo = start + 1;
      const endNo = end + 1;
      const ref = startNo === endNo ? `${relPath}:${startNo}` : `${relPath}:${startNo}-${endNo}`;
      provider.send(ref + "\n");
    }),
    vscode.commands.registerCommand("ohMyPi.sendFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      provider.send(vscode.workspace.asRelativePath(editor.document.uri) + "\n");
    }),
    provider,
  );

  if (vscode.workspace.getConfiguration("ohMyPi").get<boolean>("autoStart", false)) {
    provider.reveal();
  }
}

export function deactivate(): void {}
