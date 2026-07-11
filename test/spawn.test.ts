import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPtyEnv, buildSpawnCommand } from "../src/spawn";

describe("buildSpawnCommand", () => {
  it("uses login shell on unix", () => {
    if (process.platform === "win32") {
      return;
    }

    const result = buildSpawnCommand("omp");
    assert.ok(result.args[0] === "-l" && result.args[1] === "-c");
    assert.equal(result.args[2], "omp");
  });

  it("preserves executable arguments in shell command", () => {
    if (process.platform === "win32") {
      return;
    }

    const result = buildSpawnCommand("omp --verbose");
    assert.equal(result.args[2], "omp --verbose");
  });

  it("returns windows command shape on win32", () => {
    if (process.platform !== "win32") {
      return;
    }

    const result = buildSpawnCommand("omp");
    assert.ok(result.file.length > 0);
    assert.ok(result.args.length > 0);
  });
});

describe("buildPtyEnv", () => {
  it("sets terminal env and strips electron flags", () => {
    const env = buildPtyEnv();
    assert.equal(env.TERM, "xterm-256color");
    assert.equal(env.COLORTERM, "truecolor");
    assert.equal(env.LANG, "C.UTF-8");
    assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(env.ELECTRON_NO_ASAR, undefined);
  });
});
