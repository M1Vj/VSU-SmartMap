import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "map-broad-smoke.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: ".playwright-mcp/map-broad",
  reporter: process.env.CI ? "line" : "list",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.MAP_E2E_BASE_URL ?? localBaseUrl,
    channel: "chrome",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  ...(process.env.MAP_E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run start",
          url: localBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});