import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTerminalMessage } from "../src/messages";

describe("parseTerminalMessage", () => {
  it("accepts ready with dimensions", () => {
    assert.deepEqual(parseTerminalMessage({ type: "ready", cols: 120, rows: 40 }), {
      type: "ready",
      cols: 120,
      rows: 40,
    });
  });

  it("accepts resize", () => {
    assert.deepEqual(parseTerminalMessage({ type: "resize", cols: 80, rows: 24 }), {
      type: "resize",
      cols: 80,
      rows: 24,
    });
  });

  it("accepts input", () => {
    assert.deepEqual(parseTerminalMessage({ type: "input", data: "hello" }), {
      type: "input",
      data: "hello",
    });
  });

  it("accepts openUrl with uri", () => {
    assert.deepEqual(parseTerminalMessage({ type: "openUrl", uri: "https://example.com" }), {
      type: "openUrl",
      uri: "https://example.com",
    });
  });

  it("rejects openUrl without uri", () => {
    assert.equal(parseTerminalMessage({ type: "openUrl" }), null);
    assert.equal(parseTerminalMessage({ type: "openUrl", uri: "" }), null);
    assert.equal(parseTerminalMessage({ type: "openUrl", uri: 123 }), null);
  });

  it("accepts openFile with path and optional line/col", () => {
    assert.deepEqual(parseTerminalMessage({ type: "openFile", path: "src/foo.ts", line: 10, col: 5 }), {
      type: "openFile",
      path: "src/foo.ts",
      line: 10,
      col: 5,
    });
    assert.deepEqual(parseTerminalMessage({ type: "openFile", path: "/abs/bar.ts" }), {
      type: "openFile",
      path: "/abs/bar.ts",
      line: undefined,
      col: undefined,
    });
  });

  it("rejects openFile without path", () => {
    assert.equal(parseTerminalMessage({ type: "openFile" }), null);
    assert.equal(parseTerminalMessage({ type: "openFile", path: "" }), null);
    assert.equal(parseTerminalMessage({ type: "openFile", line: 10 }), null);
  });

  it("rejects invalid payloads", () => {
    assert.equal(parseTerminalMessage(null), null);
    assert.equal(parseTerminalMessage({ type: "input" }), null);
    assert.equal(parseTerminalMessage({ type: "ready", cols: "80" }), null);
    assert.equal(parseTerminalMessage({ type: "openUrl", uri: "" }), null);
  });
});
