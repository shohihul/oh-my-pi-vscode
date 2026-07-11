import * as fs from "node:fs";
import * as os from "node:os";
import * as vscode from "vscode";

import { DEFAULT_TERMINAL_FONT, type TerminalFont } from "./appearance";

export function getExecutable(): string {
  const config = vscode.workspace.getConfiguration("ohMyPi");
  const value = config.get<string>("executablePath")?.trim();
  return value || "omp";
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
  const config = vscode.workspace.getConfiguration("terminal.integrated");
  return {
    family: config.get<string>("fontFamily") || DEFAULT_TERMINAL_FONT.family,
    size: config.get<number>("fontSize") ?? DEFAULT_TERMINAL_FONT.size,
  };
}
