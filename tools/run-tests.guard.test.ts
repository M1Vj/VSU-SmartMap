import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import {
  ENGINE_MISMATCH_EXIT_CODE,
  FALLBACK_REQUIRED_MAJOR,
  GATED_LEGACY_SKIP_EXIT_CODE,
  SKIP_VARS,
  evaluateNodeGuard,
  getCurrentNodeMajor,
  isLegacySkipRequested,
  parseRequiredMajor,
  readRequiredNodeMajor,
} from "./run-tests.mjs";

test("parseRequiredMajor extracts the leading major from engines ranges", () => {
  assert.equal(parseRequiredMajor(">=22"), 22);
  assert.equal(parseRequiredMajor("^22.0.0"), 22);
  assert.equal(parseRequiredMajor(">=22 <25"), 22);
  assert.equal(parseRequiredMajor(undefined, 22), 22);
  assert.equal(parseRequiredMajor("", 22), 22);
  assert.equal(parseRequiredMajor(null, 22), 22);
});

test("readRequiredNodeMajor falls back to 22 when package.json is missing", () => {
  assert.equal(readRequiredNodeMajor("/nonexistent/package.json"), FALLBACK_REQUIRED_MAJOR);
});

test("getCurrentNodeMajor parses leading major deterministically", () => {
  assert.equal(getCurrentNodeMajor("22.13.0"), 22);
  assert.equal(getCurrentNodeMajor("20.20.2"), 20);
  assert.equal(getCurrentNodeMajor("24.1.0"), 24);
});

test("isLegacySkipRequested accepts 1/true/yes case-insensitively", () => {
  for (const v of ["1", "true", "TRUE", " True ", "yes", "YES"]) {
    assert.equal(isLegacySkipRequested({ VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS: v }), true);
    assert.equal(isLegacySkipRequested({ FLEET_ALLOW_LEGACY_NODE_TESTS: v }), true);
  }
});

test("isLegacySkipRequested rejects unset and falsy values (fail-closed)", () => {
  assert.equal(isLegacySkipRequested({}), false);
  for (const v of ["0", "false", "no", "", "skip", "2"]) {
    assert.equal(isLegacySkipRequested({ VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS: v }), false);
    assert.equal(isLegacySkipRequested({ FLEET_ALLOW_LEGACY_NODE_TESTS: v }), false);
  }
});

test("evaluateNodeGuard passes compatible runtimes", () => {
  assert.deepEqual(
    evaluateNodeGuard({ requiredMajor: 22, currentMajor: 22, skipRequested: false }),
    { ok: true, exitCode: 0, reason: "compatible runtime" },
  );
  assert.deepEqual(
    evaluateNodeGuard({ requiredMajor: 22, currentMajor: 24, skipRequested: false }).ok,
    true,
  );
});

test("evaluateNodeGuard fails closed with exit 1 on legacy without gate (never 0)", () => {
  const d = evaluateNodeGuard({ requiredMajor: 22, currentMajor: 20, skipRequested: false });
  assert.equal(d.ok, false);
  assert.equal(d.exitCode, ENGINE_MISMATCH_EXIT_CODE);
  assert.equal(d.exitCode, 1);
  assert.notEqual(d.exitCode, 0);
});

test("evaluateNodeGuard gated legacy skip uses distinct non-zero exit 2 (never 0)", () => {
  const d = evaluateNodeGuard({ requiredMajor: 22, currentMajor: 20, skipRequested: true });
  assert.equal(d.ok, false);
  assert.equal(d.exitCode, GATED_LEGACY_SKIP_EXIT_CODE);
  assert.equal(d.exitCode, 2);
  assert.notEqual(d.exitCode, 0);
  assert.match(d.reason, /never|non-zero|fail/i);
});

test("run-tests.mjs has no fail-open exit(0) skip path", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "run-tests.mjs"), "utf8");
  // The only allowed process.exit occurrences are: fail-fast 1, gated-skip 2
  // (via named constants / decision.exitCode), and child-code propagation.
  // There must be no literal fail-open `process.exit(0)` skip.
  assert.doesNotMatch(src, /process\.exit\s*\(\s*0\s*\)/);
});

test("run-tests.mjs performs no arbitrary-binary execution or shell-out", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "run-tests.mjs"), "utf8");
  assert.doesNotMatch(src, /spawnSync/);
  assert.doesNotMatch(src, /bash/);
  assert.doesNotMatch(src, /command\s+-v/);
  assert.doesNotMatch(src, /hostedtoolcache/);
  assert.doesNotMatch(src, /VSU_SMARTMAP_NODE_BIN|FLEET_NODE_BIN|NODE22_BIN/);
  assert.doesNotMatch(src, /REEXEC_SENTINEL|VSU_SMARTMAP_NODE_REEXEC/);
  assert.doesNotMatch(src, /\.nvm/);
  // Hermetic execution uses only the current interpreter.
  assert.match(src, /process\.execPath/);
});

test("run-tests.mjs skip vars are explicitly gated with a clear reason", () => {
  assert.deepEqual(SKIP_VARS, [
    "VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS",
    "FLEET_ALLOW_LEGACY_NODE_TESTS",
  ]);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "run-tests.mjs"), "utf8");
  assert.match(src, /VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS/);
  assert.match(src, /FLEET_ALLOW_LEGACY_NODE_TESTS/);
  assert.match(src, /fail/i);
});