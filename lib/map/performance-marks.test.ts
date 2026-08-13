import assert from "node:assert/strict";
import test from "node:test";
import { clearMapPerformanceEvents, getMapPerformanceEvents, markMapPerformance } from "./performance-marks";

test("performance marks retain only bounded numeric privacy-safe events", () => {
  clearMapPerformanceEvents();
  for (let index = 0; index < 80; index += 1) markMapPerformance("route-request", index, index + 4.25);
  const events = getMapPerformanceEvents();
  assert.equal(events.length, 64);
  assert.deepEqual(events[0], { name: "route-request", durationMs: 4.25 });
  assert.equal(Object.keys(events[0]).sort().join(","), "durationMs,name");
});
