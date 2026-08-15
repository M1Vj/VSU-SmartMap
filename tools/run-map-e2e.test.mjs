import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("map E2E wrapper fails before Playwright when MAP_E2E_BASE_URL is absent", () => {
  const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", "--list"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MAP_E2E_BASE_URL: "",
      MAP_E2E_ROUTE_A_LABEL: "Facility A",
      MAP_E2E_ROUTE_B_LABEL: "Facility B",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAP_E2E_BASE_URL is required/);
  assert.doesNotMatch(result.stderr, /playwright|browser/i);
});

test("map E2E wrapper fails before Playwright when exact route fixtures are absent", () => {
  const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", "--list"], {
    cwd: process.cwd(),
    env: { ...process.env, MAP_E2E_BASE_URL: "http://127.0.0.1:3000", MAP_E2E_ROUTE_A_LABEL: "", MAP_E2E_ROUTE_B_LABEL: "Facility B" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAP_E2E_ROUTE_A_LABEL and MAP_E2E_ROUTE_B_LABEL must be non-empty and distinct/);
  assert.doesNotMatch(result.stderr, /playwright|browser/i);
});

test("map E2E wrapper fails before Playwright when exact route fixtures are duplicated", () => {
  const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", "--list"], {
    cwd: process.cwd(),
    env: { ...process.env, MAP_E2E_BASE_URL: "http://127.0.0.1:3000", MAP_E2E_ROUTE_A_LABEL: "Facility A", MAP_E2E_ROUTE_B_LABEL: "Facility A" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAP_E2E_ROUTE_A_LABEL and MAP_E2E_ROUTE_B_LABEL must be non-empty and distinct/);
  assert.doesNotMatch(result.stderr, /playwright|browser/i);
});

test("map E2E wrapper cannot bypass the required fail-closed reporter", () => {
  const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", "--reporter=line"], {
    cwd: process.cwd(),
    env: { ...process.env, MAP_E2E_BASE_URL: "http://127.0.0.1:3000", MAP_E2E_ROUTE_A_LABEL: "Facility A", MAP_E2E_ROUTE_B_LABEL: "Facility B" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /owns its fail-closed reporter/);
  assert.doesNotMatch(result.stderr, /playwright|browser/i);
});
