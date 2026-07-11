import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildXtermThemeFromCss } from "../src/theme/xtermTheme";

describe("buildXtermThemeFromCss", () => {
  it("maps VS Code terminal CSS variables to xterm theme keys", () => {
    const vars: Record<string, string> = {
      "--vscode-terminal-background": "#1a1a1a",
      "--vscode-terminal-foreground": "#d4d4d4",
      "--vscode-terminalCursor-foreground": "#ffffff",
      "--vscode-terminal-selectionBackground": "#264f78",
      "--vscode-terminal-ansiRed": "#f44747",
      "--vscode-terminal-ansiBrightGreen": "#23d18b",
    };

    const theme = buildXtermThemeFromCss((name) => vars[name] ?? "");

    assert.equal(theme.background, "#1a1a1a");
    assert.equal(theme.foreground, "#d4d4d4");
    assert.equal(theme.cursor, "#ffffff");
    assert.equal(theme.selectionBackground, "#264f78");
    assert.equal(theme.red, "#f44747");
    assert.equal(theme.brightGreen, "#23d18b");
  });

  it("falls back to editor colors for background and foreground", () => {
    const vars: Record<string, string> = {
      "--vscode-editor-background": "#2d2d2d",
      "--vscode-editor-foreground": "#cccccc",
    };

    const theme = buildXtermThemeFromCss((name) => vars[name] ?? "");

    assert.equal(theme.background, "#2d2d2d");
    assert.equal(theme.foreground, "#cccccc");
    assert.equal(theme.cursor, "#cccccc");
    assert.equal(theme.cursorAccent, "#2d2d2d");
  });
});
