import test from "node:test";
import assert from "node:assert/strict";

import { canUseStraightRouteFallback } from "./external-route-policy.ts";

test("straight-line fallback is allowed only for fully internal campus routes", () => {
  assert.equal(
    canUseStraightRouteFallback({ startInsideRoutingBoundary: true, endInsideRoutingBoundary: true }),
    true,
  );
  assert.equal(
    canUseStraightRouteFallback({ startInsideRoutingBoundary: true, endInsideRoutingBoundary: false }),
    false,
  );
  assert.equal(
    canUseStraightRouteFallback({ startInsideRoutingBoundary: false, endInsideRoutingBoundary: true }),
    false,
  );
  assert.equal(
    canUseStraightRouteFallback({ startInsideRoutingBoundary: false, endInsideRoutingBoundary: false }),
    false,
  );
});
