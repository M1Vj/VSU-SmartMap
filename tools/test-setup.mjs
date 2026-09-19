// tools/test-setup.mjs
//
// Hermetic test preload for `npm test` (see tools/run-tests.mjs header for scope split).
//
// Repository engines requires Node >= 22, but the deterministic merge gate may execute
// `npm test` on Node 20. Two gaps break the suite on Node 20 while Node 22 passes:
//  1. `mock.module("@/...")` bypasses the tsx tsconfig-paths resolver on Node 20
//     (static `import "@/..."` works on both via tsx). Node 22 routes mock specifiers
//     through the customization hooks.
//  2. `globalThis.navigator` does not exist on Node 20 (Node 22 provides it), so tests
//     that stub `navigator.onLine` throw "Cannot convert undefined or null to object".
//
// Design invariants (audit response):
// - tsconfig-aware, NOT cwd-dependent: `@/` is resolved from tsconfig.json
//   `compilerOptions.paths` + `baseUrl` anchored at this file's repo root. No
//   `process.cwd()` is used anywhere in this file.
// - Allowlisted interception only: "@/", "./", "../". All other specifiers
//   (node:, file:, data:, bare packages) pass through untouched.
// - Fail-fast, never silent: stack-parse failure, unresolvable specifier, or missing
//   caller for a relative specifier throws an explicit Error (and logs to stderr).
//   There are no empty catch blocks and no misleading cwd fallback.
// - Version-explicit navigator stub: defines ONLY `{ onLine: true, userAgent: "node" }`
//   when `globalThis.navigator` is missing, documents the divergence, and is covered by
//   tools/test-setup.test.mjs asserting the exact surface.
// - Mock identity preservation: the bridge forwards a parent-independent `file:` URL
//   identical to what tsx resolves, so the same module record is mocked on Node 20/22.
//   Harness tests prove URL equality against `createRequire(caller).resolve`.
//
// Security note: intercepting `mock.module` is test-only, supply-chain-sensitive logic.
// It is allowlisted, logged (one line per bridged specifier to stderr, suppressible via
// VSU_BRIDGE_QUIET=1), restorable via `restoreMockBridge()`, and never touches prod code.

import { mock } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const SETUP_URL = import.meta.url;

const HERE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE_DIR, "..");
export const TSCONFIG_PATH = path.join(REPO_ROOT, "tsconfig.json");

// Exact navigator stub surface. Node 22 native navigator has many more fields;
// tests must only rely on these two keys when running under the Node 20 shim.
export const NAVIGATOR_STUB = Object.freeze({ onLine: true, userAgent: "node" });

if (typeof globalThis.navigator === "undefined") {
  // Version-divergent by necessity: Node 20 has no navigator, Node 22 does.
  // We define the minimal surface tests need and log it explicitly instead of hiding it.
  Object.defineProperty(globalThis, "navigator", {
    value: { ...NAVIGATOR_STUB },
    configurable: true,
    writable: true,
  });
  if (process.env.VSU_BRIDGE_QUIET !== "1") {
    console.error(
      "[test-setup] globalThis.navigator was missing (Node 20); defined minimal stub { onLine: true, userAgent: \"node\" }. Native Node >= 22 navigator left untouched.",
    );
  }
}

// ---- tsconfig-aware @/ mapping (no cwd) ----

function readTsconfigPaths() {
  try {
    const raw = fs.readFileSync(TSCONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const baseUrl = parsed?.compilerOptions?.baseUrl ?? ".";
    const paths = parsed?.compilerOptions?.paths ?? {};
    return { baseUrl, paths };
  } catch (err) {
    if (process.env.VSU_BRIDGE_QUIET !== "1") {
      console.error(
        `[test-setup] Could not read tsconfig at ${TSCONFIG_PATH}; using repo-root fallback. Reason: ${String(err && err.message ? err.message : err)}`,
      );
    }
    return { baseUrl: ".", paths: {} };
  }
}

const { baseUrl: TSCONFIG_BASE_URL, paths: TSCONFIG_PATHS } = readTsconfigPaths();
const TSCONFIG_BASE_DIR = path.resolve(REPO_ROOT, TSCONFIG_BASE_URL);

function candidateDirsForAtAlias() {
  const mapped = TSCONFIG_PATHS["@/*"];
  if (Array.isArray(mapped) && mapped.length > 0) {
    return mapped.map((m) => {
      // "@/*": ["./*"] -> strip trailing "/*", resolve against base dir.
      const stripped = String(m).replace(/\/\*$/, "").replace(/^\.\//, "");
      return path.resolve(TSCONFIG_BASE_DIR, stripped);
    });
  }
  // Default Next.js convention: "@/*" -> repo root "/*" (NOT process.cwd()).
  return [REPO_ROOT];
}

function resolveAtSpecifierToFile(specifier) {
  const rest = specifier.slice(2); // strip "@/"
  if (rest.includes("\0") || rest.includes("..")) {
    throw new Error(`[test-setup] Refusing to resolve suspicious @/ specifier: ${specifier}`);
  }
  const dirs = candidateDirsForAtAlias();
  for (const dir of dirs) {
    const abs = path.resolve(dir, rest);
    // Try exact file, then common TS/JS extensions, then index files.
    const candidates = [abs];
    if (!path.extname(abs)) {
      for (const ext of [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"]) {
        candidates.push(abs + ext);
      }
      for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
        candidates.push(path.join(abs, `index${ext}`));
      }
    }
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
      } catch (err) {
        throw new Error(
          `[test-setup] Filesystem check failed for @/ candidate ${c}: ${String(err && err.message ? err.message : err)}`,
        );
      }
    }
  }
  return null;
}

