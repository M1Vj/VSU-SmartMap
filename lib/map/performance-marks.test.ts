import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  beginMapPerformanceRequest,
  clearMapPerformanceEvents,
  clearMapPerformanceRequest,
  commitMapPerformanceRequest,
  failMapPerformanceRequest,
  getMapPerformanceEvents,
  markMapPerformance,
} from "./performance-marks";

test("performance marks retain only bounded numeric privacy-safe events", () => {
  clearMapPerformanceEvents();
  for (let index = 0; index < 80; index += 1) markMapPerformance("marker-activation", index, index + 4.25);
  const events = getMapPerformanceEvents();
  assert.equal(events.length, 64);
  assert.deepEqual(events[0], { name: "marker-activation", durationMs: 4.25 });
  assert.equal(Object.keys(events[0]).sort().join(","), "durationMs,name");
});

test("map-ready and marker activation marks retain explicit nonzero durations", () => {
  clearMapPerformanceEvents();
  markMapPerformance("map-ready", 10, 18);
  markMapPerformance("marker-activation", 20, 35);
  assert.deepEqual(getMapPerformanceEvents(), [
    { name: "map-ready", durationMs: 8 },
    { name: "marker-activation", durationMs: 15 },
  ]);
});

test("route marks correlate request start to commit/failure and retire stale or cleared requests", () => {
  clearMapPerformanceEvents();
  beginMapPerformanceRequest(7, 10);
  commitMapPerformanceRequest(7, 35);
  assert.deepEqual(getMapPerformanceEvents().at(-1), { name: "route-commit", durationMs: 25, requestId: 7 });

  beginMapPerformanceRequest(8, 100);
  failMapPerformanceRequest(8, 125);
  assert.deepEqual(getMapPerformanceEvents().at(-1), { name: "route-failure", durationMs: 25, requestId: 8 });

  beginMapPerformanceRequest(13, 500, true);
  commitMapPerformanceRequest(13, 560);
  assert.deepEqual(getMapPerformanceEvents().slice(-2), [
    { name: "route-refresh", durationMs: 60, requestId: 13 },
    { name: "route-commit", durationMs: 60, requestId: 13 },
  ]);

  beginMapPerformanceRequest(9, 200);
  clearMapPerformanceEvents();
  commitMapPerformanceRequest(9, 240);
  assert.equal(getMapPerformanceEvents().length, 0);

  beginMapPerformanceRequest(10, 300);
  clearMapPerformanceRequest(10);
  commitMapPerformanceRequest(10, 340);
  assert.equal(getMapPerformanceEvents().length, 0);

  beginMapPerformanceRequest(11, 400);
  beginMapPerformanceRequest(12, 410);
  commitMapPerformanceRequest(11, 430);
  assert.equal(getMapPerformanceEvents().length, 0);
  commitMapPerformanceRequest(12, 450);
  assert.deepEqual(getMapPerformanceEvents().at(-1), { name: "route-commit", durationMs: 40, requestId: 12 });

  const beforeRetiredRefresh = getMapPerformanceEvents().length;
  beginMapPerformanceRequest(14, 500, true);
  beginMapPerformanceRequest(15, 510, true);
  commitMapPerformanceRequest(14, 530);
  assert.equal(getMapPerformanceEvents().length, beforeRetiredRefresh);
  clearMapPerformanceRequest(15);
  commitMapPerformanceRequest(15, 560);
  assert.equal(getMapPerformanceEvents().length, beforeRetiredRefresh);
});

test("unsupported route-request timing is not exposed", async () => {
  const source = await readFile(new URL("./performance-marks.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /route-request/);
});
