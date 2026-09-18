// Hermetic verification for the postcss-selector-parser 6.1.2 -> 6.1.4 bump.
// No network, no mocks, no global monkey-patching. Reads only local
// package-lock.json and the locally installed package, then exercises the
// real parser (CVE-2026-9358 PoC + non-node serialization regression).
//
// Gating: set SKIP_POSTCSS_VERIFY=1 to skip with a clear reason (e.g. a CI
// job that does not install dev dependencies). Otherwise the check is
// fail-fast: any mismatch exits non-zero.
//
// Usage:
//   node tools/verify-postcss-selector-parser.mjs
//   SKIP_POSTCSS_VERIFY=1 node tools/verify-postcss-selector-parser.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");

const EXPECTED_VERSION = "6.1.4";
const EXPECTED_INTEGRITY =
  "sha512-bIoJLOmjCO1S9XdY/DcnR5hJxvrDir1PbGChrzXG3vw0/FOliy/fA3dmdhQ441kah4gKv+TwckGzex6wNS5cnQ==";
const EXPECTED_RESOLVED =
  "https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-6.1.4.tgz";

function fail(message) {
  console.error(`[verify-postcss-selector-parser] FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[verify-postcss-selector-parser] PASS: ${message}`);
}

if (process.env.SKIP_POSTCSS_VERIFY === "1") {
  console.log(
    "[verify-postcss-selector-parser] SKIP: SKIP_POSTCSS_VERIFY=1 is set (documented skip for jobs without a lockfile install).",
  );
  process.exit(0);
}

const lockText = await readFile(path.join(REPO_ROOT, "package-lock.json"), "utf8").catch(
  (error) => fail(`cannot read package-lock.json: ${error.message}`),
);
let lockfile;
try {
  lockfile = JSON.parse(String(lockText));
} catch (error) {
  fail(`package-lock.json is not valid JSON: ${error.message}`);
}

// 1. Lockfile pins exactly 6.1.4 with the published integrity/resolved URL,
//    and no 6.1.2 entry remains.
const packages = lockfile.packages ?? {};
const lockEntries = Object.entries(packages).filter(([key]) =>
  key.endsWith("node_modules/postcss-selector-parser"),
);
if (lockEntries.length === 0) {
  fail("no node_modules/postcss-selector-parser entry found in package-lock.json");
}
for (const [key, entry] of lockEntries) {
  if (entry.version !== EXPECTED_VERSION) {
    fail(`${key} pins ${entry.version}, expected ${EXPECTED_VERSION}`);
  }
  if (entry.integrity !== EXPECTED_INTEGRITY) {
    fail(`${key} integrity mismatch: ${entry.integrity}`);
  }
  if (entry.resolved !== EXPECTED_RESOLVED) {
    fail(`${key} resolved mismatch: ${entry.resolved}`);
  }
  pass(`${key} pins ${EXPECTED_VERSION} with published integrity`);
}
if (String(lockText).includes("postcss-selector-parser-6.1.2.tgz")) {
  fail("stale 6.1.2 tarball URL still present in package-lock.json");
}
pass("no stale 6.1.2 tarball reference remains");

// 2. Installed package matches the lockfile (requires `npm ci` first).
const require = createRequire(import.meta.url);
let parser;
let installedVersion;
try {
  parser = require("postcss-selector-parser");
  installedVersion = require("postcss-selector-parser/package.json").version;
} catch (error) {
  fail(
    `cannot load installed postcss-selector-parser (run \`npm ci\` first): ${error.message}`,
  );
}
if (installedVersion !== EXPECTED_VERSION) {
  fail(`installed version is ${installedVersion}, expected ${EXPECTED_VERSION}`);
}
pass(`installed postcss-selector-parser is ${installedVersion}`);

// 3. CVE-2026-9358 remediation: a pathologically deep selector must throw a
//    regular catchable Error naming the nesting-depth guard, never an
//    uncatchable RangeError stack overflow. A shallow selector must still parse.
function deepSelector(depth) {
  let selector = "a";
  for (let i = 0; i < depth; i++) selector = `:not(${selector})`;
  return selector;
}
try {
  const ok = String(parser().processSync(deepSelector(10)));
  if (!ok.includes("a")) fail("shallow selector did not round-trip");
  pass(`shallow nesting (depth 10) parses: ${ok.slice(0, 60)}`);
} catch (error) {
  fail(`shallow selector should parse but threw: ${error.message}`);
}
for (const depth of [300, 5000]) {
  let threw = null;
  try {
    parser().processSync(deepSelector(depth));
  } catch (error) {
    threw = error;
  }
  if (!threw) {
    fail(`deep nesting (depth ${depth}) parsed without error; expected a catchable guard Error`);
  }
  if (threw instanceof RangeError) {
    fail(`deep nesting (depth ${depth}) threw RangeError (unfixed stack overflow)`);
  }
  if (!(threw instanceof Error) || !/nesting depth/i.test(String(threw.message))) {
    fail(`deep nesting (depth ${depth}) threw unexpected error: ${String(threw && threw.message).slice(0, 160)}`);
  }
  pass(`deep nesting (depth ${depth}) throws catchable ${threw.constructor.name}: ${String(threw.message).slice(0, 100)}`);
}

// 4. 6.1.4 non-node serialization regression (7.1.4 equivalent): raw values
//    inserted via replaceWith(array) must coerce via String(child) instead of
//    throwing `child._stringify is not a function`.
try {
  const root = parser().astSync("a");
  root.first.first.replaceWith(["x"]);
  const serialized = root.toString();
  if (serialized !== "x") fail(`non-node serialization produced ${JSON.stringify(serialized)}, expected "x"`);
  pass(`non-node children serialize leniently: ${JSON.stringify(serialized)}`);
} catch (error) {
  fail(`non-node serialization threw: ${error.message}`);
}

// 5. GHSA-rj75-hqrm-r3gf disclosure probe (informational, not a gate): 6.x
//    has no linear-time backport, so flat selectors stay quadratic while 7.1.6
//    is linear. Measured locally: 6.1.4 ~15/93/676ms vs 7.1.6 ~16/16/60ms for
//    2k/10k/30k flat classes. This repo stays on 6.x because tailwindcss@3.4
//    requires ^6.1.2 (major 7 needs a Tailwind v4 migration); exposure is
//    build-time trusted first-party CSS only (see docs assessment).
{
  const sizes = [2000, 10000];
  for (const n of sizes) {
    const flat = Array.from({ length: n }, (_, i) => `.c${i}`).join("");
    const started = Date.now();
    parser().processSync(flat);
    console.log(
      `[verify-postcss-selector-parser] INFO: flat selector n=${n} parse took ${Date.now() - started}ms on ${installedVersion} (GHSA-rj75 residual on 6.x, build-time only)`,
    );
  }
}

pass("postcss-selector-parser 6.1.4 verification complete");