// ---- caller detection (hardened stack parsing, fail-fast) ----

export function callerFileUrl() {
  let stack;
  try {
    stack = String(new Error().stack || "").split("\n");
  } catch (err) {
    throw new Error(
      `[test-setup] Unable to capture stack for mock specifier caller: ${String(err && err.message ? err.message : err)}`,
    );
  }
  for (const line of stack) {
    const fileMatch = line.match(/file:\/\/[^\s)]+\.m?[jt]sx?/);
    if (fileMatch) {
      const url = fileMatch[0].replace(/[),;:'"]+$/, "");
      if (url !== SETUP_URL && !url.includes("node:internal")) return url;
      continue;
    }
    const pathMatch =
      line.match(/\((\/[^\s)]+\.m?[jt]sx?)/) || line.match(/at (\/[^\s]+\.m?[jt]sx?)/);
    if (pathMatch) {
      const candidate = pathMatch[1];
      if (candidate.includes("test-setup.mjs")) continue;
      if (candidate.includes("node:internal")) continue;
      try {
        return pathToFileURL(candidate).href;
      } catch (err) {
        throw new Error(
          `[test-setup] Unable to convert caller path to file URL (${candidate}): ${String(err && err.message ? err.message : err)}`,
        );
      }
    }
  }
  return null;
}

// Pure, unit-testable resolver. Throws fail-fast on failure; never falls back to cwd.
export function resolveMockSpecifier(specifier, callerUrl) {
  if (typeof specifier !== "string") return { action: "passthrough", url: specifier };
  if (
    specifier.startsWith("file:") ||
    specifier.startsWith("node:") ||
    specifier.startsWith("data:") ||
    specifier.startsWith("blob:")
  ) {
    return { action: "passthrough", url: specifier };
  }
  const isAtAlias = specifier.startsWith("@/");
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (!isAtAlias && !isRelative) {
    // Bare package specifiers pass through untouched (allowlist).
    return { action: "passthrough", url: specifier };
  }

  if (isAtAlias) {
    // 1) tsconfig-aware file check (deterministic, no caller needed).
    const abs = resolveAtSpecifierToFile(specifier);
    if (abs) return { action: "bridge", url: pathToFileURL(abs).href };
    // 2) tsx-aware CJS resolver from caller for parity (tsx must be preloaded first).
    if (callerUrl) {
      try {
        const requireFromCaller = createRequire(callerUrl);
        const resolved = requireFromCaller.resolve(specifier);
        return { action: "bridge", url: pathToFileURL(resolved).href };
      } catch (err) {
        throw new Error(
          `[test-setup] mock.module bridge failed for "${specifier}" (caller ${callerUrl}): ${String(err && err.message ? err.message : err)}`,
        );
      }
    }
    throw new Error(
      `[test-setup] mock.module bridge cannot resolve "${specifier}": no tsconfig match and no caller URL available (stack parse yielded null). Failing fast instead of guessing via cwd.`,
    );
  }

  // Relative specifier: caller is mandatory.
  if (!callerUrl) {
    throw new Error(
      `[test-setup] mock.module bridge cannot resolve relative "${specifier}": caller file URL is null (stack parse failed). Failing fast instead of guessing via cwd.`,
    );
  }
  try {
    const requireFromCaller = createRequire(callerUrl);
    const resolved = requireFromCaller.resolve(specifier);
    return { action: "bridge", url: pathToFileURL(resolved).href };
  } catch (err) {
    throw new Error(
      `[test-setup] mock.module bridge failed for relative "${specifier}" (caller ${callerUrl}): ${String(err && err.message ? err.message : err)}`,
    );
  }
}

// ---- global bridge (allowlisted, logged, restorable) ----

const originalMockModule =
  mock && typeof mock.module === "function" ? mock.module.bind(mock) : null;

export function restoreMockBridge() {
  if (mock && originalMockModule && mock.module !== originalMockModule) {
    mock.module = originalMockModule;
  }
}

if (mock && typeof mock.module === "function" && originalMockModule) {
  const original = originalMockModule;
  mock.module = function bridgedMockModule(specifier, options) {
    let decision;
    try {
      const caller = callerFileUrl();
      decision = resolveMockSpecifier(specifier, caller);
    } catch (err) {
      // Explicit fail-fast: log and rethrow so a missed mock can never silently pass.
      console.error(String(err && err.stack ? err.stack : err));
      throw err;
    }
    if (decision.action === "bridge") {
      if (process.env.VSU_BRIDGE_QUIET !== "1") {
        console.error(`[test-setup] mock.module bridge: ${String(specifier)} -> ${decision.url}`);
      }
      return original(decision.url, options);
    }
    return original(specifier, options);
  };
  // Keep a reference for diagnostics/tests without polluting other globals.
  mock.module.__vsBridge = { original, resolveMockSpecifier, callerFileUrl };
}