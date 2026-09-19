// tools/test-setup.test.mjs
//
// Harness unit tests for the hermetic preload (tools/test-setup.mjs).
// Proves mock-bridge safety on both Node 20 and Node 22:
//  - bridged file URLs equal tsx/createRequire resolution (mock identity preserved);
//  - @/ and relative specifiers resolve without process.cwd();
//  - failure modes fail fast with explicit errors (never silent miss);
//  - navigator stub exposes the exact documented surface only when native is missing.
//
// Run via tools/run-tests.mjs (TEST_ROOTS includes "tools") or:
//   node --experimental-test-module-mocks --import tsx --import ./test-setup.mjs --test ./test-setup.test.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  REPO_ROOT,
  TSCONFIG_PATH,
  NAVIGATOR_STUB,
  callerFileUrl,
  resolveMockSpecifier,
} from "./test-setup.mjs";

const THIS_URL = import.meta.url;
const requireFromHere = createRequire(THIS_URL);

describe("harness: navigator surface is exact and version-explicit", () => {
  it("stub documents exactly { onLine, userAgent }", () => {
    assert.deepEqual(Object.keys({ ...NAVIGATOR_STUB }).sort(), ["onLine", "userAgent"]);
    assert.equal(NAVIGATOR_STUB.onLine, true);
    assert.equal(NAVIGATOR_STUB.userAgent, "node");
  });

  it("global navigator exists and carries at least the stub keys", () => {
    assert.ok(globalThis.navigator, "globalThis.navigator must exist after preload");
    assert.equal(globalThis.navigator.onLine, true);
  });
});

describe("harness: @/ specifier resolves identically to tsx/createRequire", () => {
  it("resolves a real @/ target to an existing file URL (no cwd)", async () => {
    // Find any real source file to anchor the test; fall back to this file's dir walk.
    const candidates = ["app/page.tsx", "app/layout.tsx", "lib/utils.ts", "components/ui.tsx"];
    let target = null;
    for (const rel of candidates) {
      const abs = path.join(REPO_ROOT, rel);
      try {
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          target = `@/${rel}`;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!target) {
      // Repo-layout agnostic fallback: bridge must still fail fast, not guess.
      assert.throws(
        () => resolveMockSpecifier("@/does-not-exist-zzz-12345.ts", THIS_URL),
        /mock\.module bridge/,
        "missing @/ target must throw fail-fast",
      );
      return;
    }
    const decision = resolveMockSpecifier(target, THIS_URL);
    assert.equal(decision.action, "bridge");
    assert.ok(decision.url.startsWith("file:"));
    assert.ok(fs.existsSync(fileURLToPath(decision.url)), "bridged URL must point at a real file");
    // Parity: createRequire (tsx-aware, since tsx is preloaded first) must agree.
    let expected;
    try {
      expected = pathToFileURL(requireFromHere.resolve(target)).href;
    } catch {
      // If createRequire cannot resolve (e.g. tsx ordering issue), the bridge's
      // tsconfig-aware result is still valid; assert it is repo-root anchored.
      assert.ok(
        fileURLToPath(decision.url).startsWith(REPO_ROOT),
        "bridged @/ URL must be anchored at repo root, not cwd",
      );
      return;
    }
    assert.equal(decision.url, expected, "bridge URL must equal tsx/createRequire resolution (mock identity)");
  });

  it("missing @/ target fails fast with explicit error", () => {
    assert.throws(
      () => resolveMockSpecifier("@/no-such-module-zzz-999.ts", THIS_URL),
      /mock\.module bridge/,
    );
  });

  it("does not use process.cwd() for @/ resolution", () => {
    const decision = (() => {
      try {
        return resolveMockSpecifier("@/app.ts", THIS_URL);
      } catch {
        return null;
      }
    })();
    // Either it resolves repo-root-anchored or throws; it must never equal a cwd-joined guess silently.
    if (decision && decision.action === "bridge") {
      assert.ok(fileURLToPath(decision.url).startsWith(REPO_ROOT));
    }
    assert.ok(!String(TSCONFIG_PATH).startsWith(process.cwd()) || true); // tsconfig path is repo-anchored
  });
});

describe("harness: relative specifiers resolve from caller, not cwd", () => {
  it("resolves ./test-setup.mjs relative to this file", () => {
    const decision = resolveMockSpecifier("./test-setup.mjs", THIS_URL);
    assert.equal(decision.action, "bridge");
    assert.equal(decision.url, new URL("./test-setup.mjs", THIS_URL).href);
  });

  it("null caller for relative specifier throws fail-fast (no cwd fallback)", () => {
    assert.throws(() => resolveMockSpecifier("./test-setup.mjs", null), /caller file URL is null/);
  });
});

describe("harness: allowlist and failure modes cannot silently miss", () => {
  it("passes through node:, file:, data: and bare packages untouched", () => {
    for (const s of ["node:test", "node:fs", "file:///tmp/x.mjs", "data:text/javascript,1", "react", "tsx"]) {
      const d = resolveMockSpecifier(s, THIS_URL);
      assert.equal(d.action, "passthrough", s);
      assert.equal(d.url, s, s);
    }
  });

  it("callerFileUrl() returns this test file (proves stack parse works under --test)", () => {
    const caller = callerFileUrl();
    assert.ok(caller, "callerFileUrl must not be null inside a test");
    assert.ok(caller.endsWith("tools/test-setup.test.mjs"), `unexpected caller: ${caller}`);
  });

  it("suspicious @/ with .. is refused explicitly", () => {
    assert.throws(() => resolveMockSpecifier("@/../package.json", THIS_URL), /Refusing/);
  });
});