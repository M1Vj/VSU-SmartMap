import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

// Hermetic engine guard: package.json declares engines.node >= 22 because
// node:test mock.module("@/...") path-alias resolution and globalThis.navigator
// only behave correctly on Node 22+. The fleet merge-gate historically runs
// Node 20, which produced 18 deterministic failures (17 mock.module @/ alias
// ERR_MODULE_NOT_FOUND + 1 navigator TypeError). Instead of silently skipping,
// re-exec the suite on a Node >= 22 binary when one is available, else fail
// fast with a clear, actionable message.
//
// Explicit escape hatches (repository variables with clear semantics):
//   VSU_TEST_ALLOW_NODE20=1  -> run on Node 20 anyway (expected: alias/navigator
//                              failures; use only for local diagnosis).
//   VSU_TEST_NODE=<path>     -> force a specific node binary for the suite.
const REQUIRED_NODE_MAJOR = 22;

function nodeMajorOf(binary) {
  try {
    const out = execFileSync(binary, ["-p", "process.versions.node.split('.')[0]"], {
      encoding: "utf8",
      timeout: 15000,
    }).trim();
    const major = Number.parseInt(out, 10);
    return Number.isInteger(major) ? major : 0;
  } catch {
    return 0;
  }
}

function findNode22OrNewer() {
  const override = String(process.env.VSU_TEST_NODE || "").trim();
  if (override) {
    if (existsSync(override) && nodeMajorOf(override) >= REQUIRED_NODE_MAJOR) return override;
    return null;
  }
  const candidates = new Set();
  const toolcache = "/opt/hostedtoolcache/node";
  try {
    if (existsSync(toolcache)) {
      for (const entry of readdirSync(toolcache)) {
        candidates.add(path.join(toolcache, entry, "x64", "bin", "node"));
        candidates.add(path.join(toolcache, entry, "arm64", "bin", "node"));
      }
    }
  } catch {}
  for (const p of ["/usr/local/bin/node", "/opt/act/node/bin/node", "/usr/bin/node"]) {
    candidates.add(p);
  }
  try {
    const out = execFileSync("which", ["-a", "node"], { encoding: "utf8", timeout: 10000 });
    for (const line of String(out).split("\n")) {
      const trimmed = line.trim();
      if (trimmed) candidates.add(trimmed);
    }
  } catch {}
  for (const name of ["node22", "node24", "nodejs"]) {
    try {
      const out = String(execFileSync("which", [name], { encoding: "utf8", timeout: 10000 })).trim();
      if (out) candidates.add(out.split("\n")[0].trim());
    } catch {}
  }
  let best = null;
  let bestMajor = 0;
  for (const candidate of candidates) {
    if (!candidate || candidate === process.execPath) continue;
    if (!existsSync(candidate)) continue;
    const major = nodeMajorOf(candidate);
    if (major >= REQUIRED_NODE_MAJOR && major > bestMajor) {
      best = candidate;
      bestMajor = major;
    }
  }
  return best;
}

const nodeMajorVersion = Number.parseInt(process.versions.node, 10);
const allowLegacyNode = /^(1|true|yes)$/i.test(String(process.env.VSU_TEST_ALLOW_NODE20 ?? ""));

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && !allowLegacyNode) {
  const here = fileURLToPath(import.meta.url);
  // Guard against re-exec loops: the re-executed child sets this marker.
  if (process.env.VSU_TEST_REEXEC !== "1") {
    const newer = findNode22OrNewer();
    if (newer) {
      console.error(
        `[run-tests] Node ${process.version} detected (engines requires >= ${REQUIRED_NODE_MAJOR}); re-executing suite with ${newer}`,
      );
      const result = spawnSync(newer, [here, ...process.argv.slice(2)], {
        stdio: "inherit",
        env: { ...process.env, VSU_TEST_REEXEC: "1" },
      });
      if (result.signal) {
        try {
          process.kill(process.pid, result.signal);
        } catch {}
        process.exit(1);
      }
      process.exit(result.status ?? 1);
    }
  }
  console.error(
    `FATAL: Node >= ${REQUIRED_NODE_MAJOR} is required (package.json engines). ` +
      `Current: ${process.version}. ` +
      `node:test mock.module("@/...") alias resolution and globalThis.navigator ` +
      `are only correct on Node 22+ (18 failures on Node 20). ` +
      `Install Node 22+, set VSU_TEST_NODE=<node22-binary>, or explicitly opt into ` +
      `legacy mode with VSU_TEST_ALLOW_NODE20=1 for diagnosis only.`,
  );
  process.exit(1);
}

if (nodeMajorVersion < REQUIRED_NODE_MAJOR && allowLegacyNode) {
  console.error(
    `[run-tests] WARNING: running on legacy ${process.version} via explicit VSU_TEST_ALLOW_NODE20=1; ` +
      `mock.module("@/...") and navigator-dependent tests are expected to fail.`,
  );
}

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const effectiveMajor = Number.parseInt(process.versions.node, 10);

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
      toNodeTestArgument(filePath, effectiveMajor),
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