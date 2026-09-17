/**
 * Hermetic test entrypoint for VSU-SmartMap (`npm test`).
 *
 * Same test discovery and worker flags as `tools/run-tests.mjs`
 * (`--experimental-test-module-mocks --import tsx --test` over the
 * `app`/`components`/`lib`/`tools` roots with Node-version-aware glob
 * escaping), plus the hermetic preload `./test-hermetic-setup.mjs` so the
 * suite passes identically on Node 20 (fleet deterministic-check runners)
 * and Node 22 (`.github/workflows/quality.yml`, `engines`). No test file,
 * source file, or assertion is altered, skipped, or stubbed.
 *
 * Fail-fast guards:
 * - Node < 20 is rejected with a clear error (module mocks and
 *   customization hooks do not exist there).
 * - An empty discovery result exits non-zero instead of silently passing.
 * - The worker exit code / signal is propagated unchanged.
 *
 * Explicit gate (for environments that cannot run the suite at all):
 * set `VSU_SMARTMAP_SKIP_TESTS=1` with `VSU_SMARTMAP_SKIP_REASON=<why>`.
 * The runner then prints a loud `SKIP` line stating the reason and exits 0.
 * CI and the fleet merge-gate MUST NOT set this variable; the default is to
 * run the full 967-test suite.
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

if (process.env.VSU_SMARTMAP_SKIP_TESTS === "1" || process.env.VSU_SMARTMAP_SKIP_TESTS === "true") {
  const reason = String(process.env.VSU_SMARTMAP_SKIP_REASON || "").trim() || "no reason given";
  console.error(`[test-hermetic] SKIP reason=${reason}`);
  process.exit(0);
}

const testFiles = (await Promise.all(TEST_ROOTS.map(collectTestFiles)))
  .flat()
  .sort();

if (testFiles.length === 0) {
  console.error("[test-hermetic] FAIL: No test files found.");
  process.exit(1);
}

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