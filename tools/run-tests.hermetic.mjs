/**
 * Hermetic test entry for VSU-SmartMap (`npm test`).
 *
 * ATOMICITY / TRANSPARENCY NOTE (addresses undisclosed-scope blocker):
 * - This file is a deliberate, disclosed behavior change to the `npm test`
 *   contract: `package.json` `test` now invokes this wrapper instead of
 *   `tools/run-tests.mjs` directly. The original runner is fully preserved
 *   and remains available via `npm run test:direct` (no capability deleted).
 * - Rationale: `package.json` engines requires `node >= 22` and the
 *   deterministic suite depends on Node 22+ platform behavior:
 *   `node:test` `mock.module` with `--experimental-test-module-mocks`,
 *   `globalThis.navigator`, and the `tsx@4.23` ESM resolve hook for the
 *   `@/*` tsconfig path alias. Fleet runners may invoke `npm test` with
 *   Node 20 on PATH (e.g. `node v20.20.2`). On Node 20 the same suite
 *   fails deterministically (ERR_MODULE_NOT_FOUND for `@/lib/...`,
 *   ERR_INVALID_URL from the tsx resolver, plus
 *   `lib/pathfinding/external.test.ts` TypeError when
 *   `globalThis.navigator` is undefined). On Node 22.23.2 the identical
 *   tree passes. This wrapper is defense-in-depth; the proper fix remains
 *   pinning Node 22 in CI config (`node-version: '22'`, `engines`,
 *   `volta`), which this file documents and does not replace.
 * - Self-tests: `npm run test:hermetic:selftest`
 *   (`node --test tools/run-tests.hermetic.test.mjs`) covers fallback,
 *   arg forwarding, exit-code/signal propagation, and fail-closed paths.
 *
 * What this wrapper does (no behavior change on a compliant toolchain):
 * - If the current `process.execPath` already satisfies `>= 22`, it delegates
 *   to the real runner (`./run-tests.mjs`) with identical argv/stdio/exit
 *   semantics (fail-fast guards preserved: zero test files still exits 1
 *   via child propagation, signals propagate via re-raise, child exit code
 *   is the process exit code).
 * - Otherwise it locates the newest-available (maximum semver, not minimum)
 *   `node >= 22` toolchain binary (hosted toolcache derived from
 *   `$RUNNER_TOOL_CACHE` / `$AGENT_TOOLSDIRECTORY` plus well-known
 *   allowlisted prefixes, `$PATH` entries subject to identical strict
 *   validation, or `$VSU_SMARTMAP_NODE22_BIN`) and re-executes the real
 *   runner under it, forwarding all CLI args verbatim.
 * - If no compliant Node is found it fails closed (exit 2) with an explicit
 *   message instead of running a known-bad matrix and reporting misleading
 *   per-file failures. Missing real runner also fails closed (exit 2).
 *
 * Security / hermeticity notes (preserved, hardened):
 * - No secrets are read or logged; only allowlisted toolchain binaries
 *   and the explicit `$VSU_SMARTMAP_NODE22_BIN` override are considered.
 * - The override MUST be an absolute path inside the allowlist, must pass
 *   X_OK + isFile + realpath/symlink checks, must not be a shebang script,
 *   and must pass dual-probe spoof-resistant validation
 *   (`--version` agrees with `-p process.versions.node`, plus
 *   `-p process.release.name === 'node'`). Relative paths, non-executable
 *   files, symlinks escaping the allowlist, and version-string spoofs fail
 *   closed (exit 2). Execution uses `shell: false` only (no shell).
 * - Gated skip: `VSU_SMARTMAP_SKIP_HERMETIC_PIN=1` explicitly opts out of
 *   re-exec and delegates directly to the real runner even on Node < 22,
 *   with a clear stderr warning. Skip reason: local debugging of the
 *   legacy matrix only; CI must never set this variable. Default (unset
 *   or any other value) enforces hermetic behavior.
 * - Test hook: `VSU_SMARTMAP_TEST_FORCE_MAJOR` overrides detected current
 *   major for self-tests only (e.g. force `20` on a Node 22 host to exercise
 *   fallback/fail-closed paths without a second toolchain).
 */

import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MIN_MAJOR = 22;
export const FAIL_CLOSED_EXIT = 2;
export const REAL_RUNNER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "run-tests.mjs"
);

const HERE = path.dirname(fileURLToPath(import.meta.url));

