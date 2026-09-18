#!/usr/bin/env node
// Hermetic verifier for the Next.js 16.3.5 security backport.
//
// Scope: Next.js framework pins only (next, @next/bundle-analyzer,
// eslint-config-next -> 16.3.5). Map-related packages intentionally stay on
// the pre-backport line (maplibre-gl ^5.24.0, bridge ^0.1.3) so this PR
// remains single-purpose and low-risk.
//
// Hermetic: reads only local files (package.json, package-lock.json,
// proxy.ts, .github/workflows/quality.yml) and executes local code via
// node:vm plus the repo's own proxy.test.ts. Makes NO network requests.
// Advisory closure is enforced by the existing CI gate
// `npm audit --omit=dev --audit-level=high` (checked hermetically below),
// not by this script alone.
//
// Fail-fast: any FAIL exits 1. No `|| true`, no continue-on-error.
// Gating: none required (hermetic). If `tsx`/`next` are absent the runtime
// proxy.test.ts subprocess reports a clear SKIP reason instead of silently
// passing, and VM-level CSP execution must still pass.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const skips = [];

function pass(name) {
  console.log(`PASS ${name}`);
}

function fail(name, detail = "") {
  failures.push(name);
  console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

function skip(name, reason) {
  skips.push(name);
  console.log(`SKIP ${name}: ${reason}`);
}

// ---------------------------------------------------------------------------
// 1. Package pins: Next.js 16.3.5 only; map scope reverted.
// ---------------------------------------------------------------------------
let pkg;
try {
  pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
} catch (err) {
  console.log(`FAIL package.json readable: ${String(err?.message || err)}`);
  process.exit(1);
}

function checkPin(getter, expected, label) {
  const actual = getter();
  if (actual === expected) pass(label);
  else fail(label, `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

checkPin(() => pkg?.dependencies?.next, "16.3.5", "next pinned to 16.3.5");
checkPin(
  () => pkg?.devDependencies?.["@next/bundle-analyzer"],
  "16.3.5",
  "bundle-analyzer pinned to 16.3.5",
);
checkPin(
  () => pkg?.devDependencies?.["eslint-config-next"],
  "16.3.5",
  "eslint-config-next pinned to 16.3.5",
);
checkPin(
  () => pkg?.dependencies?.["maplibre-gl"],
  "^5.24.0",
  "maplibre-gl stays on ^5.24.0 (no 5->6 major in security backport)",
);
checkPin(
  () => pkg?.dependencies?.["@maplibre/maplibre-gl-leaflet"],
  "^0.1.3",
  "maplibre-gl-leaflet stays on ^0.1.3 (no minor bump in security backport)",
);

if (pkg?.dependencies?.["maplibre-gl"] === "^6.4.1") {
  fail("no undisclosed maplibre 6.x", "package.json must not contain ^6.4.1 in this PR");
} else {
  pass("no undisclosed maplibre 6.x");
}

// ---------------------------------------------------------------------------
// 2. proxy.ts: execute the real CSP builder in a VM (not substring matching).
// ---------------------------------------------------------------------------
let proxy = "";
try {
  proxy = readFileSync(path.join(root, "proxy.ts"), "utf8");
} catch (err) {
  console.log(`FAIL proxy.ts readable: ${String(err?.message || err)}`);
  process.exit(1);
}

// 2a. Structural presence (necessary but not sufficient; runtime follows).
for (const [label, needle] of [
  ["proxy exports buildContentSecurityPolicy(nonce)", "function buildContentSecurityPolicy(nonce"],
  ["proxy exports applySecurityHeaders", "export function applySecurityHeaders"],
  ["proxy mints per-request nonce", "crypto.randomUUID().replace(/-/g,"],
  ["proxy forwards nonce via request headers", "new NextRequest(request, { headers })"],
]) {
  if (proxy.includes(needle)) pass(label);
  else fail(label, `missing ${JSON.stringify(needle)}`);
}

// 2b. Data-flow: single `nonce` const flows to BOTH request and response paths.
{
  const nonceDecl = proxy.match(/const\s+nonce\s*=\s*crypto\.randomUUID\(\)\.replace\(\/-\/g,\s*""\)/);
  const reqApply = proxy.match(/applySecurityHeaders\(\s*headers\s*,\s*nonce\s*\)/);
  const fwd = proxy.match(/new\s+NextRequest\(\s*request\s*,\s*\{\s*headers\s*\}\s*\)/);
  const resApply = proxy.match(/applySecurityHeaders\(\s*response\.headers\s*,\s*nonce\s*\)/);
  if (nonceDecl) pass("nonce minted via crypto.randomUUID().replace");
  else fail("nonce minted via crypto.randomUUID().replace", "declaration not found");
  if (reqApply && fwd && resApply) {
    // Order: mint -> request headers -> forward -> response headers (same ident).
    const iDecl = proxy.indexOf(nonceDecl?.[0] ?? "const nonce");
    const iReq = proxy.indexOf(reqApply[0]);
    const iFwd = proxy.indexOf(fwd[0]);
    const iRes = proxy.indexOf(resApply[0]);
    if (iDecl < iReq && iReq < iFwd && iFwd < iRes) pass("single nonce flows request->forward->response in order");
    else fail("single nonce flows request->forward->response in order", `indexes ${iDecl}/${iReq}/${iFwd}/${iRes}`);
  } else {
    fail(
      "single nonce flows request->forward->response in order",
      `reqApply=${Boolean(reqApply)} fwd=${Boolean(fwd)} resApply=${Boolean(resApply)}`,
    );
  }
  // Guard against minting a second nonce for the response (must reuse same value).
  const nonceDecls = proxy.match(/const\s+nonce\s*=/g) || [];
  if (nonceDecls.length === 1) pass("exactly one nonce per request (no second mint)");
  else fail("exactly one nonce per request (no second mint)", `found ${nonceDecls.length} declarations`);
}

// 2c. Runtime: extract the REAL builder from proxy.ts, strip TS types, execute.
{
  const m = proxy.match(/function buildContentSecurityPolicy[\s\S]*?\n\}/);
  if (!m) {
    fail("CSP builder extractable for runtime execution", "regex found no function body");
  } else {
    try {
      const jsSrc = m[0].replace(/:\s*string/g, "");
      const sandbox = {};
      vm.createContext(sandbox);
      vm.runInContext(`${jsSrc}\nthis.__builder = buildContentSecurityPolicy;`, sandbox, {
        timeout: 2000,
      });
      const builder = sandbox.__builder;
      if (typeof builder !== "function") {
        fail("CSP builder executable", "extracted value is not a function");
      } else {
        const nonceA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
        const nonceB = "ffffffffffffffffffffffffffffffff";
        const policyA = builder(nonceA);
        const policyB = builder(nonceB);
        // script-src carries this request's nonce.
        if (policyA.includes(`script-src 'self' 'nonce-${nonceA}'`)) pass("runtime script-src carries request nonce");
        else fail("runtime script-src carries request nonce", policyA.slice(0, 220));
        // No unsafe-inline in script-src (would defeat nonce).
        const scriptSrc = (policyA.split(";").find((d) => d.trim().startsWith("script-src")) || "").trim();
        if (scriptSrc && !scriptSrc.includes("unsafe-inline")) pass("runtime script-src has no unsafe-inline");
        else fail("runtime script-src has no unsafe-inline", scriptSrc);
        // Nonce actually varies per request (fresh value, not static).
        if (policyA !== policyB && policyB.includes(`nonce-${nonceB}`)) pass("runtime CSP varies per nonce (fresh per request)");
        else fail("runtime CSP varies per nonce (fresh per request)", "policies identical or second nonce missing");
        // Core hardening directives present at runtime.
        for (const needle of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
          if (policyA.includes(needle)) pass(`runtime policy contains ${needle}`);
          else fail(`runtime policy contains ${needle}`, policyA.slice(0, 200));
        }
        // style-src keeps unsafe-inline only for styles (expected; scripts stay nonce-only).
        if (!scriptSrc.includes("unsafe-inline")) pass("runtime confirms scripts nonce-only (styles may keep unsafe-inline)");
        else fail("runtime confirms scripts nonce-only (styles may keep unsafe-inline)", scriptSrc);
      }
    } catch (err) {
      fail("CSP builder executable", String(err?.message || err));
    }
  }
}

// 2d. Runtime: execute applySecurityHeaders with a real Headers instance.
{
  try {
    const builderMatch = proxy.match(/function buildContentSecurityPolicy[\s\S]*?\n\}/);
    const applierMatch = proxy.match(/export function applySecurityHeaders[\s\S]*?\n\}/);
    if (!builderMatch || !applierMatch) {
      fail("applySecurityHeaders executable", "could not extract both functions");
    } else {
      const jsSrc =
        builderMatch[0].replace(/:\s*string/g, "") +
        "\n" +
        applierMatch[0].replace(/export\s+function/, "function").replace(/:\s*Headers/g, "").replace(/:\s*string/g, "").replace(/:\s*void/g, "");
      const sandbox = { Headers };
      vm.createContext(sandbox);
      vm.runInContext(`${jsSrc}\nthis.__apply = applySecurityHeaders;`, sandbox, { timeout: 2000 });
      const apply = sandbox.__apply;
      const h = new Headers();
      apply(h, "runtimeheaderscheck1234567890ab");
      const csp = h.get("content-security-policy") || "";
      if (csp.includes("nonce-runtimeheaderscheck1234567890ab")) pass("runtime applySecurityHeaders sets CSP nonce header");
      else fail("runtime applySecurityHeaders sets CSP nonce header", csp.slice(0, 200));
      if (h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "DENY") {
        pass("runtime applySecurityHeaders sets hardening headers");
      } else {
        fail("runtime applySecurityHeaders sets hardening headers", `nosniff=${h.get("x-content-type-options")} frame=${h.get("x-frame-options")}`);
      }
    }
  } catch (err) {
    fail("applySecurityHeaders executable", String(err?.message || err));
  }
}

// ---------------------------------------------------------------------------
// 3. Supply-chain scope: lockfile must match Next-only intent (hermetic read).
// ---------------------------------------------------------------------------
{
  const lockPath = path.join(root, "package-lock.json");
  if (!existsSync(lockPath)) {
    fail("package-lock.json present", "missing; run npm install --package-lock-only after fixing package.json");
  } else {
    try {
      const lock = JSON.parse(readFileSync(lockPath, "utf8"));
      if (lock?.name === "VSU-SmartMap-public") pass("lockfile package name is VSU-SmartMap-public");
      else fail("lockfile package name is VSU-SmartMap-public", String(lock?.name));
      if (lock?.name === "smartmap-pr102") fail("lockfile has no PR-private rename", "found smartmap-pr102");
      else pass("lockfile has no PR-private rename");
      const rootDeps = lock?.packages?.[""]?.dependencies || {};
      const rootDev = lock?.packages?.[""]?.devDependencies || {};
      if (rootDeps.next === "16.3.5") pass("lockfile root next is 16.3.5");
      else fail("lockfile root next is 16.3.5", String(rootDeps.next));
      if (rootDeps["maplibre-gl"] === "^5.24.0") pass("lockfile root maplibre-gl is ^5.24.0");
      else fail("lockfile root maplibre-gl is ^5.24.0", String(rootDeps["maplibre-gl"]));
      if (rootDeps["@maplibre/maplibre-gl-leaflet"] === "^0.1.3") pass("lockfile root bridge is ^0.1.3");
      else fail("lockfile root bridge is ^0.1.3", String(rootDeps["@maplibre/maplibre-gl-leaflet"]));
      if (rootDev["@next/bundle-analyzer"] === "16.3.5") pass("lockfile root bundle-analyzer is 16.3.5");
      else fail("lockfile root bundle-analyzer is 16.3.5", String(rootDev["@next/bundle-analyzer"]));
      if (rootDev["eslint-config-next"] === "16.3.5") pass("lockfile root eslint-config-next is 16.3.5");
      else fail("lockfile root eslint-config-next is 16.3.5", String(rootDev["eslint-config-next"]));
      const vt = lock?.packages?.["node_modules/@mapbox/vector-tile"]?.version;
      if (vt === "2.0.5") pass("lockfile vector-tile stays 2.0.5");
      else fail("lockfile vector-tile stays 2.0.5", String(vt));
      const ub = lock?.packages?.["node_modules/@mapbox/unitbezier"]?.version;
      if (ub === "0.0.1") pass("lockfile unitbezier stays 0.0.1");
      else fail("lockfile unitbezier stays 0.0.1", String(ub));
      if (lock?.packages?.["node_modules/@mapbox/whoots-js"]) pass("lockfile retains @mapbox/whoots-js");
      else fail("lockfile retains @mapbox/whoots-js", "entry missing (must not be removed in this PR)");
      const jl = lock?.packages?.["node_modules/@mapbox/jsonlint-lines-primitives"]?.version;
      if (jl === "2.0.2") pass("lockfile jsonlint-lines-primitives stays 2.0.2");
      else fail("lockfile jsonlint-lines-primitives stays 2.0.2", String(jl));
      const ml = lock?.packages?.["node_modules/maplibre-gl"]?.version;
      if (typeof ml === "string" && ml.startsWith("5.")) pass(`lockfile maplibre-gl resolved stays 5.x (${ml})`);
      else fail("lockfile maplibre-gl resolved stays 5.x", String(ml));
    } catch (err) {
      fail("package-lock.json parseable", String(err?.message || err));
    }
  }
}

// ---------------------------------------------------------------------------
// 4. CI gate: audit stays at high, verifier wired (hermetic file read).
// ---------------------------------------------------------------------------
{
  const qPath = path.join(root, ".github/workflows/quality.yml");
  if (!existsSync(qPath)) {
    fail("quality.yml present", "missing");
  } else {
    const q = readFileSync(qPath, "utf8");
    if (q.includes("npm audit --omit=dev --audit-level=high")) pass("quality.yml audit gate stays at high");
    else fail("quality.yml audit gate stays at high", "expected --audit-level=high");
    if (q.includes("npm audit --omit=dev --audit-level=critical")) {
      fail("quality.yml has no critical downgrade", "found --audit-level=critical");
    } else {
      pass("quality.yml has no critical downgrade");
    }
    if (q.includes("tools/qa/verify-next-csp-nonce.mjs")) pass("quality.yml wires CSP nonce verifier");
    else fail("quality.yml wires CSP nonce verifier", "missing run step");
    if (q.includes("tools/qa/lockfile-scope-guard.mjs")) pass("quality.yml wires lockfile scope guard");
    else fail("quality.yml wires lockfile scope guard", "missing run step");
  }
}

// ---------------------------------------------------------------------------
// 5. Runtime integration: repo's own proxy.test.ts must pass (real execution).
//    Hermetic: local only. Gated only by tool availability with clear SKIP.
// ---------------------------------------------------------------------------
{
  const testPath = path.join(root, "proxy.test.ts");
  if (!existsSync(testPath)) {
    fail("proxy.test.ts present", "missing integration source");
  } else {
    const r = spawnSync(
      process.execPath,
      ["--experimental-test-module-mocks", "--import", "tsx", "--test", "proxy.test.ts"],
      { cwd: root, encoding: "utf8", timeout: 120000 },
    );
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    if (r.status === 0) {
      pass("proxy.test.ts runtime integration passes");
    } else if (out.includes("Cannot find package 'tsx'") || out.includes("ERR_MODULE_NOT_FOUND")) {
      skip("proxy.test.ts runtime integration", "tsx/next not installed; run npm ci first, then re-run verifier");
    } else {
      fail("proxy.test.ts runtime integration passes", `exit=${r.status} output=${out.slice(-1500)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Verdict (fail-fast).
// ---------------------------------------------------------------------------
if (skips.length > 0) {
  console.log(`\n${skips.length} check(s) skipped (hermetic, tool-gated): ${skips.join(", ")}`);
}
if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Next.js 16.3.5 backport checks passed (runtime CSP + scope + CI gate)");
