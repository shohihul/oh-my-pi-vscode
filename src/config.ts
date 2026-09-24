import * as fs from "node:fs";
import * as os from "node:os";
import * as vscode from "vscode";

import { resolveTerminalFont, type TerminalFont } from "./appearance";

export function getExecutable(): string {
  const config = vscode.workspace.getConfiguration("ohMyPi");
  const value = config.get<string>("executablePath")?.trim();
  return value || "omp";
}

export function getProfile(): string {
  const config = vscode.workspace.getConfiguration("ohMyPi");
  return config.get<string>("profile")?.trim() || "";
}

function getWorkingDirectory(): string {
  const config = vscode.workspace.getConfiguration("ohMyPi");
  const configured = config.get<string>("workingDirectory")?.trim();
  if (configured) {
    return configured;
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
}

export function resolveWorkingDirectory(): string {
  const cwd = getWorkingDirectory();

  try {
    if (fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) {
      return cwd;
    }
  } catch {
    // fall through to home
  }

  return os.homedir();
}

export function getTerminalFont(): TerminalFont {
  const ohMyPi = vscode.workspace.getConfiguration("ohMyPi");
  const terminal = vscode.workspace.getConfiguration("terminal.integrated");
  const editor = vscode.workspace.getConfiguration("editor");

  return resolveTerminalFont({
    fontFamily: ohMyPi.get<string>("fontFamily"),
    fontSize: ohMyPi.get<number>("fontSize"),
    terminalFontFamily: terminal.get<string>("fontFamily"),
    terminalFontSize: terminal.get<number>("fontSize"),
    // VS Code's integrated terminal falls back to the editor font before the
    // platform monospace stack; match that so the panel looks like the
    // built-in terminal instead of whatever the OS calls "monospace".
    editorFontFamily: editor.get<string>("fontFamily"),
  });
}
