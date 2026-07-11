// Builds one .vsix per platform target, each containing only that target's
// native node-pty binary. Marketplace serves the right file per user.
//
// Usage:  npm run package:all
// Output: oh-my-pi-vscode-<version>@<target>.vsix (one per target)

import { execSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// node-pty optionalDependencies suffix == vsce --target value.
const TARGETS = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
  "win32-arm64",
];

const LYDELL_DIR = join("node_modules", "@lydell");

/** Read the installed wrapper version so platform binaries always match it. */
function ptyVersion() {
  return execSync('node -p "require(\'@lydell/node-pty/package.json\').version"', {
    encoding: "utf8",
  }).trim();
}

/** Remove every platform binary package except `keep`, leaving the JS wrapper intact. */
function prunePlatformBinariesExcept(keep) {
  const keepDir = `node-pty-${keep}`;
  for (const name of readdirSync(LYDELL_DIR)) {
    if (name.startsWith("node-pty-") && name !== keepDir) {
      rmSync(join(LYDELL_DIR, name), { recursive: true, force: true });
    }
  }
}

const version = ptyVersion();
let ok = 0;
let failed = null;

for (const target of TARGETS) {
  process.stdout.write(`\n=== ${target} ===\n`);

  // --no-save keeps package.json/lock untouched; --force bypasses os/cpu gating
  // so a foreign-platform binary installs on the current host. npm also
  // re-installs the host platform's optional dependency, so prune afterwards.
  execSync(
    `npm install --no-save --force @lydell/node-pty-${target}@${version}`,
    { stdio: "inherit" },
  );
  prunePlatformBinariesExcept(target);

  try {
    execSync(`vsce package --target ${target}`, { stdio: "inherit" });
    ok++;
  } catch (err) {
    failed = target;
    process.stderr.write(`\n✗ packaging failed for ${target}\n`);
    break;
  }
}

// Restore the host platform binary for local development. `npm install`
// re-adds it but leaves the last target's --no-save binary behind, so prune.
process.stdout.write(`\n=== restoring host binaries ===\n`);
execSync("npm install", { stdio: "inherit" });
prunePlatformBinariesExcept(`${process.platform}-${process.arch}`);

if (failed) {
  process.exit(1);
}

process.stdout.write(
  `\n✓ Packaged ${ok}/${TARGETS.length} targets (node-pty ${version}).\n`,
);