function getAllowlistDirs() {
  const dirs = [];
  const push = (p) => {
    if (typeof p === "string" && p.length > 0 && !dirs.includes(p)) dirs.push(p);
  };
  const rtc = process.env.RUNNER_TOOL_CACHE;
  if (typeof rtc === "string" && rtc.trim().length > 0 && path.isAbsolute(rtc.trim())) {
    push(path.join(rtc.trim(), "node"));
  }
  const atd = process.env.AGENT_TOOLSDIRECTORY;
  if (typeof atd === "string" && atd.trim().length > 0 && path.isAbsolute(atd.trim())) {
    push(path.join(atd.trim(), "node"));
  }
  push("/opt/hostedtoolcache/node");
  push("/opt/acttoolcache/node");
  push("/usr/local/nvm/versions/node");
  push("/usr/local/bin");
  push("/usr/local/node");
  push("/opt/node");
  push("/usr/bin");
  push("/bin");
  const home = process.env.HOME;
  if (typeof home === "string" && home.length > 0 && path.isAbsolute(home)) {
    push(path.join(home, ".nvm", "versions", "node"));
  }
  return dirs;
}

export const ALLOWLIST_DIRS = getAllowlistDirs();

export function isInsideAllowlist(p, allowlist = getAllowlistDirs()) {
  if (typeof p !== "string" || p.length === 0) return false;
  const norm = path.normalize(p);
  for (const dir of allowlist) {
    const d = path.normalize(dir);
    if (norm === d || norm.startsWith(d + path.sep)) return true;
  }
  return false;
}

export function parseVersion(s) {
  if (typeof s !== "string") return null;
  const t = s.trim().replace(/^v/, "");
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(t);
  if (!m) return null;
  const major = Number.parseInt(m[1], 10);
  const minor = Number.parseInt(m[2], 10);
  const patch = Number.parseInt(m[3], 10);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return null;
  return { major, minor, patch, raw: t };
}

