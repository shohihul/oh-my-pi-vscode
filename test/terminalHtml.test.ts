import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";

import { DEFAULT_TERMINAL_FONT } from "../src/appearance";
import { buildTerminalHtml, clearAssetCache } from "../src/terminal/terminalHtml";

const appearance = {
  font: DEFAULT_TERMINAL_FONT,
};

describe("buildTerminalHtml", () => {
  it("returns ok html when assets exist", () => {
    clearAssetCache();
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const result = buildTerminalHtml(extensionPath, appearance);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.html, /xterm/);
      assert.match(result.html, /readXtermTheme/);
      assert.match(result.html, /applyTheme/);
      assert.match(result.html, /vscode-terminal-background/);
      assert.match(result.html, /acquireVsCodeApi/);
    }
  });

  it("returns error html when assets are missing", () => {
    clearAssetCache();
    const result = buildTerminalHtml("/nonexistent/path", appearance);

    assert.equal(result.ok, false);
    assert.match(result.html, /Failed to load terminal assets/);
  });
});
