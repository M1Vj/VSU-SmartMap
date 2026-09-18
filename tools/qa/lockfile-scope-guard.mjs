#!/usr/bin/env node
// Hermetic lockfile scope guard for the Next.js 16.3.5 security backport.
//
// Enforces single-purpose scope: only Next.js framework pins may advance
// (next, @next/bundle-analyzer, eslint-config-next -> 16.3.5). All
// map/vector-tile transitive bumps from the rejected draft are rejected
// here so they cannot silently re-enter via `npm install` drift.
//
// Hermetic: reads only local package.json + package-lock.json. No network.
// Fail-fast: any FAIL exits 1 with regeneration instructions.
// CI wiring: run AFTER `npm ci` via quality.yml:
//   node tools/qa/lockfile-scope-guard.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function pass(name) {
  console.log(`PASS ${name}`);
}
function fail(name, detail = "") {
  failures.push(name);
  console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
} catch (err) {
  console.log(`FAIL package.json readable: ${String(err?.message || err)}`);
  process.exit(1);
}

// --- Source of truth: package.json must already be Next-only. ---
const expectPkg = {
  "dependencies.next": [pkg?.dependencies?.next, "16.3.5"],
  "devDependencies.@next/bundle-analyzer": [pkg?.devDependencies?.["@next/bundle-analyzer"], "16.3.5"],
  "devDependencies.eslint-config-next": [pkg?.devDependencies?.["eslint-config-next"], "16.3.5"],
  "dependencies.maplibre-gl": [pkg?.dependencies?.["maplibre-gl"], "^5.24.0"],
  "dependencies.@maplibre/maplibre-gl-leaflet": [pkg?.dependencies?.["@maplibre/maplibre-gl-leaflet"], "^0.1.3"],
};
for (const [label, [actual, expected]] of Object.entries(expectPkg)) {
  if (actual === expected) pass(`package.json ${label} == ${expected}`);
  else fail(`package.json ${label} == ${expected}`, `got ${JSON.stringify(actual)}`);
}

const lockPath = path.join(root, "package-lock.json");
if (!existsSync(lockPath)) {
  fail("package-lock.json present", "missing; regenerate with npm install --package-lock-only");
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
} catch (err) {
  console.log(`FAIL package-lock.json parseable: ${String(err?.message || err)}`);
  process.exit(1);
}

// --- Identity: never rename the public package in a security backport. ---
if (lock?.name === "VSU-SmartMap-public") pass("lockfile name is VSU-SmartMap-public");
else fail("lockfile name is VSU-SmartMap-public", `got ${JSON.stringify(lock?.name)}`);
if (lock?.name === "smartmap-pr102") fail("lockfile has no PR-private rename", "found smartmap-pr102");
else pass("lockfile has no PR-private rename");

// --- Root ranges: only intended Next pins differ from base. ---
const rootDeps = lock?.packages?.[""]?.dependencies || {};
const rootDev = lock?.packages?.[""]?.devDependencies || {};
const expectRoot = {
  "dependencies.next": [rootDeps.next, "16.3.5"],
  "dependencies.maplibre-gl": [rootDeps["maplibre-gl"], "^5.24.0"],
  "dependencies.@maplibre/maplibre-gl-leaflet": [rootDeps["@maplibre/maplibre-gl-leaflet"], "^0.1.3"],
  "devDependencies.@next/bundle-analyzer": [rootDev["@next/bundle-analyzer"], "16.3.5"],
  "devDependencies.eslint-config-next": [rootDev["eslint-config-next"], "16.3.5"],
};
for (const [label, [actual, expected]] of Object.entries(expectRoot)) {
  if (actual === expected) pass(`lockfile root ${label} == ${expected}`);
  else fail(`lockfile root ${label} == ${expected}`, `got ${JSON.stringify(actual)}`);
}

// --- Resolved versions: Next advances, map stack stays on base line. ---
function pkgVersion(p) {
  return lock?.packages?.[`node_modules/${p}`]?.version;
}
const expectResolved = {
  next: ["16.3.5", true],
  "@next/bundle-analyzer": ["16.3.5", true],
  "@next/env": ["16.3.5", true],
  "eslint-config-next": ["16.3.5", true],
};
for (const [p, [expected]] of Object.entries(expectResolved)) {
  const actual = pkgVersion(p);
  if (actual === expected) pass(`lockfile resolved ${p}@${expected}`);
  else fail(`lockfile resolved ${p}@${expected}`, `got ${JSON.stringify(actual)}`);
}

// Map stack must NOT contain the rejected majors.
const ml = pkgVersion("maplibre-gl");
if (typeof ml === "string" && ml.startsWith("5.")) pass(`lockfile resolved maplibre-gl stays 5.x (${ml})`);
else fail("lockfile resolved maplibre-gl stays 5.x", `got ${JSON.stringify(ml)} (6.x belongs in a separate map PR)`);

const vt = pkgVersion("@mapbox/vector-tile");
if (vt === "2.0.5") pass("lockfile resolved @mapbox/vector-tile stays 2.0.5");
else fail("lockfile resolved @mapbox/vector-tile stays 2.0.5", `got ${JSON.stringify(vt)} (3.0.0 belongs in a separate map PR)`);

const ub = pkgVersion("@mapbox/unitbezier");
if (ub === "0.0.1") pass("lockfile resolved @mapbox/unitbezier stays 0.0.1");
else fail("lockfile resolved @mapbox/unitbezier stays 0.0.1", `got ${JSON.stringify(ub)} (1.0.0 belongs in a separate map PR)`);

if (lock?.packages?.["node_modules/@mapbox/whoots-js"]) pass("lockfile retains @mapbox/whoots-js@3.1.0");
else fail("lockfile retains @mapbox/whoots-js@3.1.0", "entry missing; removal belongs in a separate map PR, not this backport");

const jl = pkgVersion("@mapbox/jsonlint-lines-primitives");
if (jl === "2.0.2") pass("lockfile resolved jsonlint-lines-primitives stays 2.0.2");
else fail("lockfile resolved jsonlint-lines-primitives stays 2.0.2", `got ${JSON.stringify(jl)} (2.0.3/engines>=22 belongs in a separate map PR)`);

const pbf = pkgVersion("pbf");
if (typeof pbf === "string" && pbf.startsWith("4.")) pass(`lockfile resolved pbf stays 4.x (${pbf})`);
else fail("lockfile resolved pbf stays 4.x", `got ${JSON.stringify(pbf)} (5.x belongs in a separate map PR)`);

if (failures.length > 0) {
  console.log("\nRegenerate cleanly for ONLY the intended Next pins:");
  console.log("  1. Ensure package.json has next 16.3.5 + analyzer/eslint 16.3.5 and maplibre ^5.24.0 / bridge ^0.1.3.");
  console.log("  2. Run: npm install --package-lock-only");
  console.log("  3. Verify: npm ci && node tools/qa/lockfile-scope-guard.mjs");
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nLockfile scope guard passed (Next-only, name intact)");
