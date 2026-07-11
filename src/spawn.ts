import * as fs from "node:fs";

export function buildSpawnCommand(executable: string): { file: string; args: string[] } {
  if (process.platform === "win32") {
    return buildWindowsSpawnCommand(executable);
  }

  const shell = process.env.SHELL || "/bin/bash";
  return { file: shell, args: ["-l", "-c", executable] };
}

function buildWindowsSpawnCommand(executable: string): { file: string; args: string[] } {
  const absoluteCandidates = [
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ];

  for (const file of absoluteCandidates) {
    if (fs.existsSync(file)) {
      return { file, args: ["-NoLogo", "-Command", executable] };
    }
  }

  const comspec = process.env.COMSPEC;
  if (comspec?.toLowerCase().endsWith("cmd.exe")) {
    return { file: comspec, args: ["/d", "/c", executable] };
  }

  return { file: "powershell.exe", args: ["-NoLogo", "-Command", executable] };
}

export function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ASAR;
  return env;
}
