/**
 * Hermetic test-environment setup for VSU-SmartMap (`--import` preload).
 *
 * SCOPE: part (2) of PR #98 alongside the disclosed next 16.2.12 -> 16.3.5
 * security bump (see `tools/run-tests-hermetic.mjs` header for the split
 * plan). Loaded BEFORE `tsx` in the test worker (`node --import
 * ./tools/test-hermetic-setup.mjs --import tsx --test ...`). It closes two
 * Node-version gaps so `npm test` is hermetic on Node 20 (fleet runners)
 * through Node 22 (CI/`engines`) without changing any test or source file.
 * Isolated-review notes: the `resolve` hook below rewrites ONLY tsconfig
 * `@/* -> ./*` specifiers (bare `@/...` and the Node-20 mock-loader join
 * `file://.../@/...`), validates every suffix, chains via `nextResolve`
 * so `tsx` still does TypeScript extension probing, and never rewrites any
 * other specifier. The navigator shim installs ONLY when the global is
 * missing on Node < 21 and matches the Node 21+ `Navigator` shape exactly
 * (no `onLine`, which Node 21+ does not have); per-test `onLine` mocks
 * remain possible because the shim is writable/configurable.
 *
 * 1. `@/` path-alias resolution inside `node:test` `mock.module()`.
 *    Static/dynamic `@/...` imports are resolved by `tsx` via tsconfig
 *    `paths { "@/*": ["./*"] }`. On Node 20 the experimental
 *    module-mocking loader pre-joins the mock specifier onto the importing
 *    file's directory (`new URL(specifier, parentURL)`) BEFORE resolve
 *    hooks run, producing `<parentDir>/@/ ...`, which can never resolve.
 *    The hook inverts exactly that join against the repository root and
 *    chains onward via `nextResolve`. Diagnostics are printed to stderr
 *    on fallback instead of being swallowed.
 *
 * 2. `globalThis.navigator` on Node 20. Node 21+ ships a global
 *    `navigator` with EXACTLY `hardwareConcurrency`, `language`,
 *    `languages`, `userAgent`, `platform` (prototype getters; `locks` only
 *    on newer runtimes) and NO `onLine`. Node 20 has no `navigator`, so
 *    tests that read or per-test override `navigator.*` throw. The shim
 *    installs the same five-property shape (same names, getter semantics,
 *    enumerable/configurable) derived from standard Node APIs
 *    (`os.availableParallelism`, `Intl` locale, `Node.js/<major>`,
 *    `getNavigatorPlatform(process.platform, process.arch)` replicating
 *    `lib/internal/navigator.js`) only when the global is missing on
 *    Node < 21, and stays out of the way otherwise (including on Node 22,
 *    where the native navigator is left untouched). It deliberately does
 *    NOT add `onLine` so Node 20 and Node 22 observe identical defaults
 *    (`undefined` until a test defines it per-test).
 *
 * The module self-registers its `resolve` hook through `node:module`
 * `register()` exactly once per process (guarded by
 * `VSU_TEST_ALIAS_HOOK_REGISTERED`) and otherwise prints nothing except
 * resolve-fallback diagnostics.
 */

import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOLS_DIR, "..");

/**
 * Replicates Node's `lib/internal/navigator.js#getNavigatorPlatform`
 * exactly so Node 20 shim values match Node 21+/22 native values.
 */
export function getNavigatorPlatform(platform, arch) {
  if (platform === "darwin") {
    return "MacIntel";
  } else if (platform === "win32") {
    return "Win32";
  } else if (platform === "linux") {
    if (arch === "ia32") {
      return "Linux i686";
    } else if (arch === "x64") {
      return "Linux x86_64";
    }
    return `Linux ${arch}`;
  } else if (platform === "freebsd") {
    if (arch === "ia32") {
      return "FreeBSD i386";
    } else if (arch === "x64") {
      return "FreeBSD amd64";
    }
    return `FreeBSD ${arch}`;
  } else if (platform === "openbsd") {
    if (arch === "ia32") {
      return "OpenBSD i386";
    } else if (arch === "x64") {
      return "OpenBSD amd64";
    }
    return `OpenBSD ${arch}`;
  } else if (platform === "sunos") {
    if (arch === "ia32") {
      return "SunOS i86pc";
    }
    return `SunOS ${arch}`;
  } else if (platform === "aix") {
    return "AIX";
  }
  const capitalized = `${platform.slice(0, 1).toUpperCase()}${platform.slice(1)}`;
  return `${capitalized} ${arch}`;
}

export function getHardwareConcurrency() {
  try {
    if (typeof os.availableParallelism === "function") {
      const n = os.availableParallelism();
      if (Number.isInteger(n) && n >= 1) return n;
    }
  } catch (_ignored) {
    // Fall through to os.cpus() below; diagnostic not needed here.
  }
  try {
    const cpus = os.cpus();
    if (Array.isArray(cpus) && cpus.length >= 1) return cpus.length;
  } catch (_ignored) {
    // Ignore; use fallback below.
  }
  return 1;
}

export function getNavigatorLanguage() {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === "string" && locale.length > 0) return locale;
  } catch (_ignored) {
    // Ignore; use fallback below.
  }
  return "en-US";
}

export function getNavigatorUserAgent(nodeMajor) {
  const major =
    Number.isInteger(nodeMajor) && nodeMajor >= 1
      ? nodeMajor
      : Number.parseInt(process.versions.node, 10);
  return `Node.js/${Number.isFinite(major) ? major : 20}`;
}

/**
 * True only for suffixes that are safe to resolve against REPO_ROOT.
 * Rejects: empty, NUL, backslash, absolute paths, `.`/`..` segments
 * (including percent-encoded `%2e`/`%2f` variants), and any normalized
 * path that escapes REPO_ROOT. Only forward-slash relative paths inside
 * the repository pass.
 */
