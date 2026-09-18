import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

// ---------------------------------------------------------------------------
// Hermetic Node engine guard (fail-fast, fail-closed, no re-exec).
//
// Repository engines require Node >=22 (see package.json). Node 20 cannot
// resolve mock.module("@/...") aliases: its experimental module-mocking
// resolver bypasses --import loaders (including tsx tsconfig-paths), so test
// files fail with ERR_MODULE_NOT_FOUND ("<dir>/@/lib/..."), and Node 20
// lacks globalThis.navigator, breaking the abort-path test in
// lib/pathfinding/external.test.ts. Node 22 runs the full suite green.
//
// This entrypoint therefore enforces the engine contract BEFORE collecting
// or spawning tests:
//
// - compatible runtime (current >= required): run the suite with the current
//   interpreter (process.execPath). No alternative binary is ever executed.
// - legacy runtime (current < required): fail fast with a clear engines
//   message and a non-zero exit. There is deliberately NO re-exec, NO
//   alternative-binary discovery, NO shell-out, and NO hardcoded runner
//   paths, so there is no arbitrary-binary execution surface to validate.
// - explicitly gated legacy run (VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS=1 or
//   FLEET_ALLOW_LEGACY_NODE_TESTS=1): still fail closed with a distinct
//   non-zero code (2) and a clear skip reason. This gate NEVER exits 0, so
//   a merge-gate can never report success without executing tests.
//
// Scope note: this minimal guard is co-located with the browserslist dev
// bump because `npm test` must stay hermetic on runners whose default `node`
// is still 20; without it the bump's CI signal is non-deterministic. The
// companion navigator fix in lib/pathfinding/external.test.ts is the only
// other non-lockfile change, for the same hermetic reason.
// ---------------------------------------------------------------------------

export const SKIP_VARS = [
  "VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS",
  "FLEET_ALLOW_LEGACY_NODE_TESTS",
];
export const FALLBACK_REQUIRED_MAJOR = 22;
export const ENGINE_MISMATCH_EXIT_CODE = 1;
export const GATED_LEGACY_SKIP_EXIT_CODE = 2;

export function parseRequiredMajor(range, fallback = FALLBACK_REQUIRED_MAJOR) {
  if (typeof range === "string") {
    const m = range.match(/(\d+)/);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return fallback;
}

export function readRequiredNodeMajor(pkgPath) {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "..");
    const target = pkgPath ?? path.join(repoRoot, "package.json");
    const pkg = JSON.parse(readFileSync(target, "utf8"));
    return parseRequiredMajor(pkg?.engines?.node, FALLBACK_REQUIRED_MAJOR);
  } catch {
    return FALLBACK_REQUIRED_MAJOR;
  }
}

export function getCurrentNodeMajor(version = process.versions.node) {
  const n = Number.parseInt(String(version).split(".")[0], 10);
  return Number.isFinite(n) ? n : 0;
}

export function isLegacySkipRequested(env = process.env) {
  return SKIP_VARS.some((k) => {
    const v = String(env?.[k] ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  });
}

export function evaluateNodeGuard({ requiredMajor, currentMajor, skipRequested }) {
  if (currentMajor >= requiredMajor) {
    return { ok: true, exitCode: 0, reason: "compatible runtime" };
  }
  if (skipRequested) {
    return {
      ok: false,
      exitCode: GATED_LEGACY_SKIP_EXIT_CODE,
      reason:
        `Node v${currentMajor} is below engines >=${requiredMajor} and ` +
        `${SKIP_VARS.join(" or ")} is set; failing closed with a distinct ` +
        `non-zero exit (no tests executed, no success implied). ` +
        `Re-run with Node >=${requiredMajor} for authoritative results.`,
    };
  }
  return {
    ok: false,
    exitCode: ENGINE_MISMATCH_EXIT_CODE,
    reason:
      `Node v${currentMajor} is below required engines >=${requiredMajor}. ` +
      `Failing fast without executing tests.`,
  };
}

function formatGuardMessage(requiredMajor, runningMajor, decision) {
  if (runningMajor >= requiredMajor) return "";
  const base =
    `[run-tests] Node v${process.versions.node} is below required engines ` +
    `>=${requiredMajor}. Node 20 cannot resolve mock.module("@/...") aliases ` +
    `(ERR_MODULE_NOT_FOUND) and lacks globalThis.navigator (abort-path test). `;
  if (decision.exitCode === GATED_LEGACY_SKIP_EXIT_CODE) {
    return (
      base +
      `Gated skip requested via ${SKIP_VARS.join(" or ")}; failing closed ` +
      `with exit ${GATED_LEGACY_SKIP_EXIT_CODE} (distinct non-zero, never 0) ` +
      `so CI cannot report success without verification. ` +
      `Use Node >=${requiredMajor} for authoritative results.`
    );
  }
  return (
    base +
    `Use Node >=${requiredMajor}, or set ` +
    `VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS=1 to record an explicit gated ` +
    `failure (still non-zero, never success).`
  );
}

async function runTestSuite(nodeMajorVersion) {
  const TEST_ROOTS = ["app", "components", "lib", "tools"];
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
      ...testFiles.map((filePath) => toNodeTestArgument(filePath, nodeMajorVersion)),
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
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

const IS_MAIN = (() => {
  try {
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
    return invoked === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (IS_MAIN) {
  const requiredMajor = readRequiredNodeMajor();
  const runningMajor = getCurrentNodeMajor();
  const skipRequested = isLegacySkipRequested();
  const decision = evaluateNodeGuard({ requiredMajor, currentMajor: runningMajor, skipRequested });
  if (!decision.ok) {
    console.error(formatGuardMessage(requiredMajor, runningMajor, decision));
    console.error(`[run-tests] ${decision.reason}`);
    process.exit(decision.exitCode);
  }
  await runTestSuite(runningMajor);
}