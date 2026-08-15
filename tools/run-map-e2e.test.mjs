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

test("map E2E wrapper rejects selection flags that could report a partial matrix", () => {
  for (const flag of ["--list", "--grep=route", "--grep-invert=route", "--shard=1/2", "--project=chromium"]) {
    const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", flag], {
      cwd: process.cwd(),
      env: { ...process.env, MAP_E2E_BASE_URL: "http://127.0.0.1:3000", MAP_E2E_ROUTE_A_LABEL: "Facility A", MAP_E2E_ROUTE_B_LABEL: "Facility B" },
      encoding: "utf8",
    });
    assert.equal(result.status, 1, flag);
    assert.match(result.stderr, /selection flags|full matrix/i, flag);
    assert.doesNotMatch(result.stderr, /playwright|browser/i, flag);
  }
});

test("map E2E wrapper rejects every extra argument so the release matrix cannot be narrowed or replaced", () => {
  for (const argument of [
    "-g",
    "route",
    "-G",
    "route",
    "--last-failed",
    "--only-changed",
    "--pass-with-no-tests",
    "--test-list=matrix.txt",
    "--test-list-invert=matrix.txt",
    "--no-deps",
    "--browser=chromium",
    "--config=playwright.config.ts",
    "e2e/map-broad-route-popup.spec.ts",
  ]) {
    const result = spawnSync(process.execPath, ["tools/run-map-e2e.mjs", argument], {
      cwd: process.cwd(),
      env: { ...process.env, MAP_E2E_BASE_URL: "http://127.0.0.1:3000", MAP_E2E_ROUTE_A_LABEL: "Facility A", MAP_E2E_ROUTE_B_LABEL: "Facility B" },
      encoding: "utf8",
    });
    assert.equal(result.status, 1, argument);
    assert.match(result.stderr, /full matrix|extra arguments/i, argument);
    assert.doesNotMatch(result.stderr, /playwright|browser/i, argument);
  }
});
