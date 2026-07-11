import * as vscode from "vscode";

import { shouldAutoStart } from "./config";
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
    provider,
  );

  if (shouldAutoStart()) {
    provider.reveal();
  }
}

export function deactivate(): void {}
