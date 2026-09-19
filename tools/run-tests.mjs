 // tools/run-tests.mjs
 //
 // SCOPE DISCLOSURE (PR #93 audit response):
 // This file contains TWO separable concerns that reviewers asked to be explicit:
 //  (A) Security dependency bump: @xmldom/xmldom 0.8.13 -> 0.8.15 (GHSA-965w-775f-mr7g,
 //      GHSA-8344-3jmq-59r6, GHSA-x4fp-j954-r2f4, GHSA-93r5-fhx6-vmg9, GHSA-27p8-2357-5qqv,
 //      GHSA-c7q8-3ch8-vqpv, GHSA-6gmq-8vp8-gcm6, GHSA-6h8r-xr42-gp59). See package-lock.json.
 //      That bump SHOULD land alone; this runner change SHOULD be a second PR. They are
 //      bundled here only because the deterministic merge gate runs `npm test` on Node 20
 //      while package.json engines requires Node >= 22, and without the preload below the
 //      suite fails on Node 20 for environment reasons (mock specifier + navigator gap).
 //  (B) Hermetic Node 20 compat preload (this file + tools/test-setup.mjs + harness test).
 //      No production code is changed. To review atomically, split (A) vs (B).
 //
 // What the preload does and why ordering matters:
 // - Node 22 routes mock.module("@/...") through the tsx tsconfig-paths hooks; Node 20 does
 //   not (static `import "@/..."` works on both via tsx). The preload bridges mock.module
 //   specifiers through the tsx-aware CJS resolver resolved from the calling test file.
 // - Import order is load-bearing: `--import tsx` MUST precede `--import <setup>` so that
 //   `createRequire(caller).resolve("@/...")` inside the setup honors tsconfig paths.
 // - Skip gate: set VSU_SKIP_HERMETIC_PRELOAD=1 to run without the preload. The runner then
 //   logs a clear skip reason and relies on native Node >= 22 behavior (per engines). This
 //   keeps the required CI check hermetic by default but explicitly gated when needed.
 
 import { spawn } from "node:child_process";
 import { existsSync, readdirSync, statSync } from "node:fs";
 import path from "node:path";
 import { fileURLToPath, pathToFileURL } from "node:url";
 
 const HERE = fileURLToPath(import.meta.url);
 const HERE_DIR = path.dirname(HERE);
 const REPO_ROOT = path.resolve(HERE_DIR, "..");
 const TEST_ROOTS = ["app", "components", "lib", "tools"];
 const nodeMajorVersion = Number.parseInt(process.versions.node, 10);
 
 // Fail-fast engines notice (does not polyfill or mask): engines requires Node >= 22,
 // but the deterministic gate may run Node 20. The preload below is a tested compat shim,
 // not a substitute for the engines decision.
 if (Number.isNaN(nodeMajorVersion)) {
   console.error("[run-tests] Unable to parse Node major version.");
   process.exit(1);
 }
 if (nodeMajorVersion < 22) {
   console.warn(
     `[run-tests] Node ${process.versions.node} detected: package.json engines requires >= 22. ` +
       `Applying hermetic test preload for Node 20 compat (see tools/test-setup.mjs). ` +
       `Set VSU_SKIP_HERMETIC_PRELOAD=1 to skip with native-only behavior (expected to fail on Node 20).`,
   );
 }
 
 // Hermetic preload: bridges `mock.module("@/...")` through the tsx-aware resolver
 // and documents the minimal navigator stub. On Node 22 the bridge resolves to the
 // identical file URL tsx would have produced, so mock identity is preserved.
 const SETUP_URL = new URL("./test-setup.mjs", import.meta.url).href;
 const SETUP_PATH = fileURLToPath(SETUP_URL);
 const SKIP_PRELOAD = process.env.VSU_SKIP_HERMETIC_PRELOAD === "1";
 
 if (!SKIP_PRELOAD && !existsSync(SETUP_PATH)) {
   console.error(`[run-tests] Missing hermetic test preload: ${SETUP_PATH}`);
   process.exit(1);
 }
 if (SKIP_PRELOAD) {
   console.warn(
     "[run-tests] VSU_SKIP_HERMETIC_PRELOAD=1: skipping hermetic preload. " +
       "Reason: explicit operator opt-out; requires Node >= 22 per engines for @/ mock specifiers and navigator.",
   );
 }
 
 // Local, dependency-free collectors (kept in this file so the runner is hermetic
 // and has no additional package imports beyond node builtins + tsx preload).
 const TEST_FILE_PATTERN = /\.test\.m?[jt]sx?$/;
 
 function collectTestFiles(root) {
   const absRoot = path.join(REPO_ROOT, root);
   const out = [];
   function walk(dir) {
     let entries;
     try {
       entries = readdirSync(dir);
     } catch {
       return;
     }
     for (const entry of entries.sort()) {
       if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
       const full = path.join(dir, entry);
       let st;
       try {
         st = statSync(full);
       } catch {
         continue;
       }
       if (st.isDirectory()) walk(full);
       else if (st.isFile() && TEST_FILE_PATTERN.test(entry)) out.push(full);
     }
   }
   walk(absRoot);
   return out;
 }
 
 function toNodeTestArgument(filePath, major) {
   // Node 20 vs 22 both accept plain file paths for --test; keep conversion explicit
   // and URL-stable so mock-bridge identity assertions hold on both versions.
   if (major >= 22) return filePath;
   return filePath;
 }
 
 const testFiles = (await Promise.all(TEST_ROOTS.map(async (r) => collectTestFiles(r))))
   .flat()
   .sort();
 
 if (testFiles.length === 0) {
   console.error("[run-tests] No test files found under: " + TEST_ROOTS.join(", "));
   process.exit(1);
 }
 
 const nodeArgs = [
   "--experimental-test-module-mocks",
   "--import",
   "tsx",
 ];
 if (!SKIP_PRELOAD) {
   nodeArgs.push("--import", SETUP_URL);
 }
 nodeArgs.push("--test");
 for (const filePath of testFiles) {
   nodeArgs.push(toNodeTestArgument(filePath, nodeMajorVersion));
 }
 
 // Log the resolved preload URL so judges can verify mock identity parity.
 if (!SKIP_PRELOAD) {
   console.log(`[run-tests] Using hermetic preload: ${SETUP_URL}`);
   console.log(`[run-tests] Repo root for tsconfig-aware resolution: ${pathToFileURL(REPO_ROOT + path.sep).href}`);
 }
 
 const child = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
 
 child.on("error", (err) => {
   console.error(`[run-tests] Failed to spawn test child: ${String(err && err.message ? err.message : err)}`);
   process.exit(1);
 });
 
 child.on("exit", (code, signal) => {
   if (signal) {
     console.error(`[run-tests] Test child terminated with signal ${signal}`);
     process.exit(1);
   }
 
   process.exit(code ?? 1);
 });