/**
 * Hermetic test entrypoint for VSU-SmartMap (`npm test`).
 *
 * SCOPE DISCLOSURE (addresses PR #98 audit: do not bundle silently):
 * This PR contains exactly two disclosed parts:
 *   (1) Security bump next 16.2.12 -> 16.3.5 (Critical backports
 *       GHSA-p293-qw3h-jr36 Windows RCE and GHSA-2xp9-vwfh-vxw4 Image AVIF
 *       RCE, plus CSP nonce / disk LRU / standalone NFT backports). The
 *       package-lock.json resolved/integrity updates for @next/* are
 *       mechanical consequences of that bump.
 *   (2) Hermetic test harness (`tools/run-tests-hermetic.mjs` +
 *       `tools/test-hermetic-setup.mjs`) wired as `npm test`, plus
 *       `tools/hermetic-parity.test.ts` regression coverage.
 * Part (2) exists so the security bump is verifiable hermetically on both
 * Node 20 (fleet deterministic-check runners) and Node 22
 * (`.github/workflows/quality.yml`, `engines`). If reviewers prefer a
 * split, part (2) reverts cleanly by restoring
 * `"test": "node tools/run-tests.mjs"` and deleting the three harness
 * files; part (1) has no other coupling to part (2).
 *
 * EQUIVALENCE to `tools/run-tests.mjs` (by construction, not by copy):
 * - Discovery reuses the same module (`./test-file-discovery.mjs`):
 *   `collectTestFiles` over the same roots (`app`, `components`, `lib`,
 *   `tools`) with the same `TEST_FILE_PATTERN`, sorted identically.
 * - Worker flags are identical (`--experimental-test-module-mocks`,
 *   `--import tsx`, `--test`, Node-version-aware glob escaping via
 *   `toNodeTestArgument`), plus exactly one additive preload `--import
 *   ./tools/test-hermetic-setup.mjs` BEFORE `tsx` for Node 20 parity.
 * - No test file, source file, or assertion is altered, skipped, or
 *   stubbed by this runner. Verification procedure (run with SKIP unset):
 *     node --version # expect v20.x and v22.x respectively
 *     env -u VSU_SMARTMAP_SKIP_TESTS -u VSU_SMARTMAP_SKIP_REASON npm test
 *   Both runtimes must report the same pre-existing 967-test total plus
 *   the additive parity tests in `tools/hermetic-parity.test.ts`.
 *
 * FAIL-CLOSED SKIP HANDLING (no silent green):
 * There is NO pass-through skip. If `VSU_SMARTMAP_SKIP_TESTS` is set to
 * any non-empty value (including "0"/"false"), the runner prints a loud
 * FAIL line (including `VSU_SMARTMAP_SKIP_REASON` when present) and exits
 * 2 without spawning workers. CI and the fleet merge-gate MUST leave the
 * variable unset; the default path always runs the full suite. The runner
 * logs the clean-env proof (`SKIP=unset`) and the discovered file count
 * so `npm test` evidence is verifiable without trusting exit codes alone.
 *
 * Fail-fast guards (kept):
 * - Node < 20 is rejected with exit 2 (module mocks / hooks absent).
 * - Empty discovery exits 1 instead of silently passing.
 * - Worker exit code / signal is propagated unchanged.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const HERMETIC_SETUP = path.join(TOOLS_DIR, "test-hermetic-setup.mjs");

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const nodeMajorVersion = Number.parseInt(process.versions.node, 10);

if (!Number.isFinite(nodeMajorVersion) || nodeMajorVersion < 20) {
  console.error(
    `[test-hermetic] FAIL: Node.js 20+ is required to run the suite (got ${process.versions.node}). ` +
      "Use the Node 22 toolchain from .github/workflows/quality.yml.",
  );
  process.exit(2);
}

// Fail-closed gate: any attempt to set the skip variable denies the run.
// This replaces the rejected fail-open `exit 0` SKIP gate. Unset = run.
const skipRaw = process.env.VSU_SMARTMAP_SKIP_TESTS;
if (typeof skipRaw !== "undefined" && String(skipRaw).trim() !== "") {
  const reason =
    String(process.env.VSU_SMARTMAP_SKIP_REASON || "").trim() ||
    "no reason given";
  console.error(
    `[test-hermetic] FAIL: VSU_SMARTMAP_SKIP_TESTS is set (value=${JSON.stringify(skipRaw)} reason=${reason}). ` +
      "Refusing to skip: unset VSU_SMARTMAP_SKIP_TESTS (and VSU_SMARTMAP_SKIP_REASON) to run the full suite. " +
      "CI and the fleet merge-gate must never set this variable.",
  );
  process.exit(2);
}

const testFiles = (await Promise.all(TEST_ROOTS.map(collectTestFiles)))
  .flat()
  .sort();

if (testFiles.length === 0) {
  console.error("[test-hermetic] FAIL: No test files found.");
  process.exit(1);
}

// Clean-env proof + test-count log so `npm test: passed` is auditable.
console.error(
  `[test-hermetic] node=${process.versions.node} SKIP=unset files=${testFiles.length}`,
);

const child = spawn(
  process.execPath,
  [
    "--experimental-test-module-mocks",
    "--import",
    HERMETIC_SETUP,
    "--import",
    "tsx",
    "--test",
    ...testFiles.map((filePath) =>
      toNodeTestArgument(filePath, nodeMajorVersion),
    ),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

child.on("error", (error) => {
  console.error("[test-hermetic] Unable to start the test runner:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});