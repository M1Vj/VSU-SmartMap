import { spawn } from "node:child_process";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

const TEST_ROOTS = ["app", "components", "lib", "tools"];

// Hermetic engine guard (atomic, no re-exec).
//
// package.json declares engines.node >= 22 because node:test
// mock.module("@/...") path-alias resolution and globalThis.navigator only
// behave correctly on Node 22+. The fleet merge-gate historically ran Node 20,
// which produced deterministic alias/navigator failures.
//
// This guard is intentionally hermetic: it inspects only
// process.versions.node / process.version and the explicit repository
// variable below. It performs no filesystem scans, no PATH/`which` probing,
// no discovery or execution of alternate node binaries, and no auto re-exec
// via spawnSync/execFileSync.
//
// Threat model: executing an attacker-influenceable binary (VSU_TEST_NODE,
// toolcache enumeration, or PATH/`which` output) would turn this test helper
// into an arbitrary-code-execution primitive and a CI supply-chain risk.
// Candidate enumeration that stats/execs every node binary found is
// therefore rejected. Automatic Node >= 22 re-exec is deferred to a separate
// PR with design review, an allowlist with path validation, CI-variable
// provenance, and dedicated unit tests for version parsing, discovery, the
// re-exec loop guard, and every env branch. This PR keeps the dependabot
// security bump atomic.
//
// Explicit gate (repository variable with a clear skip reason):
//   VSU_TEST_ALLOW_NODE20=1 -> run on Node 20 anyway for local diagnosis
//   only (expected: alias/navigator failures). CI must NOT set it. The
//   bypass is logged loudly to stderr for audit. Every other value
//   (including unset) keeps fail-fast behavior.
const REQUIRED_NODE_MAJOR = 22;

function getNodeMajorVersion() {
  const raw = String(process.versions.node ?? "").split(".")[0] ?? "";
  const major = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(major) || major <= 0) {
    console.error(
      `[run-tests] Unable to parse Node major version from ${JSON.stringify(
        process.versions.node,
      )}; refusing to run (requires Node >= ${REQUIRED_NODE_MAJOR}).`,
    );
    process.exit(1);
  }
  return major;
}

const nodeMajorVersion = getNodeMajorVersion();
const allowLegacyNode = /^(1|true|yes)$/i.test(
  String(process.env.VSU_TEST_ALLOW_NODE20 ?? "").trim(),
);

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && !allowLegacyNode) {
  console.error(
    `[run-tests] Node ${process.version} detected; this suite requires Node >= ${REQUIRED_NODE_MAJOR} (see package.json engines). ` +
      `Re-run with Node 22+ (Requirement: Node.js 22+, npm 10+). ` +
      `For local diagnosis only you may set VSU_TEST_ALLOW_NODE20=1 to run anyway (expected: mock.module "@/..." alias and navigator failures). ` +
      `CI must not set VSU_TEST_ALLOW_NODE20. ` +
      `Automatic Node >= 22 re-exec is intentionally not implemented here; it requires a separate PR with design review.`,
  );
  process.exit(1);
}

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && allowLegacyNode) {
  console.error(
    `[run-tests] WARNING: VSU_TEST_ALLOW_NODE20=${JSON.stringify(
      process.env.VSU_TEST_ALLOW_NODE20,
    )} bypasses the Node >= ${REQUIRED_NODE_MAJOR} gate on ${process.version}. ` +
      `Results are not hermetic (mock.module alias + navigator failures expected). Use only for local diagnosis; do not set in CI.`,
  );
}

const testFiles = (await Promise.all(TEST_ROOTS.map(collectTestFiles)))
  .flat()
  .sort();

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    "--experimental-test-module-mocks",
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
  console.error("Unable to start the test runner:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    try {
      process.kill(process.pid, signal);
    } catch (error) {
      console.error(
        `[run-tests] Failed to forward signal ${String(signal)}:`,
        error,
      );
      process.exit(1);
    }
    return;
  }

  process.exit(code ?? 1);
});