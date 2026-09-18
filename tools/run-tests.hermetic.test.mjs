/**
 * Self-tests for tools/run-tests.hermetic.mjs (addresses no-tests blocker).
 *
 * Covers: hermetic fallback newest-pick, arg forwarding, exit-code
 * propagation, signal classification, fail-closed exit 2, relative-path
 * rejection, missing-override rejection, allowlist enforcement.
 *
 * Run: `npm run test:hermetic:selftest`
 *      `node --test tools/run-tests.hermetic.test.mjs`
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWLIST_DIRS,
  MIN_MAJOR,
  REAL_RUNNER,
  buildReexecArgs,
  checkRunnerExists,
  compareVersions,
  currentMajor,
  isInsideAllowlist,
  nextExitForResult,
  parseVersion,
  probeNodeBinary,
  selectNewestCompliant,
  tryNodeMajor,
  validateOverrideCandidate,
} from "./run-tests.hermetic.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER = path.join(HERE, "run-tests.hermetic.mjs");

describe("parseVersion / compareVersions (newest-pick regression)", () => {
  it("parses v-prefixed and bare versions", () => {
    assert.deepEqual(parseVersion("v22.23.2"), { major: 22, minor: 23, patch: 2, raw: "22.23.2" });
    assert.deepEqual(parseVersion("22.0.0"), { major: 22, minor: 0, patch: 0, raw: "22.0.0" });
    assert.equal(parseVersion("not-a-version"), null);
    assert.equal(parseVersion("v22.1"), null);
  });

  it("compares semver correctly", () => {
    assert.equal(compareVersions({ major: 22, minor: 0, patch: 0 }, { major: 20, minor: 9, patch: 0 }), 1);
    assert.equal(compareVersions({ major: 20, minor: 0, patch: 0 }, { major: 22, minor: 0, patch: 0 }), -1);
    assert.equal(compareVersions({ major: 22, minor: 5, patch: 1 }, { major: 22, minor: 5, patch: 1 }), 0);
    assert.equal(compareVersions({ major: 22, minor: 10, patch: 0 }, { major: 22, minor: 9, patch: 9 }), 1);
  });

  it("selectNewestCompliant picks maximum, not minimum", () => {
    const best = selectNewestCompliant([
      { bin: "/a/node22.0.0", version: { major: 22, minor: 0, patch: 0 } },
      { bin: "/a/node22.23.2", version: { major: 22, minor: 23, patch: 2 } },
      { bin: "/a/node20.20.2", version: { major: 20, minor: 20, patch: 2 } },
      { bin: "/a/node24.1.0", version: { major: 24, minor: 1, patch: 0 } },
    ]);
    assert.equal(best.bin, "/a/node24.1.0");
    const best22 = selectNewestCompliant([
      { bin: "/a/n1", version: { major: 22, minor: 1, patch: 0 } },
      { bin: "/a/n2", version: { major: 22, minor: 23, patch: 2 } },
    ]);
    assert.equal(best22.bin, "/a/n2");
  });

  it("selectNewestCompliant ignores non-compliant majors", () => {
    assert.equal(selectNewestCompliant([{ bin: "/x", version: { major: 20, minor: 0, patch: 0 } }]), null);
    assert.equal(selectNewestCompliant([]), null);
  });
});

describe("allowlist + override validation (arbitrary-execution hardening)", () => {
  it("allowlist contains hosted toolcache roots", () => {
    assert.ok(ALLOWLIST_DIRS.includes("/opt/hostedtoolcache/node"));
    assert.ok(ALLOWLIST_DIRS.includes("/opt/acttoolcache/node"));
  });

  it("isInsideAllowlist accepts children, rejects escape", () => {
    assert.equal(isInsideAllowlist("/opt/hostedtoolcache/node/22.23.2/x64/bin/node"), true);
    assert.equal(isInsideAllowlist("/opt/hostedtoolcache/node"), true);
    assert.equal(isInsideAllowlist("/tmp/evil/node"), false);
    assert.equal(isInsideAllowlist("/opt/hostedtoolcache/node-evil/bin/node"), false);
  });

  it("rejects relative VSU_SMARTMAP_NODE22_BIN", () => {
    const r = validateOverrideCandidate("relative/path/node");
    assert.equal(r.ok, false);
    assert.match(r.error, /absolute/);
    const r2 = validateOverrideCandidate("./node");
    assert.equal(r2.ok, false);
  });

  it("rejects missing absolute path", () => {
    const r = validateOverrideCandidate("/nonexistent-allowlisted-node-xyz/bin/node");
    assert.equal(r.ok, false);
  });

  it("rejects shebang shim even when executable", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hermetic-shim-"));
    const shim = path.join(dir, "node");
    writeFileSync(shim, "#!/bin/sh\necho v22.23.2\n", { mode: 0o755 });
    try {
      chmodSync(shim, 0o755);
    } catch {
      // ignore
    }
    const probed = probeNodeBinary(shim);
    assert.equal(probed, null);
  });

  it("current toolchain probes as real node when compliant", () => {
    const major = tryNodeMajor(process.execPath);
    assert.ok(typeof major === "number" && major >= 16);
    if (currentMajor() >= 22) {
      assert.ok(major >= 22);
    }
  });
});

describe("fail-closed and exit semantics (exit 2, propagation)", () => {
  it("real runner path constant points at run-tests.mjs", () => {
    assert.ok(REAL_RUNNER.endsWith("run-tests.mjs"));
  });

  it("checkRunnerExists detects missing runner", () => {
    assert.equal(checkRunnerExists("/definitely/missing/runner-xyz.mjs"), false);
  });

  it("nextExitForResult propagates exit codes (zero-files exit 1 preserved)", () => {
    assert.deepEqual(nextExitForResult({ status: 0, signal: null }), { kind: "exit", code: 0 });
    assert.deepEqual(nextExitForResult({ status: 1, signal: null }), { kind: "exit", code: 1 });
    assert.deepEqual(nextExitForResult({ status: 7, signal: null }), { kind: "exit", code: 7 });
    assert.deepEqual(nextExitForResult({ status: null, signal: "SIGTERM" }), {
      kind: "signal",
      signal: "SIGTERM",
    });
  });

  it("failClosed exits 2 and never silently succeeds", () => {
    const r = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `import(${JSON.stringify(WRAPPER)}).then((m) => m.failClosed("probe-selftest"))`],
      { encoding: "utf8", timeout: 15000, shell: false }
    );
    assert.equal(r.status, 2);
    assert.match(String(r.stderr ?? ""), /FAIL-CLOSED/);
  });

  it("invalid (relative) override fails closed with exit 2", () => {
    const r = spawnSync(process.execPath, [WRAPPER, "--help"], {
      encoding: "utf8",
      timeout: 30000,
      shell: false,
      env: {
        ...process.env,
        VSU_SMARTMAP_NODE22_BIN: "relative/path/node",
        VSU_SMARTMAP_TEST_FORCE_MAJOR: "20",
      },
    });
    assert.equal(r.status, 2);
    assert.match(String(r.stderr ?? ""), /FAIL-CLOSED/);
  });

  it("missing override target fails closed with exit 2", () => {
    const r = spawnSync(process.execPath, [WRAPPER], {
      encoding: "utf8",
      timeout: 30000,
      shell: false,
      env: {
        ...process.env,
        VSU_SMARTMAP_NODE22_BIN: "/opt/hostedtoolcache/node/99.99.99/x64/bin/node",
        VSU_SMARTMAP_TEST_FORCE_MAJOR: "20",
      },
    });
    assert.equal(r.status, 2);
  });

  it("arg forwarding builder preserves argv verbatim", () => {
    const saved = process.argv;
    try {
      process.argv = ["node", WRAPPER, "--foo", "bar baz", "--num=7"];
      const args = buildReexecArgs();
      assert.equal(args[0], REAL_RUNNER);
      assert.deepEqual(args.slice(1), ["--foo", "bar baz", "--num=7"]);
    } finally {
      process.argv = saved;
    }
  });

  it("child exit code propagates (exit 7 stays 7)", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(WRAPPER)}).then((m) => m.runAndPropagate(process.execPath, ["-e", "process.exit(7)"]))`,
      ],
      { encoding: "utf8", timeout: 15000, shell: false }
    );
    assert.equal(r.status, 7);
  });

  it("child stdout is inherited through runAndPropagate (forwarding proof)", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(WRAPPER)}).then((m) => m.runAndPropagate(process.execPath, ["-e", "console.log('FORWARD-MARKER-12345')"]))`,
      ],
      { encoding: "utf8", timeout: 15000, shell: false }
    );
    assert.equal(r.status, 0);
    assert.match(String(r.stdout ?? ""), /FORWARD-MARKER-12345/);
  });

  it("MIN_MAJOR is 22 (engines invariant)", () => {
    assert.equal(MIN_MAJOR, 22);
  });
});