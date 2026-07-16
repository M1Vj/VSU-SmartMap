import test from "node:test";
import assert from "node:assert/strict";

import { straightLineEstimate } from "./route-distance.ts";

test("straightLineEstimate returns a labelled approximate walk estimate", () => {
  const estimate = straightLineEstimate(
    { lat: 10.744, lng: 124.792 },
    { lat: 10.745, lng: 124.792 },
  );

  assert.equal(estimate.approximate, true);
  assert.ok(estimate.meters > 100 && estimate.meters < 125, `meters ${estimate.meters}`);
  assert.ok(estimate.minutes >= 1);
});
