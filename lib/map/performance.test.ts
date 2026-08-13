import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelMapPerformance,
  completeMapPerformance,
  getMapPerformanceSnapshot,
  recordMapPerformance,
  resetMapPerformance,
  startMapPerformance,
} from "./performance.ts";

test("map performance samples stay bounded and contain only fixed metric names", () => {
  resetMapPerformance();

  for (let index = 0; index < 40; index += 1) {
    recordMapPerformance("marker_first_interaction", index);
  }
  recordMapPerformance("route_calculation", 42.5);

  const snapshot = getMapPerformanceSnapshot();
  assert.equal(snapshot.marker_first_interaction.count, 32);
  assert.equal(snapshot.marker_first_interaction.last, 39);
  assert.deepEqual(snapshot.route_calculation, { count: 1, last: 42.5 });
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "marker_first_interaction",
    "route_calculation",
    "route_zoom_continuity",
  ]);
});

test("invalid performance values are ignored without creating unbounded state", () => {
  resetMapPerformance();

  recordMapPerformance("route_calculation", Number.NaN);
  recordMapPerformance("route_calculation", Number.POSITIVE_INFINITY);
  recordMapPerformance("route_calculation", -1);

  assert.deepEqual(getMapPerformanceSnapshot().route_calculation, { count: 0, last: null });
});

test("marker interaction timing completes only after the card is visible", () => {
  resetMapPerformance();

  startMapPerformance("marker_first_interaction", 100);
  completeMapPerformance("marker_first_interaction", 137);

  assert.deepEqual(getMapPerformanceSnapshot().marker_first_interaction, { count: 1, last: 37 });
});

test("pending marker timing can be reset when selection closes before a card renders", () => {
  resetMapPerformance();

  startMapPerformance("marker_first_interaction", 100);
  cancelMapPerformance("marker_first_interaction");
  completeMapPerformance("marker_first_interaction", 137);

  assert.deepEqual(getMapPerformanceSnapshot().marker_first_interaction, { count: 0, last: null });
});
