import { spawn } from "node:child_process";

import {
  collectTestFiles,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

const TEST_ROOTS = ["app", "components", "lib", "tools"];
const nodeMajorVersion = Number.parseInt(process.versions.node, 10);

// Fail fast on an unsupported toolchain. package.json engines requires
// Node >= 22 and CI (.github/workflows/quality.yml, security.yml) pins
// Node 22. Run with Node 22 instead of shimming Node 20 globals: no
// mock.module reanchoring and no synthetic globalThis.navigator stub.
if (!Number.isSafeInteger(nodeMajorVersion) || nodeMajorVersion < 22) {
  console.error(
    `Refusing to run tests on ${process.version}: Node >= 22 is required ` +
      `(package.json engines, CI pins Node 22). Re-run with Node 22.`,
  );
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