/**
 * Hermetic test-environment setup for VSU-SmartMap (`--import` preload).
 *
 * Loaded BEFORE `tsx` in the test worker (`node --import
 * ./tools/test-hermetic-setup.mjs --import tsx --test …`). It closes two
 * Node-version gaps so `npm test` is hermetic on every supported runtime
 * (Node 20 fleet runners through Node 22 CI) without changing any test or
 * source file:
 *
 * 1. `@/` path-alias resolution inside `node:test` `mock.module()`.
 *    Static/dynamic `@/…` imports are resolved by `tsx` via tsconfig
 *    `paths`. On Node 20, however, the experimental module-mocking loader
 *    pre-joins the mock specifier onto the importing file's directory
 *    (`new URL(specifier, parentURL)`) BEFORE resolve hooks run, producing
 *    `<parentDir>/@/…`, which can never resolve. The `resolve` hook below
 *    inverts exactly that join: a bare `@/…` specifier and any `file://`
 *    URL containing a literal `/@/` segment are resolved against the
 *    repository root — the precise meaning of tsconfig
 *    `"paths": { "@/*": ["./*"] }` — and chained onward via `nextResolve`
 *    so `tsx` still performs TypeScript extension probing. No other
 *    specifier is touched.
 *
 * 2. `globalThis.navigator` on Node 20. Node 21+ ships a global `navigator`
 *    (with `onLine: true` by default); Node 20 has none, so tests that read
 *    or override `navigator.onLine` throw. The shim installs the identical
 *    default shape only when the global is missing and stays out of the way
 *    otherwise.
 *
 * The module self-registers its `resolve` hook through `node:module`
 * `register()` exactly once per process (guarded by
 * `VSU_TEST_ALIAS_HOOK_REGISTERED`) and otherwise has no side effects and
 * prints nothing.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOLS_DIR, "..");

function rootFileUrl(suffix) {
  return pathToFileURL(path.join(REPO_ROOT, suffix)).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    try {
      return await nextResolve(rootFileUrl(specifier.slice(2)), context);
    } catch {
      return await nextResolve(specifier, context);
    }
  }
  if (specifier.startsWith("file://") && specifier.includes("/@/")) {
    const suffix = specifier.split("/@/").slice(1).join("/@/");
    try {
      return await nextResolve(rootFileUrl(suffix), context);
    } catch {
      return await nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}

if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    writable: true,
    configurable: true,
  });
}

if (!process.env.VSU_TEST_ALIAS_HOOK_REGISTERED) {
  process.env.VSU_TEST_ALIAS_HOOK_REGISTERED = "1";
  register(import.meta.url);
}