export function isSafeAliasSuffix(suffix) {
  if (typeof suffix !== "string" || suffix.length === 0) return false;
  if (suffix.includes("\0")) return false;
  if (suffix.includes("\\")) return false;
  if (suffix.startsWith("/") || path.isAbsolute(suffix)) return false;
  const segments = suffix.split("/");
  for (const segment of segments) {
    if (segment === ".." || segment === ".") return false;
    // Reject empty segments (`//`, leading/trailing `/` already handled
    // for leading; trailing slash means a directory, not a module).
    if (segment === "") return false;
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch (_decodeError) {
      return false;
    }
    if (decoded === ".." || decoded === ".") return false;
    if (decoded.includes("/") || decoded.includes("\\")) return false;
    if (decoded.includes("\0")) return false;
    // Encoded dot-dot like `%2e%2e` decodes to `..` (caught above);
    // single encoded dots are also rejected to avoid masking.
    const lowered = decoded.toLowerCase();
    if (lowered === "%2e" || lowered === "%2f" || lowered.includes("%2e%2e")) {
      return false;
    }
  }
  const normalized = path.normalize(suffix);
  if (normalized === "." || normalized.startsWith("..")) return false;
  if (path.isAbsolute(normalized)) return false;
  const resolved = path.resolve(REPO_ROOT, normalized);
  const rootWithSep = REPO_ROOT.endsWith(path.sep)
    ? REPO_ROOT
    : REPO_ROOT + path.sep;
  if (resolved !== REPO_ROOT && !resolved.startsWith(rootWithSep)) {
    return false;
  }
  return true;
}

/** Raw suffix after bare `@/`, or null when the specifier is not one. */
export function extractBareAliasSuffix(specifier) {
  if (typeof specifier !== "string") return null;
  if (!specifier.startsWith("@/")) return null;
  const suffix = specifier.slice(2);
  if (suffix.length === 0) return null;
  return suffix;
}

/**
 * Raw suffix after the literal `/@/` in a `file://` URL (the Node 20
 * mock-loader pre-join shape `<parentDir>/@/ ...`), or null otherwise.
 * Uses the FIRST `/@/` so a suffix that itself contains `/@/` is
 * preserved intact for subsequent safety validation.
 */
export function extractFileUrlAliasSuffix(specifier) {
  if (typeof specifier !== "string") return null;
  if (!specifier.startsWith("file://")) return null;
  const marker = "/@/";
  const index = specifier.indexOf(marker);
  if (index === -1) return null;
  const suffix = specifier.slice(index + marker.length);
  if (suffix.length === 0) return null;
  return suffix;
}

export function rootFileUrl(suffix) {
  return pathToFileURL(path.join(REPO_ROOT, suffix)).href;
}

/** Whether the navigator parity shim should install in this process. */
export function shouldInstallNavigator(
  globalNavigator,
  nodeMajorVersion,
) {
  const major =
    typeof nodeMajorVersion === "number" && Number.isFinite(nodeMajorVersion)
      ? nodeMajorVersion
      : Number.parseInt(process.versions.node, 10);
  return typeof globalNavigator === "undefined" && major < 21;
}

export function buildNavigatorShim() {
  const major = Number.parseInt(process.versions.node, 10);
  const language = getNavigatorLanguage();
  const shim = {};
  Object.defineProperties(shim, {
    hardwareConcurrency: {
      get() {
        return getHardwareConcurrency();
      },
      enumerable: true,
      configurable: true,
    },
    language: {
      get() {
        return getNavigatorLanguage();
      },
      enumerable: true,
      configurable: true,
    },
    languages: {
      get() {
        return Object.freeze([language]);
      },
      enumerable: true,
      configurable: true,
    },
    userAgent: {
      get() {
        return getNavigatorUserAgent(major);
      },
      enumerable: true,
      configurable: true,
    },
    platform: {
      get() {
        return getNavigatorPlatform(process.platform, process.arch);
      },
      enumerable: true,
      configurable: true,
    },
  });
  return shim;
}

export async function resolve(specifier, context, nextResolve) {
  const bareSuffix = extractBareAliasSuffix(specifier);
  if (bareSuffix !== null) {
    if (!isSafeAliasSuffix(bareSuffix)) {
      // Fail closed: leave unsafe/odd suffixes for the default chain.
      return nextResolve(specifier, context);
    }
    try {
      return await nextResolve(rootFileUrl(bareSuffix), context);
    } catch (error) {
      process.stderr.write(
        `[test-hermetic-setup] WARN bare @/ resolve failed for ${JSON.stringify(specifier)}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      return await nextResolve(specifier, context);
    }
  }
  const fileSuffix = extractFileUrlAliasSuffix(specifier);
  if (fileSuffix !== null) {
    if (!isSafeAliasSuffix(fileSuffix)) {
      return nextResolve(specifier, context);
    }
    try {
      return await nextResolve(rootFileUrl(fileSuffix), context);
    } catch (error) {
      process.stderr.write(
        `[test-hermetic-setup] WARN file /@/ resolve failed for ${JSON.stringify(specifier)}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      return await nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}

if (
  shouldInstallNavigator(
    globalThis.navigator,
    Number.parseInt(process.versions.node, 10),
  )
) {
  Object.defineProperty(globalThis, "navigator", {
    value: buildNavigatorShim(),
    writable: true,
    configurable: true,
  });
}

if (!process.env.VSU_TEST_ALIAS_HOOK_REGISTERED) {
  process.env.VSU_TEST_ALIAS_HOOK_REGISTERED = "1";
  register(import.meta.url);
}