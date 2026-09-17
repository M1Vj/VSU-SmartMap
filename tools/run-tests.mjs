import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const nodeMajorVersion = Number.parseInt(process.versions.node, 10);

// Hermetic preload: bridges `mock.module("@/...")` through the tsx-aware
// resolver on Node 20 (where mock specifiers bypass customization hooks)
// and polyfills `globalThis.navigator` when missing. On Node 22 it resolves
// to the identical file URL, so mock identity is preserved on both versions.
// tsx must load first so `createRequire(caller).resolve("@/...")` inside the
// setup honors tsconfig paths.
const SETUP_URL = new URL("./test-setup.mjs", import.meta.url).href;
const SETUP_PATH = fileURLToPath(SETUP_URL);
if (!existsSync(SETUP_PATH)) {
  console.error(`Missing hermetic test preload: ${SETUP_PATH}`);
  process.exit(1);
}

const testFiles = (await Promise.all(TEST_ROOTS.map(collectTestFiles)))
  .flat()
  .sort();

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    "--import",
    SETUP_URL,
    "--test",
    ...testFiles.map((filePath) =>
      toNodeTestArgument(filePath, nodeMajorVersion),
    ),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

child.on("error", (error) => {
  console.error("Unable to start the test runner:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});