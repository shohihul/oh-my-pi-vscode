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
    assert.equal(appendMonospaceFallback("Consolas, Monospace"), "Consolas, Monospace");
    assert.equal(
      appendMonospaceFallback("Consolas, monospace, monospace"),
      "Consolas, monospace",
    );
  });

  it("normalizes trailing and empty separators instead of emitting empty entries", () => {
    // A raw `${family}, monospace` would produce "Consolas,, monospace", which
    // Chromium may reject as an invalid font-family list.
    assert.equal(appendMonospaceFallback("Consolas,"), "Consolas, monospace");
    assert.equal(appendMonospaceFallback("Consolas, , "), "Consolas, monospace");
    assert.equal(appendMonospaceFallback("Consolas,monospace"), "Consolas, monospace");
    assert.equal(appendMonospaceFallback(" Consolas ,  'Courier New' "), "Consolas, 'Courier New', monospace");
  });

  it("does not produce an empty leading entry for a blank family", () => {
    assert.equal(appendMonospaceFallback(""), "monospace");
    assert.equal(appendMonospaceFallback(" , "), "monospace");
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

  it("ignores sizes that are not finite positive numbers", () => {
    // terminalHtml.ts interpolates the size into the inline script verbatim, so
    // a bad value ("14px", NaN, -5) either breaks the script or renders nothing.
    assert.equal(resolveTerminalFont({ fontSize: -5, terminalFontSize: 12 }).size, 12);
    assert.equal(resolveTerminalFont({ fontSize: NaN }).size, 14);
    assert.equal(resolveTerminalFont({ fontSize: "14px" as any }).size, 14);
    assert.equal(resolveTerminalFont({ fontSize: Infinity }).size, 14);
    assert.equal(resolveTerminalFont({ terminalFontSize: -1 }).size, 14);
    assert.equal(resolveTerminalFont({ fontSize: 0, terminalFontSize: 12 }).size, 12);
  });

  it("ignores a family source that has no visible characters", () => {
    // `","` and `"''"` are truthy, so the old `||` chain let them shadow
    // editor.fontFamily and fall back to a bare `monospace` — the exact bug this
    // change fixes.
    const fromEditor = resolveTerminalFont({
      fontFamily: ",",
      editorFontFamily: "JetBrains Mono",
    });
    assert.match(fromEditor.family, /JetBrains Mono/);
    assert.equal(fromEditor.family, "JetBrains Mono, monospace");

    const onlyQuotes = resolveTerminalFont({ fontFamily: "''" });
    assert.notEqual(onlyQuotes.family, "monospace");
    assert.equal(onlyQuotes.family, DEFAULT_TERMINAL_FONT.family);

    const allInvalid = resolveTerminalFont({
      fontFamily: ",",
      terminalFontFamily: "  ",
      editorFontFamily: '""',
    });
    assert.equal(allInvalid.family, appendMonospaceFallback(DEFAULT_TERMINAL_FONT.family));
  });
});
