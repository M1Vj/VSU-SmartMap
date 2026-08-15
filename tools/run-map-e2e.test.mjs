import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("map E2E wrapper fails before Playwright when MAP_E2E_BASE_URL is absent", () => {
  const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", "--list"], {
    cwd: process.cwd(),
    env: { ...process.env, MAP_E2E_BASE_URL: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAP_E2E_BASE_URL is required/);
  assert.doesNotMatch(result.stderr, /playwright|browser/i);
});
