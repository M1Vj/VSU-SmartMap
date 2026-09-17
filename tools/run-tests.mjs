import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

// VSU-SmartMap requires Node.js >= 22 (see package.json engines). The
// mock.module("@/...") alias suite and the navigator-aware routing tests rely
// on Node 22 module-mocking + navigator semantics; on Node 20 the same suite
// fails with ERR_MODULE_NOT_FOUND for every "@/..." mock (17 files) plus a
// navigator TypeError. Enforce the required runtime hermetically.
const REQUIRED_NODE_MAJOR = 22;

function nodeMajorOf(binary) {
  try {
    const out = spawnSync(binary, ["-e", "console.log(process.versions.node)"], {
      encoding: "utf8",
      timeout: 15000,
    });
    if (out.status !== 0) return 0;
    return Number.parseInt(String(out.stdout || "").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function candidateNodeBinaries() {
  const candidates = [];
  const explicit = String(process.env.VSU_SMARTMAP_NODE_BIN || "").trim();
  if (explicit) candidates.push(explicit);
  // GitHub Actions hosted toolcache (ubuntu-latest) keeps every installed
  // major under /opt/hostedtoolcache/node/<version>/x64/bin/node even when
  // setup-node selects Node 20 on PATH. Prefer an exact Node 22 runtime to
  // match .github/workflows/quality.yml (node-version: 22).
  try {
    const toolcache = "/opt/hostedtoolcache/node";
    if (existsSync(toolcache)) {
      const versions = readdirSync(toolcache).filter((v) => /^\d+\./.test(v));
      const sorted = versions.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
      // Prefer 22.x first, then any other >= 22 (e.g. 24.x).
      const preferred = [
        ...sorted.filter((v) => v.startsWith("22.")),
        ...sorted.filter((v) => !v.startsWith("22.")),
      ];
      for (const v of preferred) {
        candidates.push(path.join(toolcache, v, "x64", "bin", "node"));
      }
    }
  } catch {}
  for (const name of ["node22", "nodejs22", "node"]) {
    candidates.push(name);
  }
  return [...new Set(candidates)];
}

function findSuitableNode(currentMajor) {
  if (currentMajor >= REQUIRED_NODE_MAJOR) return null;
  for (const bin of candidateNodeBinaries()) {
    try {
      // Avoid re-selecting the current (too-old) runtime when the candidate
      // is a bare PATH lookup that resolves to it.
      const major = nodeMajorOf(bin);
      if (major >= REQUIRED_NODE_MAJOR) {
        // Resolve bare names to absolute paths for a stable re-exec.
        if (!bin.includes(path.sep)) {
          const lookup = spawnSync("sh", ["-lc", `command -v ${bin}`], {
            encoding: "utf8",
            timeout: 10000,
          });
          const resolved = String(lookup.stdout || "").trim().split("\n")[0]?.trim();
          if (resolved && existsSync(resolved)) {
            if (nodeMajorOf(resolved) >= REQUIRED_NODE_MAJOR) return resolved;
            continue;
          }
          // Bare name resolved via PATH but we could not stat it; still
          // usable if its version probe passed.
          return bin;
        }
        if (existsSync(bin)) return bin;
        return bin;
      }
    } catch {}
  }
  return null;
}

const nodeMajorVersion = Number.parseInt(process.versions.node, 10);
const allowLegacy =
  String(process.env.VSU_SMARTMAP_ALLOW_LEGACY_NODE || "").trim() === "1";
const alreadyReran = String(process.env.VSU_SMARTMAP_TEST_RERAN || "").trim() === "1";

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && !allowLegacy && !alreadyReran) {
  const suitable = findSuitableNode(nodeMajorVersion);
  if (suitable) {
    console.error(
      `[run-tests] current Node v${process.versions.node} < required >=${REQUIRED_NODE_MAJOR}; re-executing with ${suitable}`,
    );
    const child = spawn(
      suitable,
      [process.argv[1], ...process.argv.slice(2)],
      {
        stdio: "inherit",
        env: { ...process.env, VSU_SMARTMAP_TEST_RERAN: "1" },
      },
    );
    child.on("error", (error) => {
      console.error("Unable to re-execute the test runner:", error);
      process.exit(1);
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });
    // Suspend the current (too-old) runner; the re-executed child owns the run.
    await new Promise(() => {});
  } else {
    console.error(
      `[run-tests] FAIL-FAST: Node.js >=${REQUIRED_NODE_MAJOR} is required (package.json engines), got v${process.versions.node}. ` +
        `The mock.module("@/...") suite cannot resolve path aliases on Node 20. ` +
        `Run with Node 22+ (matches .github/workflows/quality.yml) or set VSU_SMARTMAP_NODE_BIN to a Node >=${REQUIRED_NODE_MAJOR} binary. ` +
        `To force a legacy run anyway (expected mock failures), set VSU_SMARTMAP_ALLOW_LEGACY_NODE=1 with a clear skip reason.`,
    );
    process.exit(1);
  }
}

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && allowLegacy) {
  console.error(
    `[run-tests] WARNING: running on legacy Node v${process.versions.node} via VSU_SMARTMAP_ALLOW_LEGACY_NODE=1; ` +
      `mock.module("@/...") tests are expected to fail with ERR_MODULE_NOT_FOUND. Prefer Node >=${REQUIRED_NODE_MAJOR}.`,
  );
}

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const effectiveNodeMajor = Number.parseInt(process.versions.node, 10);

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
      toNodeTestArgument(filePath, effectiveNodeMajor),
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
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});