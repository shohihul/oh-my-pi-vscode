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

  it("rejects invalid payloads", () => {
    assert.equal(parseTerminalMessage(null), null);
    assert.equal(parseTerminalMessage({ type: "input" }), null);
    assert.equal(parseTerminalMessage({ type: "unknown" }), null);
    assert.equal(parseTerminalMessage({ type: "ready", cols: "80" }), null);
  });
});
