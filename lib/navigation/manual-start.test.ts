import test from "node:test";
import assert from "node:assert/strict";

import { clampPointToVsuCampus, isPointInsideVsuCampus } from "@/lib/map/vsu-campus-boundary";
import { createManualStartPoint, resolveNavigationStart } from "./manual-start.ts";

test("resolveNavigationStart requests a manual pin when there is no live position", () => {
  const result = resolveNavigationStart(null);

  assert.deepEqual(result, {
    mode: "manual",
    start: null,
  });
});

test("resolveNavigationStart uses the live position when it exists", () => {
  const result = resolveNavigationStart({
    coords: {
      latitude: 10.73125,
      longitude: 124.79421,
    },
  });

  assert.deepEqual(result, {
    mode: "live",
    start: {
      lat: 10.73125,
      lng: 124.79421,
    },
  });
});

test("resolveNavigationStart clamps live positions outside the map border to the campus edge", () => {
  const result = resolveNavigationStart({
    coords: {
      latitude: 10.9,
      longitude: 124.9,
    },
  });
  const clamped = clampPointToVsuCampus({ lat: 10.9, lng: 124.9 });

  assert.deepEqual(result, {
    mode: "live",
    start: clamped,
  });
  assert.equal(isPointInsideVsuCampus(result.start), true);
});

test("createManualStartPoint turns a map click into a route start point", () => {
  const start = createManualStartPoint({
    lat: 10.7319,
    lng: 124.7955,
  });

  assert.deepEqual(start, {
    lat: 10.7319,
    lng: 124.7955,
  });
});
