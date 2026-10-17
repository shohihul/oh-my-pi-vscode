import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "..", "package.json"), "utf8"),
);

describe("package.json", () => {
  it("runs in the workspace extension host so omp spawns on the remote (WSL/SSH)", () => {
    // A "ui" extension stays on the local machine and would launch the host's omp.
    assert.deepEqual(manifest.extensionKind, ["workspace"]);
  });

  it("keeps machine-specific paths out of remote windows", () => {
    const props = manifest.contributes.configuration.properties;
    assert.equal(props["ohMyPi.executablePath"].scope, "machine-overridable");
    assert.equal(props["ohMyPi.workingDirectory"].scope, "machine-overridable");
  });

  it("offers Send File Path for remote editors", () => {
    const whens = [
      ...manifest.contributes.menus["editor/context"],
      ...manifest.contributes.menus.commandPalette,
    ]
      .filter((item: { command: string }) => item.command === "ohMyPi.sendFile")
      .map((item: { when: string }) => item.when);

    assert.equal(whens.length, 2);
    for (const when of whens) {
      assert.match(when, /resourceScheme == vscode-remote/);
    }
  });
});
