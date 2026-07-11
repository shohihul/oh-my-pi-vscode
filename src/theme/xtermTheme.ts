/** Maps xterm.js theme keys to VS Code CSS variables (first match wins). */
export const XTERM_THEME_CSS_MAP: Record<string, readonly string[]> = {
  background: ["--vscode-terminal-background", "--vscode-editor-background"],
  foreground: ["--vscode-terminal-foreground", "--vscode-editor-foreground"],
  cursor: [
    "--vscode-terminalCursor-foreground",
    "--vscode-terminal-foreground",
    "--vscode-editor-foreground",
  ],
  cursorAccent: ["--vscode-terminal-background", "--vscode-editor-background"],
  selectionBackground: [
    "--vscode-terminal-selectionBackground",
    "--vscode-terminal-inactiveSelectionBackground",
  ],
  black: ["--vscode-terminal-ansiBlack"],
  red: ["--vscode-terminal-ansiRed"],
  green: ["--vscode-terminal-ansiGreen"],
  yellow: ["--vscode-terminal-ansiYellow"],
  blue: ["--vscode-terminal-ansiBlue"],
  magenta: ["--vscode-terminal-ansiMagenta"],
  cyan: ["--vscode-terminal-ansiCyan"],
  white: ["--vscode-terminal-ansiWhite"],
  brightBlack: ["--vscode-terminal-ansiBrightBlack"],
  brightRed: ["--vscode-terminal-ansiBrightRed"],
  brightGreen: ["--vscode-terminal-ansiBrightGreen"],
  brightYellow: ["--vscode-terminal-ansiBrightYellow"],
  brightBlue: ["--vscode-terminal-ansiBrightBlue"],
  brightMagenta: ["--vscode-terminal-ansiBrightMagenta"],
  brightCyan: ["--vscode-terminal-ansiBrightCyan"],
  brightWhite: ["--vscode-terminal-ansiBrightWhite"],
};

export type XtermTheme = Record<string, string>;

export function buildXtermThemeFromCss(getVar: (name: string) => string): XtermTheme {
  const theme: XtermTheme = {};

  for (const [key, vars] of Object.entries(XTERM_THEME_CSS_MAP)) {
    for (const cssVar of vars) {
      const value = getVar(cssVar);
      if (value) {
        theme[key] = value;
        break;
      }
    }
  }

  return theme;
}

/** Inline script: read VS Code theme CSS variables into an xterm.js theme object. */
export function themeReaderScript(): string {
  return `
    const XTERM_THEME_CSS_MAP = ${JSON.stringify(XTERM_THEME_CSS_MAP)};

    function readXtermTheme() {
      const style = getComputedStyle(document.documentElement);
      const getVar = (name) => style.getPropertyValue(name).trim();
      const theme = {};
      for (const [key, vars] of Object.entries(XTERM_THEME_CSS_MAP)) {
        for (const cssVar of vars) {
          const value = getVar(cssVar);
          if (value) {
            theme[key] = value;
            break;
          }
        }
      }
      return theme;
    }

    function applyTheme() {
      const theme = readXtermTheme();
      term.options.theme = theme;
      if (theme.background) {
        document.documentElement.style.background = theme.background;
        document.body.style.background = theme.background;
      }
      try {
        term.refresh(0, term.rows - 1);
      } catch (_) {}
    }
  `;
}
