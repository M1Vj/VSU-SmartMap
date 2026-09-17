// Hermetic test preload for `npm test`.
//
// The repository requires Node >= 22 (see package.json engines), but the
// deterministic merge gate may execute `npm test` on Node 20. Two gaps break
// the suite on Node 20 while Node 22 passes unmodified:
//
// 1. `mock.module("@/...")` bypasses the tsx tsconfig-paths resolver on
//    Node 20 (static `import "@/..."` still works through tsx). Node 22
//    routes mock specifiers through the customization hooks, so the same
//    calls succeed there.
// 2. `globalThis.navigator` does not exist on Node 20 (Node 22 provides it),
//    so tests that stub `navigator.onLine` throw
//    "Cannot convert undefined or null to object".
//
// This preload closes both gaps without changing production behavior:
// - it defines a minimal `navigator` ({ onLine: true }) only when missing;
// - it bridges `mock.module` specifiers through the tsx-aware CJS resolver
//   (resolved from the calling test file) and forwards the resulting
//   parent-independent file URL to the original implementation.
//
// On Node 22 the bridge resolves to the identical file URL tsx would have
// produced, so mock identity is preserved on both versions.

import { mock } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const SETUP_URL = import.meta.url;

if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node" },
    configurable: true,
    writable: true,
  });
}

function callerFileUrl() {
  const stack = String(new Error().stack || "").split("\n");
  for (const line of stack) {
    const fileMatch = line.match(/file:\/\/[^\s)]+\.m?[jt]sx?/);
    if (fileMatch) {
      const url = fileMatch[0].replace(/[),;:'"]+$/, "");
      if (url !== SETUP_URL && !url.includes("node:internal")) return url;
      continue;
    }
    const pathMatch =
      line.match(/\((\/[^\s)]+\.m?[jt]sx?)/) ||
      line.match(/at (\/[^\s]+\.m?[jt]sx?)/);
    if (pathMatch) {
      const candidate = pathMatch[1];
      if (candidate.includes("test-setup.mjs")) continue;
      try {
        return pathToFileURL(candidate).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

if (mock && typeof mock.module === "function") {
  const originalModule = mock.module.bind(mock);
  mock.module = function bridgedMockModule(specifier, options) {
    try {
      if (
        typeof specifier === "string" &&
        !specifier.startsWith("file:") &&
        !specifier.startsWith("node:") &&
        !specifier.startsWith("data:")
      ) {
        const caller = callerFileUrl();
        if (caller) {
          try {
            const requireFromCaller = createRequire(caller);
            const resolved = requireFromCaller.resolve(specifier);
            return originalModule(pathToFileURL(resolved).href, options);
          } catch {
            // Fall through to the `@/` cwd fallback, then to the
            // original call so the failure stays fail-fast and explicit.
          }
        }
        if (specifier.startsWith("@/")) {
          const absolute = path.join(process.cwd(), specifier.slice(2));
          return originalModule(pathToFileURL(absolute).href, options);
        }
      }
    } catch {
      // Never swallow: fall through to the original implementation.
    }
    return originalModule(specifier, options);
  };
}