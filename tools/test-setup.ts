/**
 * Cross-version test bootstrap for `npm test` (`tools/run-tests.mjs`).
 *
 * The repository requires Node >= 22 (`package.json` engines) and its own CI
 * pins Node 22, but deterministic merge-gate checkouts may execute `npm test`
 * with the runner's default Node 20 toolchain. Two Node 20 gaps break the
 * suite without this bootstrap:
 *
 * 1. `mock.module("@/...")` specifiers never reach the tsx `resolve` hook on
 *    Node 20 (the test-runner mock resolver pre-resolves them against the
 *    importing file's directory, e.g. `<test-dir>/@/lib/...`), so all 17
 *    mock-based suites fail with ERR_MODULE_NOT_FOUND. Rewriting the
 *    specifier to the same file via a root-anchored path keeps the mock
 *    identity (same resolved file URL, so it still intercepts the source's
 *    `@/` import) on both Node 20 and Node 22.
 * 2. `globalThis.navigator` does not exist on Node 20 (it does on Node 22),
 *    so `Object.getOwnPropertyDescriptor(globalThis.navigator, ...)` throws
 *    before the abort-guard test can run. A minimal `navigator` parity
 *    object preserves the source's `typeof navigator` guard semantics.
 *
 * No test is skipped and no behavior is stubbed: mocks still intercept the
 * real modules, and the navigator shim only supplies the global that newer
 * Node provides natively.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mock } from "node:test";

const TOOLS_DIR: string = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT: string = path.resolve(TOOLS_DIR, "..");

// Navigator parity with Node 22+: the production source guards with
// `typeof navigator !== "undefined"`, while the test assumes the global
// exists to pin `onLine`. Provide the global only when the runtime lacks it.
if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      onLine: true,
      userAgent: "node",
      hardwareConcurrency: 1,
      language: "en-US",
    },
    writable: true,
    configurable: true,
  });
}

type MockModuleFn = (specifier: unknown, ...rest: unknown[]) => unknown;
const mockRecord: { module?: unknown } = (
  typeof mock !== "undefined" ? mock : {}
) as unknown as {
  module?: unknown;
};
const originalMockModule: MockModuleFn | null =
  typeof mockRecord.module === "function"
    ? (mockRecord.module as MockModuleFn).bind(mock)
    : null;
const SELF_URL: string = import.meta.url;
function toRepoAnchoredPath(specifier: string): string {
  return path.join(REPO_ROOT, specifier.slice(2));
}
function callerDir(): string | null {
  // Under tsx, stack frames carry plain filesystem paths
  // (`/repo/lib/.../x.test.ts`), not `file://` URLs, because test files
  // are loaded through the CJS transformer. Match both forms, skipping
  // frames that belong to this bootstrap module itself.
  const selfPath: string = fileURLToPath(SELF_URL);
  const stack: string = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const m: RegExpMatchArray | null = line.match(
      /\(?((?:file:\/\/)?(\/[\w.\-+@[\]/]+?\.m?[tj]s))/,
    );
    if (!m) continue;
    const raw: string = m[1];
    if (raw === SELF_URL || raw === selfPath) continue;
    if (raw.startsWith("file://")) {
      try {
        return path.dirname(fileURLToPath(raw));
      } catch {
        continue;
      }
    }
    return path.dirname(raw);
  }
  return null;
}
function reanchorRelative(specifier: string): string {
  const dir: string | null = callerDir();
  if (!dir) return specifier;
  return path.join(dir, specifier);
}

if (originalMockModule) {
  const compat = function mockModuleCompat(
    specifier: unknown,
    ...rest: unknown[]
  ): unknown {
    if (typeof specifier === "string" && specifier === "@/") {
      return (originalMockModule as MockModuleFn)(REPO_ROOT, ...rest);
    }
    if (typeof specifier === "string" && specifier.startsWith("@/")) {
      return (originalMockModule as MockModuleFn)(
        toRepoAnchoredPath(specifier),
        ...rest,
      );
    }
    if (
      typeof specifier === "string" &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      return (originalMockModule as MockModuleFn)(
        reanchorRelative(specifier),
        ...rest,
      );
    }
    return (originalMockModule as MockModuleFn)(specifier, ...rest);
  };
  mockRecord.module = compat;
}