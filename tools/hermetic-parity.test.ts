/**
 * Regression coverage for the hermetic test harness (PR #98 follow-up).
 *
 * Proves, on every runtime (Node 20 fleet runners through Node 22 CI):
 * - Only tsconfig `@/*` specifiers are ever rewritten (bare `@/...` and
 *   the Node 20 mock-loader `file://.../@/...` join); every other
 *   specifier yields `null` and must pass through untouched.
 * - Unsafe suffixes (traversal, absolute, encoded, empty) are rejected so
 *   `path.join(REPO_ROOT, suffix)` can never escape the repository.
 * - `getNavigatorPlatform` replicates Node's `lib/internal/navigator.js`
 *   mapping exactly, and the shim installs only on Node < 21 when the
 *   global is missing (native Node 22 navigator is left untouched, and no
 *   synthetic `onLine` is added on either runtime).
 * - The runner entrypoint is fail-closed: no `exit 0` skip path remains.
 *
 * Intentionally additive: the pre-existing 967-test total is unchanged;
 * these cases are extra. Uses only relative imports so it runs without
 * the alias hook.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractBareAliasSuffix,
  extractFileUrlAliasSuffix,
  getNavigatorPlatform,
  isSafeAliasSuffix,
  shouldInstallNavigator,
} from "./test-hermetic-setup.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

describe("hermetic alias suffix extraction", () => {
  it("extracts bare @/ suffixes only", () => {
    assert.equal(extractBareAliasSuffix("@/lib/foo"), "lib/foo");
    assert.equal(extractBareAliasSuffix("@/a"), "a");
    assert.equal(extractBareAliasSuffix("@/"), null);
    assert.equal(extractBareAliasSuffix("@"), null);
    assert.equal(extractBareAliasSuffix("@lib/foo"), null);
    assert.equal(extractBareAliasSuffix("./lib/foo"), null);
    assert.equal(extractBareAliasSuffix("fs"), null);
    assert.equal(extractBareAliasSuffix("file:///repo/@/lib"), null);
  });

  it("extracts file:// /@/ suffixes only", () => {
    assert.equal(
      extractFileUrlAliasSuffix("file:///repo/app/@/lib/foo"),
      "lib/foo",
    );
    assert.equal(extractFileUrlAliasSuffix("file:///x/@/a"), "a");
    assert.equal(extractFileUrlAliasSuffix("file:///x/@/"), null);
    assert.equal(extractFileUrlAliasSuffix("file:///x/lib"), null);
    assert.equal(extractFileUrlAliasSuffix("@/lib/foo"), null);
    assert.equal(extractFileUrlAliasSuffix("node:test"), null);
    assert.equal(extractFileUrlAliasSuffix("https://x/@/a"), null);
  });

  it("preserves suffixes that themselves contain /@/", () => {
    assert.equal(
      extractFileUrlAliasSuffix("file:///repo/app/@/b/@/c"),
      "b/@/c",
    );
  });
});

describe("hermetic alias safety (fail-closed, no traversal/masking)", () => {
  it("accepts ordinary repo-relative suffixes", () => {
    assert.equal(isSafeAliasSuffix("lib/foo"), true);
    assert.equal(isSafeAliasSuffix("app/page.test.ts"), true);
    assert.equal(isSafeAliasSuffix("a"), true);
  });

  it("rejects traversal, absolute, empty, and encoded suffixes", () => {
    assert.equal(isSafeAliasSuffix(""), false);
    assert.equal(isSafeAliasSuffix("../secret"), false);
    assert.equal(isSafeAliasSuffix("a/../../etc/passwd"), false);
    assert.equal(isSafeAliasSuffix("a/../b"), false);
    assert.equal(isSafeAliasSuffix("/etc/passwd"), false);
    assert.equal(isSafeAliasSuffix("a//b"), false);
    assert.equal(isSafeAliasSuffix("a\\b"), false);
    assert.equal(isSafeAliasSuffix("a\0b"), false);
    assert.equal(isSafeAliasSuffix("."), false);
    assert.equal(isSafeAliasSuffix(".."), false);
    assert.equal(isSafeAliasSuffix("%2e%2e/secret"), false);
    assert.equal(isSafeAliasSuffix("a/%2e%2e/b"), false);
    assert.equal(isSafeAliasSuffix("%2fetc"), false);
  });
});

describe("hermetic navigator parity (Node 21+ shape, Node-20-only install)", () => {
  it("replicates lib/internal/navigator.js platform mapping", () => {
    assert.equal(getNavigatorPlatform("darwin", "arm64"), "MacIntel");
    assert.equal(getNavigatorPlatform("darwin", "x64"), "MacIntel");
    assert.equal(getNavigatorPlatform("win32", "x64"), "Win32");
    assert.equal(getNavigatorPlatform("linux", "x64"), "Linux x86_64");
    assert.equal(getNavigatorPlatform("linux", "ia32"), "Linux i686");
    assert.equal(getNavigatorPlatform("freebsd", "x64"), "FreeBSD amd64");
  });

  it("installs only when missing on Node < 21", () => {
    assert.equal(shouldInstallNavigator(undefined, 20), true);
    assert.equal(shouldInstallNavigator(undefined, 22), false);
    assert.equal(shouldInstallNavigator({} as never, 20), false);
    assert.equal(shouldInstallNavigator({} as never, 22), false);
  });
});

describe("hermetic runner is fail-closed (no silent green)", () => {
  it("contains no exit-0 skip path and denies SKIP with exit 2", () => {
    const runner = readFileSync(
      path.join(THIS_DIR, "run-tests-hermetic.mjs"),
      "utf8",
    );
    assert.match(runner, /VSU_SMARTMAP_SKIP_TESTS/);
    assert.doesNotMatch(runner, /process\.exit\(0\)/);
    assert.match(runner, /process\.exit\(2\)/);
    assert.match(runner, /SKIP=unset/);
  });
});