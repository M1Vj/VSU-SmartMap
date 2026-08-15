import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.MAP_E2E_BASE_URL?.trim();
if (!baseUrl) {
  console.error("MAP_E2E_BASE_URL is required for the deployed map E2E matrix.");
  process.exit(1);
}

const routeALabel = process.env.MAP_E2E_ROUTE_A_LABEL?.trim();
const routeBLabel = process.env.MAP_E2E_ROUTE_B_LABEL?.trim();
if (!routeALabel || !routeBLabel || routeALabel === routeBLabel) {
  console.error("MAP_E2E_ROUTE_A_LABEL and MAP_E2E_ROUTE_B_LABEL must be non-empty and distinct.");
  process.exit(1);
}

const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const requiredReporter = fileURLToPath(new URL("./map-e2e-required-reporter.mjs", import.meta.url));
const extraArgs = process.argv.slice(2);
const hasReporter = extraArgs.some((argument) => argument === "--reporter" || argument.startsWith("--reporter="));
if (hasReporter) {
  console.error("The map E2E release runner owns its fail-closed reporter; remove the custom --reporter option.");
  process.exit(1);
}
const selectionFlags = ["--list", "--grep", "--grep-invert", "--shard", "--project"];
const hasSelectionFlag = extraArgs.some((argument) => selectionFlags.some((flag) => argument === flag || argument.startsWith(`${flag}=`)));
if (hasSelectionFlag) {
  console.error("The map E2E release runner requires the full matrix; selection flags are not allowed.");
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    playwrightCli,
    "test",
    "e2e/map-broad-route-popup.spec.ts",
    ...extraArgs,
    `--reporter=${requiredReporter}`,
  ],
  { stdio: "inherit", env: { ...process.env, MAP_E2E_BASE_URL: baseUrl } },
);

child.on("error", (error) => {
  console.error("Unable to start the map E2E runner:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
