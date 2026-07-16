import test from "node:test";
import assert from "node:assert/strict";

import { approxWalkMinutes, formatDistance, haversineMeters } from "./distance.ts";

test("haversineMeters is ~0 for identical points", () => {
  assert.equal(
    Math.round(haversineMeters({ lat: 10.74, lng: 124.79 }, { lat: 10.74, lng: 124.79 })),
    0,
  );
});

test("haversineMeters approximates a known ~111m north step", () => {
  const d = haversineMeters({ lat: 10.744, lng: 124.792 }, { lat: 10.745, lng: 124.792 });
  assert.ok(d > 100 && d < 125, `expected ~111m, got ${d}`);
});

test("approxWalkMinutes floors at 1 and scales by ~75 m/min", () => {
  assert.equal(approxWalkMinutes(10), 1);
  assert.equal(approxWalkMinutes(750), 10);
});

test("formatDistance switches from metres to kilometres", () => {
  assert.equal(formatDistance(120), "120 m");
  assert.equal(formatDistance(1500), "1.5 km");
});
