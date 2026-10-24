import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import vm from "node:vm";

import { DEFAULT_TERMINAL_FONT } from "../src/appearance";
import { buildTerminalHtml, clearAssetCache } from "../src/terminal/terminalHtml";

describe("buildTerminalHtml", () => {
  it("returns ok html when assets exist", () => {
    clearAssetCache();
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const result = buildTerminalHtml(extensionPath, DEFAULT_TERMINAL_FONT);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.html, /xterm/);
      assert.match(result.html, /SearchAddon/);
      assert.match(result.html, /search-bar/);
      assert.match(result.html, /readXtermTheme/);
      assert.match(result.html, /applyTheme/);
      assert.match(result.html, /vscode-terminal-background/);
      assert.match(result.html, /acquireVsCodeApi/);
      // Shift+Enter must inject a newline sequence (xterm.js drops shiftKey for Enter).
      assert.match(result.html, /e\.shiftKey/);
      assert.match(result.html, /\\x1b\[13;2~/);
    }
  });

  it("inline webview script is syntactically valid", () => {
    clearAssetCache();
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const result = buildTerminalHtml(extensionPath, DEFAULT_TERMINAL_FONT);
    assert.equal(result.ok, true);
    if (result.ok) {
      // Extract the last nonce'd <script> (the inline app code) and confirm it
      // parses. Guards against template-literal escape sequences (e.g. a bare
      // \r in a // comment) that silently corrupt the webview and blank the TUI.
      const scripts = [...result.html.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)].map(
        (m) => m[1],
      );
      const appScript = scripts[scripts.length - 1];
      assert.ok(appScript, "inline app script not found");
      assert.doesNotThrow(() => new vm.Script(appScript!, { filename: "webview-app.js" }));
    }
  });

  it("escapes a font family containing </script> so the script block stays intact", () => {
    clearAssetCache();
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const baseline = buildTerminalHtml(extensionPath, DEFAULT_TERMINAL_FONT);
    const result = buildTerminalHtml(extensionPath, {
      family: "</script><b>trap</b>, monospace",
      size: 14,
    });

    assert.equal(baseline.ok, true);
    assert.equal(result.ok, true);
    if (!baseline.ok || !result.ok) {
      return;
    }

    const closingTags = (html: string) => [...html.matchAll(/<\/script>/g)].length;
    assert.equal(closingTags(result.html), closingTags(baseline.html));
    assert.ok(result.html.includes("\\u003c/script>"));
    assert.ok(!result.html.includes("</script><b>trap</b>"));

    const scripts = [...result.html.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    const appScript = scripts[scripts.length - 1];
    assert.ok(appScript, "inline app script not found");
    // Still a valid JS string literal, and the escape is not double-escaped.
    assert.match(appScript!, /fontFamily: "\\u003c\/script>/);
    assert.doesNotThrow(() => new vm.Script(appScript!, { filename: "webview-app.js" }));
  });

  it("clamps a non-finite font size to the default instead of emitting NaN", () => {
    clearAssetCache();
    const extensionPath = path.resolve(import.meta.dirname, "..");
    const result = buildTerminalHtml(extensionPath, {
      family: "Consolas, monospace",
      size: Number.NaN,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.html, /fontSize: 14/);
      assert.doesNotMatch(result.html, /fontSize:\s*(?:NaN|-?Infinity)/);
    }
  });

  it("returns error html when assets are missing", () => {
    clearAssetCache();
    const result = buildTerminalHtml("/nonexistent/path", DEFAULT_TERMINAL_FONT);

    assert.equal(result.ok, false);
    assert.match(result.html, /Failed to load terminal assets/);
  });
});
