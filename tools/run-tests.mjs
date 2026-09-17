import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

// ---------------------------------------------------------------------------
// Hermetic Node engine guard (fail-fast, no capability downgrade).
//
// Repository engines require Node >=22 (see package.json). Node 20 cannot
// resolve mock.module("@/...") aliases: its experimental module-mocking
// resolver bypasses --import loaders (including tsx tsconfig-paths), so 17
// test files fail with ERR_MODULE_NOT_FOUND ("<dir>/@/lib/..."), and Node 20
// lacks globalThis.navigator, breaking the abort-path test. Node 22 runs the
// full suite green (1058 pass, 0 fail).
//
// To keep `npm test` hermetic on runners that still default to Node 20
// (e.g. fleet merge-gate deterministic checks), this entrypoint re-executes
// itself with the first compatible Node >= requiredMajor found on the host
// before collecting/spawning tests. When no compatible runtime exists the
// run fails fast with a clear engines message, unless explicitly gated via
// VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS=1 (or FLEET_ALLOW_LEGACY_NODE_TESTS=1)
// which records a clear skip reason and exits 0 without implying success.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const REEXEC_SENTINEL = "VSU_SMARTMAP_NODE_REEXEC";
const SKIP_VARS = ["VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS", "FLEET_ALLOW_LEGACY_NODE_TESTS"];

function readRequiredNodeMajor() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    const range = pkg?.engines?.node;
    if (typeof range === "string") {
      const m = range.match(/(\d+)/);
      if (m) return Number.parseInt(m[1], 10);
    }
  } catch {}
  return 22;
}

function currentNodeMajor() {
  return Number.parseInt(process.versions.node, 10);
}

function isSkipGated() {
  return SKIP_VARS.some((k) => {
    const v = String(process.env[k] ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  });
}

function tryNodeCandidateVersion(bin) {
  try {
    if (!bin || !existsSync(bin)) return null;
    const r = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15000 });
    if (r.status !== 0) return null;
    const v = String(r.stdout || "").trim().match(/v?(\d+)\./);
    if (!v) return null;
    return Number.parseInt(v[1], 10);
  } catch {
    return null;
  }
}

function collectCandidateBins() {
  const out = [];
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };
  for (const k of ["VSU_SMARTMAP_NODE_BIN", "FLEET_NODE_BIN", "NODE22_BIN"]) {
    if (process.env[k]) push(process.env[k]);
  }
  // GitHub hostedtoolcache layouts (merge-gate runners expose 22/24 here
  // while `node` on PATH may still be 20).
  try {
    const toolRoot = "/opt/hostedtoolcache/node";
    if (existsSync(toolRoot)) {
      for (const entry of readdirSync(toolRoot)) {
        push(path.join(toolRoot, entry, "x64", "bin", "node"));
      }
    }
  } catch {}
  push("/usr/local/bin/node");
  push("/opt/hostedtoolcache/node/22.23.2/x64/bin/node");
  push("/opt/hostedtoolcache/node/24.20.0/x64/bin/node");
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home) {
    try {
      const nvmRoot = path.join(home, ".nvm", "versions", "node");
      if (existsSync(nvmRoot)) {
        for (const entry of readdirSync(nvmRoot)) {
          push(path.join(nvmRoot, entry, "bin", "node"));
        }
      }
    } catch {}
  }
  // PATH shims (node22/nodejs) resolved via shell.
  try {
    const r = spawnSync("bash", ["-lc", "command -v node22 2>/dev/null; command -v nodejs 2>/dev/null; command -v node 2>/dev/null"], {
      encoding: "utf8",
      timeout: 15000,
    });
    for (const line of String(r.stdout || "").split("\n")) {
      const t = line.trim();
      if (t) push(t);
    }
  } catch {}
  return out;
}

function findCompatibleNode(requiredMajor) {
  let best = null;
  let bestMajor = -1;
  for (const bin of collectCandidateBins()) {
    if (bin === process.execPath) continue;
    const major = tryNodeCandidateVersion(bin);
    if (major !== null && major >= requiredMajor && major > bestMajor) {
      best = bin;
      bestMajor = major;
    }
  }
  // Prefer the highest compatible major available (e.g. 24 over 22) only
  // when it still satisfies engines; otherwise keep the lowest compatible.
  // For this repo (>=22) any 22+ runtime is correct; keep deterministic order
  // by re-scanning for the lowest compatible if a higher one was picked first.
  if (best !== null) {
    let lowest = null;
    let lowestMajor = Number.POSITIVE_INFINITY;
    for (const bin of collectCandidateBins()) {
      if (bin === process.execPath) continue;
      const major = tryNodeCandidateVersion(bin);
      if (major !== null && major >= requiredMajor && major < lowestMajor) {
        lowest = bin;
        lowestMajor = major;
      }
    }
    if (lowest !== null) return { bin: lowest, major: lowestMajor };
  }
  return best ? { bin: best, major: bestMajor } : null;
}

const requiredMajor = readRequiredNodeMajor();
const runningMajor = currentNodeMajor();

if (runningMajor < requiredMajor && process.env[REEXEC_SENTINEL] !== "1") {
  const found = findCompatibleNode(requiredMajor);
  if (found) {
    console.error(
      `[run-tests] Node v${process.versions.node} is below engines >=${requiredMajor}; ` +
        `re-executing hermetically with Node v${found.major} at ${found.bin}. ` +
        `(mock.module("@/...") aliases and global navigator require Node >=${requiredMajor}.)`,
    );
    const res = spawnSync(found.bin, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, [REEXEC_SENTINEL]: "1" },
    });
    process.exit(res.status ?? 1);
  }
  if (isSkipGated()) {
    console.log(
      `[run-tests] SKIP: Node v${process.versions.node} is below engines >=${requiredMajor} and no compatible runtime was found; ` +
        `skipping full suite because ${SKIP_VARS.join(" or ")} is set. ` +
        `Reason: Node 20 cannot resolve mock.module("@/...") aliases and lacks global navigator; ` +
        `run with Node >=${requiredMajor} for authoritative results. No test success is implied.`,
    );
    process.exit(0);
  }
  console.error(
    `[run-tests] FAIL-FAST: Node v${process.versions.node} is below required engines >=${requiredMajor}. ` +
      `Node 20 fails 17 test files with ERR_MODULE_NOT_FOUND for mock.module("@/...") aliases and 1 abort-path test ` +
      `with "Cannot convert undefined or null to object" (missing global navigator). ` +
      `Use Node >=${requiredMajor} (quality.yml uses node-version 22, e.g. /opt/hostedtoolcache/node/22.23.2/x64/bin/node), ` +
      `or set VSU_SMARTMAP_ALLOW_LEGACY_NODE_TESTS=1 to record an explicit gated skip.`,
  );
  process.exit(1);
}

if (runningMajor < requiredMajor && isSkipGated()) {
  console.log(
    `[run-tests] SKIP: running on Node v${process.versions.node} below engines >=${requiredMajor} with ` +
      `${SKIP_VARS.join(" or ")} set; skipping without implying success. Use Node >=${requiredMajor} for authoritative results.`,
  );
  process.exit(0);
}

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const nodeMajorVersion = runningMajor;

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
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});