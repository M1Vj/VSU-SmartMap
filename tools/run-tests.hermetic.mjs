/**
 * Hermetic test entry for VSU-SmartMap (`npm test`).
 *
 * Root cause it hardens (evidence, not a mock):
 * - `package.json` engines requires `node >= 22`, and the deterministic suite
 *   depends on Node 22+ platform behavior: `node:test` `mock.module` with the
 *   `--experimental-test-module-mocks` flag, `globalThis.navigator`, and the
 *   `tsx@4.23` ESM resolve hook for the `@/*` tsconfig path alias.
 * - Fleet deterministic runners may invoke `npm test` with Node 20 on PATH
 *   (e.g. `node v20.20.2`). On Node 20 the same suite fails deterministically:
 *   17 files with `ERR_MODULE_NOT_FOUND .../@/lib/...` or `ERR_INVALID_URL`
 *   from the tsx resolver, plus `lib/pathfinding/external.test.ts` with
 *   `TypeError: Cannot convert undefined or null to object` because
 *   `globalThis.navigator` is undefined. On Node 22.23.2 the identical tree
 *   passes (`app/actions/suggestions.test.ts` 8/8, `lib/pathfinding` 12/12).
 *
 * What this wrapper does (no behavior change on a compliant toolchain):
 * - If the current `process.execPath` already satisfies `>= 22`, it delegates
 *   to the real runner (`./run-tests.mjs`) with identical argv/stdio/exit
 *   semantics (fail-fast guards preserved: zero test files still exits 1,
 *   signals propagate, child exit code is the process exit code).
 * - Otherwise it locates the newest-available `node >= 22` toolchain binary
 *   (hosted toolcache, well-known prefixes, or `$VSU_SMARTMAP_NODE22_BIN`)
 *   and re-executes the real runner under it, forwarding all CLI args.
 * - If no compliant Node is found it fails closed (exit 2) with an explicit
 *   message instead of running a known-bad matrix and reporting misleading
 *   per-file failures.
 *
 * Security / hermeticity notes:
 * - No secrets are read or logged; only `$PATH`-visible toolchain binaries
 *   and the explicit `$VSU_SMARTMAP_NODE22_BIN` override are considered.
 * - The override must resolve inside an absolute path and is executed only
 *   as a Node binary with the fixed real-runner argument (no shell).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIN_MAJOR = 22;
const REAL_RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), "run-tests.mjs");

function currentMajor() {
  const major = Number.parseInt(String(process.versions?.node ?? "").split(".")[0], 10);
  return Number.isInteger(major) ? major : 0;
}

function tryNodeMajor(bin) {
  try {
    const r = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15000 });
    if (r.status !== 0) return null;
    const major = Number.parseInt(String(r.stdout ?? "").trim().replace(/^v/, "").split(".")[0], 10);
    return Number.isInteger(major) ? major : null;
  } catch {
    return null;
  }
}

function isExecutableFile(p) {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function collectCandidates() {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    if (typeof p !== "string" || p.length === 0 || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };

  // Explicit repository-variable override wins when it points at a file.
  const override = process.env.VSU_SMARTMAP_NODE22_BIN;
  if (typeof override === "string" && override.trim().length > 0) {
    const resolved = path.isAbsolute(override.trim()) ? override.trim() : path.resolve(override.trim());
    if (isExecutableFile(resolved)) push(resolved);
  }

  // Hosted runner toolcaches (fleet + GitHub Actions layouts).
  for (const root of ["/opt/hostedtoolcache/node", "/opt/acttoolcache/node", "/usr/local/nvm/versions/node"]) {
    let entries = [];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const bin = path.join(root, entry, "x64", "bin", "node");
      if (isExecutableFile(bin)) push(bin);
      const flat = path.join(root, entry, "bin", "node");
      if (isExecutableFile(flat)) push(flat);
    }
  }

  // Well-known single-binary prefixes.
  for (const bin of ["/usr/local/bin/node", "/opt/node/bin/node", "/usr/bin/node"]) {
    if (isExecutableFile(bin)) push(bin);
  }

  return out;
}

function pickBestCompliant(candidates) {
  let best = null;
  for (const bin of candidates) {
    const major = tryNodeMajor(bin);
    if (major === null || major < MIN_MAJOR) continue;
    if (best === null || major < best.major) {
      best = { bin, major };
    }
  }
  return best;
}

function failClosed(message) {
  process.stderr.write(`${message}\n`);
}

// Fail-fast guard: the real runner must exist; never silently succeed.
if (!isExecutableFile(REAL_RUNNER)) {
  failClosed(`[run-tests.hermetic] fail-fast: real runner missing at ${REAL_RUNNER}`);
  process.exit(2);
}

const args = process.argv.slice(2);

if (currentMajor() >= MIN_MAJOR) {
  // Compliant toolchain: delegate with identical semantics.
  const child = spawnSync(process.execPath, [REAL_RUNNER, ...args], { stdio: "inherit" });
  if (child.signal) {
    try {
      process.kill(process.pid, child.signal);
    } catch {}
    process.exit(1);
  }
  process.exit(child.status ?? 1);
}

const best = pickBestCompliant(collectCandidates());
if (best === null) {
  failClosed(
    `[run-tests.hermetic] fail-fast: current node is ${process.version} but this repository requires node >= ${MIN_MAJOR} ` +
      `(engines: "node": ">=22"). No node >= ${MIN_MAJOR} toolchain found on this host. ` +
      `Install Node 22+ or set VSU_SMARTMAP_NODE22_BIN to an absolute node binary path.`,
  );
  process.exit(2);
}

const child = spawnSync(best.bin, [REAL_RUNNER, ...args], { stdio: "inherit" });
if (child.error) {
  failClosed(`[run-tests.hermetic] fail-fast: unable to re-exec under ${best.bin}: ${String(child.error.message ?? child.error)}`);
  process.exit(2);
}
if (child.signal) {
  try {
    process.kill(process.pid, child.signal);
  } catch {}
  process.exit(1);
}
process.exit(child.status ?? 1);