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
    provider,
  );

  if (vscode.workspace.getConfiguration("ohMyPi").get<boolean>("autoStart", false)) {
    provider.reveal();
  }
}

export function deactivate(): void {}