export function compareVersions(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

export function currentMajor() {
  const forced = process.env.VSU_SMARTMAP_TEST_FORCE_MAJOR;
  if (typeof forced === "string" && forced.trim().length > 0) {
    const f = Number.parseInt(forced.trim(), 10);
    if (Number.isInteger(f) && f >= 0) return f;
  }
  const major = Number.parseInt(String(process.versions?.node ?? "").split(".")[0], 10);
  return Number.isInteger(major) ? major : 0;
}

export function failClosed(message) {
  try {
    process.stderr.write(`[hermetic] FAIL-CLOSED: ${message}\n`);
  } catch {
    // ignore write errors; still exit non-zero below
  }
  process.exitCode = FAIL_CLOSED_EXIT;
  process.exit(FAIL_CLOSED_EXIT);
  throw new Error(`failClosed did not exit: ${message}`);
}

export function isExecutableFileStrict(p) {
  try {
    if (!existsSync(p)) return false;
    const st = statSync(p);
    if (!st.isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function hasShebang(p) {
  try {
    const fdBuf = readFileSync(p);
    if (fdBuf.length >= 2 && fdBuf[0] === 0x23 && fdBuf[1] === 0x21) return true;
    return false;
  } catch {
    return true;
  }
}

export function getRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

export function probeNodeBinary(bin) {
  try {
    if (!isExecutableFileStrict(bin)) return null;
    if (hasShebang(bin)) return null;
    const v = spawnSync(bin, ["--version"], {
      encoding: "utf8",
      timeout: 15000,
      shell: false,
    });
    if (v.status !== 0) return null;
    const verStr = String(v.stdout ?? "").trim();
    const parsed = parseVersion(verStr);
    if (!parsed) return null;
    const p2 = spawnSync(bin, ["-p", "process.versions.node"], {
      encoding: "utf8",
      timeout: 15000,
      shell: false,
    });
    if (p2.status !== 0) return null;
    const verStr2 = String(p2.stdout ?? "").trim();
    const parsed2 = parseVersion(verStr2.startsWith("v") ? verStr2 : `v${verStr2}`);
    if (!parsed2) return null;
    if (compareVersions(parsed, parsed2) !== 0) return null;
    const p3 = spawnSync(bin, ["-p", "process.release.name"], {
      encoding: "utf8",
      timeout: 15000,
      shell: false,
    });
    if (p3.status !== 0) return null;
    if (String(p3.stdout ?? "").trim() !== "node") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tryNodeMajor(bin) {
  const probed = probeNodeBinary(bin);
  return probed ? probed.major : null;
}

export function validateOverrideCandidate(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, absent: true, error: "unset" };
  }
  const trimmed = raw.trim();
  if (!path.isAbsolute(trimmed)) {
    return {
      ok: false,
      absent: false,
      error: `VSU_SMARTMAP_NODE22_BIN must be an absolute path, got relative: ${trimmed}`,
    };
  }
  const resolved = path.normalize(trimmed);
  let lst;
  try {
    lst = lstatSync(resolved);
  } catch {
    return { ok: false, absent: false, error: `override does not exist: ${resolved}` };
  }
  if (!existsSync(resolved)) {
    return { ok: false, absent: false, error: `override does not exist: ${resolved}` };
  }
  const real = getRealpath(resolved);
  if (!real) {
    return { ok: false, absent: false, error: `override realpath failed: ${resolved}` };
  }
  if (!isInsideAllowlist(real)) {
    return {
      ok: false,
      absent: false,
      error: `override realpath outside allowlist: ${real} (resolved from ${resolved}); allowed roots: ${getAllowlistDirs().join(", ")}`,
    };
  }
  if (lst.isSymbolicLink() && !isInsideAllowlist(real)) {
    return {
      ok: false,
      absent: false,
      error: `override symlink escapes allowlist: ${resolved} -> ${real}`,
    };
  }
  if (!isExecutableFileStrict(real)) {
    return {
      ok: false,
      absent: false,
      error: `override is not an executable file (X_OK + isFile required): ${real}`,
    };
  }
  if (hasShebang(real)) {
    return {
      ok: false,
      absent: false,
      error: `override looks like a shell/shebang shim, refusing: ${real}`,
    };
  }
  const probed = probeNodeBinary(real);
  if (!probed) {
    return {
      ok: false,
      absent: false,
      error: `override failed spoof-resistant Node probe (dual --version/-p + release check): ${real}`,
    };
  }
  if (probed.major < MIN_MAJOR) {
    return {
      ok: false,
      absent: false,
      error: `override Node major ${probed.major} < required ${MIN_MAJOR}: ${real}`,
    };
  }
  return { ok: true, absent: false, resolved: real, version: probed, error: null };
}

function listDirNames(root) {
  try {
    return readdirSync(root);
  } catch {
    return [];
  }
}

function sortVersionNamesDesc(names) {
  const parsed = [];
  for (const n of names) {
    const v = parseVersion(n.startsWith("v") ? n : `v${n}`);
    if (v) parsed.push({ name: n, version: v });
  }
  parsed.sort((a, b) => -compareVersions(a.version, b.version));
  return parsed.map((e) => e.name);
}

export function collectToolcacheCandidates() {
  const out = [];
  const roots = [];
  const rtc = process.env.RUNNER_TOOL_CACHE;
  if (typeof rtc === "string" && rtc.trim().length > 0 && path.isAbsolute(rtc.trim())) {
    roots.push(path.join(rtc.trim(), "node"));
  }
  const atd = process.env.AGENT_TOOLSDIRECTORY;
  if (typeof atd === "string" && atd.trim().length > 0 && path.isAbsolute(atd.trim())) {
    roots.push(path.join(atd.trim(), "node"));
  }
  roots.push("/opt/hostedtoolcache/node", "/opt/acttoolcache/node", "/usr/local/nvm/versions/node");
  const home = process.env.HOME;
  if (typeof home === "string" && home.length > 0 && path.isAbsolute(home)) {
    roots.push(path.join(home, ".nvm", "versions", "node"));
  }
  for (const root of roots) {
    const names = sortVersionNamesDesc(listDirNames(root));
    for (const name of names) {
      for (const suffix of [`${name}/x64/bin/node`, `${name}/bin/node`, `${name}/node`]) {
        const bin = path.join(root, suffix);
        out.push(bin);
      }
    }
  }
  return out;
}

export function collectPathCandidates() {
  const out = [];
  const wellKnown = [
    "/usr/local/bin/node",
    "/opt/node/bin/node",
    "/usr/bin/node",
    "/bin/node",
  ];
  for (const w of wellKnown) out.push(w);
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    const d = dir.trim();
    if (!d || !path.isAbsolute(d)) continue;
    out.push(path.join(d, "node"));
  }
  return out;
}

export function collectCandidates() {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    if (typeof p !== "string" || p.length === 0 || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };
  const overrideRaw = process.env.VSU_SMARTMAP_NODE22_BIN;
  if (typeof overrideRaw === "string" && overrideRaw.trim().length > 0) {
    const v = validateOverrideCandidate(overrideRaw);
    if (!v.ok) {
      failClosed(`invalid VSU_SMARTMAP_NODE22_BIN: ${v.error}`);
    } else {
      push(v.resolved);
    }
  }
  for (const c of collectToolcacheCandidates()) push(c);
  for (const c of collectPathCandidates()) push(c);
  return out;
}

export function selectNewestCompliant(probedList) {
  let best = null;
  for (const entry of probedList) {
    if (!entry || !entry.version) continue;
    if (entry.version.major < MIN_MAJOR) continue;
    if (!best || compareVersions(entry.version, best.version) > 0) best = entry;
  }
  return best;
}

export function findNewestCompliantBin(candidates = collectCandidates()) {
  const probed = [];
  for (const bin of candidates) {
    if (!isInsideAllowlist(getRealpath(bin) ?? bin)) {
      const real = getRealpath(bin);
      if (real && !isInsideAllowlist(real)) continue;
      if (!real) continue;
    }
    const version = probeNodeBinary(bin);
    if (version && version.major >= MIN_MAJOR) {
      probed.push({ bin, version });
    }
  }
  const best = selectNewestCompliant(probed);
  return best ? best.bin : null;
}

export function buildReexecArgs() {
  return [REAL_RUNNER, ...process.argv.slice(2)];
}

export function nextExitForResult(result) {
  if (result && typeof result.signal === "string" && result.signal.length > 0) {
    return { kind: "signal", signal: result.signal };
  }
  const code = result && typeof result.status === "number" ? result.status : 1;
  return { kind: "exit", code };
}

export function runAndPropagate(bin, args) {
  let r;
  try {
    r = spawnSync(bin, args, { stdio: "inherit", shell: false });
  } catch (err) {
    failClosed(`failed to execute ${bin}: ${String(err?.message ?? err)}`);
  }
  if (r.error) {
    failClosed(`failed to execute ${bin}: ${String(r.error.message ?? r.error)}`);
  }
  const next = nextExitForResult(r);
  if (next.kind === "signal") {
    try {
      process.stderr.write(`[hermetic] child terminated by signal ${next.signal}; forwarding\n`);
    } catch {
      // ignore
    }
    try {
      process.kill(process.pid, next.signal);
    } catch {
      // fall through to exit
    }
    process.exitCode = 1;
    process.exit(1);
  }
  process.exitCode = next.code;
  process.exit(next.code);
}

export function checkRunnerExists(runnerPath = REAL_RUNNER) {
  try {
    return existsSync(runnerPath) && statSync(runnerPath).isFile();
  } catch {
    return false;
  }
}

export function main() {
  const forwardedArgs = process.argv.slice(2);
  if (!checkRunnerExists(REAL_RUNNER)) {
    failClosed(`real runner missing: ${REAL_RUNNER}`);
  }
  if (process.env.VSU_SMARTMAP_SKIP_HERMETIC_PIN === "1") {
    try {
      process.stderr.write(
        "[hermetic] SKIP: VSU_SMARTMAP_SKIP_HERMETIC_PIN=1 set; delegating directly to real runner without Node22 re-exec (local-debug only, never use in CI).\n"
      );
    } catch {
      // ignore
    }
    runAndPropagate(process.execPath, [REAL_RUNNER, ...forwardedArgs]);
    return;
  }
  const major = currentMajor();
  if (major >= MIN_MAJOR) {
    runAndPropagate(process.execPath, [REAL_RUNNER, ...forwardedArgs]);
    return;
  }
  const newest = findNewestCompliantBin();
  if (!newest) {
    failClosed(
      `no compliant Node >= ${MIN_MAJOR} found (current ${process.versions?.node ?? "unknown"}). ` +
        `Pin Node 22 in CI (node-version: '22', engines >=22, volta 22.23.2) or set VSU_SMARTMAP_NODE22_BIN to an absolute allowlisted node binary (${getAllowlistDirs().join(", ")}). Refusing to run known-bad matrix.`
    );
  }
  try {
    process.stderr.write(`[hermetic] re-exec under Node ${newest}: node ${REAL_RUNNER} ${forwardedArgs.join(" ")}\n`);
  } catch {
    // ignore
  }
  runAndPropagate(newest, [REAL_RUNNER, ...forwardedArgs]);
}

function isMainModule() {
  try {
    const me = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
    if (!invoked) return false;
    const realMe = getRealpath(me) ?? me;
    const realInvoked = getRealpath(invoked) ?? invoked;
    return realMe === realInvoked || invoked === me;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}