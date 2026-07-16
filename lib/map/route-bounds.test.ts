import test from "node:test";
import assert from "node:assert/strict";

import { getRouteBounds } from "./route-bounds.ts";

test("getRouteBounds fits only the path extent", () => {
  const bounds = getRouteBounds([
    { lat: 10.7445, lng: 124.79194 },
    { lat: 10.7451, lng: 124.7925 },
    { lat: 10.7441, lng: 124.7912 },
  ]);

  assert.deepEqual(bounds, [
    [10.7441, 124.7912],
    [10.7451, 124.7925],
  ]);
});

test("getRouteBounds returns null for empty paths", () => {
  assert.equal(getRouteBounds([]), null);
});
