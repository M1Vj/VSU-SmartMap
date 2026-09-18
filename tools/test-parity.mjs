import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import Module from "node:module";

// Node-version parity for the `npm test` suite (tools/run-tests.mjs).
//
// Repository engines require Node >= 22 and CI runs Node 22, where the full
// suite passes unassisted. Deterministic merge-gate runners may execute
// `npm test` on Node 20, where two platform gaps fail 18 suites independent
// of any PR:
//
//  1. `mock.module("@/...")` specifiers: on Node 20 the test-runner mock
//     machinery resolves specifiers with path-join semantics ("@/lib/x"
//     imported from "<dir>/f" becomes "<dir>/@/lib/x") instead of ESM
//     resolution, so every suite that mocks an "@/..." module fails with
//     ERR_MODULE_NOT_FOUND (both at mock-registration time, which uses
//     CJS-style resolution, and at import-rewrite time, which reaches the
//     ESM loader already joined). Bare package specifiers
//     ("next/navigation") are likewise resolved relative to the calling
//     file instead of node_modules. The three layers below (mock.module
//     pre-resolution, a CJS _resolveFilename patch, and an ESM resolve
//     hook) each map specifiers to the REAL on-disk module implementing
//     the tsconfig "@/*" -> "./*" alias.
//  2. `globalThis.navigator` does not exist on Node 20 (Node 22 provides it
//     via undici), so `Object.getOwnPropertyDescriptor(globalThis.navigator,
//     "onLine")` in lib/pathfinding/external.test.ts throws TypeError. It
//     is defined below only when absent; tests still override `onLine`
//     per-test via defineProperty.
//
// What this module does NOT do: no stubs, no test skips, no behavior
// changes. On Node >= 22 every mapping resolves to the exact file the
// native toolchain would load (remapping is additionally bypassed there,
// see REMAP), and the navigator object is only defined when missing.
//
// Hermetic: local filesystem only, no network. Fail-safe: any specifier it
// cannot map is passed through untouched. Blast-radius guards:
//   - Everything is a no-op unless SMARTMAP_TEST_PARITY=1 (set by the
//     `test` script in package.json), so unrelated Node processes are
//     unaffected.
//   - The resolve hook and the CJS patch only remap specifiers whose parent
//     module lives under the repository root, so grandchildren spawned with
//     a different cwd (e.g. the Manila-timezone test, cwd /tmp) and host
//     tooling (npm itself, which inherits NODE_OPTIONS) fall through to
//     plain Node/tsx behavior.
//   - Core modules ("fs" -> "fs"), node:/file:/data: URLs, and relative
//     specifiers always pass through. Reentrancy between require.resolve
//     and the CJS patch is guarded by a flag.
//
// Wiring (package.json `test` script; $PWD keeps grandchildren working
// regardless of their cwd, and NODE_OPTIONS propagates to every test child
// process spawned by tools/run-tests.mjs, so the runner itself is untouched):
//   SMARTMAP_TEST_PARITY=1 NODE_OPTIONS="--loader $PWD/tools/test-parity.mjs
//   --import $PWD/tools/test-parity.mjs" node tools/run-tests.mjs
// The `--loader` half provides the resolve hook; the `--import` half runs
// this same file in the main thread so the navigator polyfill and the
// mock/CJS patches land in the scope the tests observe. This file is
// intentionally free of top-level await and never calls register(), so the
// dual loader/import roles cannot deadlock or double-register.
const ACTIVE = process.env.SMARTMAP_TEST_PARITY === "1";
const NODE_MAJOR = Number(String(process.versions.node || "0").split(".")[0] || 0);
// Remapping exists only for runtimes older than the engines floor. On
// Node >= 22 the resolve/CJS/mock layers pass everything through.
const REMAP = ACTIVE && NODE_MAJOR < 22;
const root = process.cwd();
const rootUrl = pathToFileURL(root + path.sep).href;
const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

