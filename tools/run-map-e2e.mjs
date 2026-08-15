import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.MAP_E2E_BASE_URL?.trim();
if (!baseUrl) {
  console.error("MAP_E2E_BASE_URL is required for the deployed map E2E matrix.");
  process.exit(1);
}

const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const child = spawn(
  process.execPath,
  [playwrightCli, "test", "e2e/map-broad-route-popup.spec.ts", ...process.argv.slice(2)],
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
