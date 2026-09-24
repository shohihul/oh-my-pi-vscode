import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TERMINAL_FONT,
  appendMonospaceFallback,
  resolveTerminalFont,
} from "../src/appearance";

describe("appendMonospaceFallback", () => {
  it("appends the generic fallback when missing", () => {
    assert.equal(appendMonospaceFallback("Consolas"), "Consolas, monospace");
  });

  it("does not duplicate an existing generic fallback", () => {
    assert.equal(appendMonospaceFallback("Consolas, monospace"), "Consolas, monospace");
    assert.equal(appendMonospaceFallback("Consolas,monospace"), "Consolas,monospace");
    assert.equal(appendMonospaceFallback("Consolas, Monospace"), "Consolas, Monospace");
  });
});

describe("resolveTerminalFont", () => {
  it("falls back to the platform monospace stack when nothing is configured", () => {
    // Regression: the webview used to receive a bare `monospace`, which Chromium
    // can resolve to a non-programming font (NSimSun on zh-CN Windows) whose
    // box-drawing and Nerd Font glyphs are full-width and break the TUI layout.
    const font = resolveTerminalFont({});

    assert.equal(font.family, DEFAULT_TERMINAL_FONT.family);
    assert.notEqual(font.family, "monospace");
    assert.match(font.family, /monospace$/);
    assert.equal(font.size, 14);
  });

  it("prefers ohMyPi.fontFamily over terminal and editor settings", () => {
    const font = resolveTerminalFont({
      fontFamily: "JetBrains Mono",
      terminalFontFamily: "Consolas",
      editorFontFamily: "'DaddyTimeMono Nerd Font'",
    });

    assert.equal(font.family, "JetBrains Mono, monospace");
  });

  it("prefers terminal.integrated.fontFamily over editor.fontFamily", () => {
    const font = resolveTerminalFont({
      fontFamily: "   ",
      terminalFontFamily: "Consolas",
      editorFontFamily: "'DaddyTimeMono Nerd Font'",
    });

    assert.equal(font.family, "Consolas, monospace");
  });

  it("inherits editor.fontFamily like VS Code's built-in terminal", () => {
    const font = resolveTerminalFont({ editorFontFamily: "'DaddyTimeMono Nerd Font'" });

    assert.equal(font.family, "'DaddyTimeMono Nerd Font', monospace");
  });

  it("keeps a configured multi-font stack intact", () => {
    const font = resolveTerminalFont({
      terminalFontFamily: "'DaddyTimeMono Nerd Font', 'Cascadia Mono', monospace",
    });

    assert.equal(font.family, "'DaddyTimeMono Nerd Font', 'Cascadia Mono', monospace");
  });

  it("resolves size with panel > terminal > default precedence", () => {
    assert.equal(resolveTerminalFont({ fontSize: 16, terminalFontSize: 12 }).size, 16);
    assert.equal(resolveTerminalFont({ fontSize: 0, terminalFontSize: 12 }).size, 12);
    assert.equal(resolveTerminalFont({ terminalFontSize: 18 }).size, 18);
    assert.equal(resolveTerminalFont({}).size, 14);
  });
});