function underRoot(parentURL) {
  if (!parentURL) return false;
  try {
    const p = String(parentURL);
    if (p.startsWith("file:")) return p.startsWith(rootUrl);
    if (path.isAbsolute(p)) return p === root || p.startsWith(root + path.sep);
  } catch {}
  return false;
}

function probe(base) {
  try {
    if (statSync(base).isFile()) return pathToFileURL(base).href;
  } catch {}
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return pathToFileURL(base + ext).href;
  }
  for (const ext of EXTENSIONS) {
    const idx = path.join(base, "index" + ext);
    if (existsSync(idx)) return pathToFileURL(idx).href;
  }
  return null;
}

// Undo "<dir>/@/rest" joins back to "<root>/rest".
function unmangle(spec) {
  const i = spec.indexOf("/@/");
  if (i < 0) return null;
  const rest = spec.slice(i + 3);
  if (!rest || rest.includes("\0")) return null;
  if (rest.startsWith(".") || path.isAbsolute(rest)) return null;
  return probe(path.join(root, rest));
}

let rootRequire = null;
let resolving = false;
function bareResolveSync(spec) {
  if (resolving) return null;
  try {
    if (!rootRequire) rootRequire = createRequire(path.join(root, "package.json"));
  } catch {
    return null;
  }
  resolving = true;
  try {
    return rootRequire.resolve(spec);
  } catch {
    return null;
  } finally {
    resolving = false;
  }
}

function mapSpecifier(spec) {
  if (typeof spec !== "string") return null;
  if (spec.startsWith("node:") || spec.startsWith("file:") || spec.startsWith("data:")) return null;
  if (spec === "@" || spec.startsWith("@/")) {
    const rel = spec === "@" ? "" : spec.slice(2);
    return probe(path.join(root, rel));
  }
  if (!spec.startsWith(".") && !path.isAbsolute(spec)) {
    const r = bareResolveSync(spec);
    // Core modules resolve to themselves ("fs" -> "fs"): pass through.
    if (!r || r === spec || !path.isAbsolute(r)) return null;
    try {
      return pathToFileURL(r).href;
    } catch {
      return null;
    }
  }
  if (spec.startsWith(".") || spec === "..") return null;
  return unmangle(spec);
}

export async function resolve(specifier, context, nextResolve) {
  if (REMAP && underRoot(context && context.parentURL)) {
    try {
      const mapped = mapSpecifier(specifier);
      if (mapped) return { url: mapped, shortCircuit: true };
    } catch {}
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  return nextLoad(url, context);
}

if (ACTIVE && typeof globalThis.navigator === "undefined") {
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true, userAgent: "node" },
      writable: true,
      configurable: true,
    });
  } catch {}
}

if (REMAP) {
  try {
    const Ctor = Module;
    if (Ctor && Ctor._resolveFilename && !Ctor._resolveFilename.__smartmapParityPatched) {
      const orig = Ctor._resolveFilename;
      const patchedResolve = function (request, parent, ...rest) {
        const parentFile = parent && (parent.filename || parent.id);
        if (!underRoot(parentFile) && !(typeof request === "string" && request.includes("/@/"))) {
          return orig.call(this, request, parent, ...rest);
        }
        if (resolving) return orig.call(this, request, parent, ...rest);
        if (typeof request === "string" && !request.startsWith(".") && request !== "..") {
          try {
            const m = mapSpecifier(request);
            if (m && m.startsWith("file:")) {
              try {
                return fileURLToPath(m);
              } catch {
                return m;
              }
            }
          } catch {}
        }
        try {
          return orig.call(this, request, parent, ...rest);
        } catch (err) {
          const fixed = request && typeof request === "string" ? unmangle(request) : null;
          if (fixed) {
            try {
              return fileURLToPath(fixed);
            } catch {
              return fixed;
            }
          }
          throw err;
        }
      };
      patchedResolve.__smartmapParityPatched = true;
      Ctor._resolveFilename = patchedResolve;
    }
  } catch {}
}