import assert from "node:assert/strict";
import test from "node:test";

import type { PathResult } from "@/lib/types/graph";
import {
  beginRouteRequest,
  clearRouteCommit,
  commitRoute,
  failRouteRequest,
} from "./route-commit-state.ts";
import { getRouteFacingDestination } from "./route-facing-destination.ts";

const contextA = {
  destinationId: "facility-a",
  start: { lat: 10, lng: 20 },
  end: { lat: 11, lng: 21 },
  mode: "walking" as const,
  origin: "live" as const,
};
const contextB = {
  destinationId: "facility-b",
  start: { lat: 10, lng: 20 },
  end: { lat: 12, lng: 22 },
  mode: "walking" as const,
  origin: "live" as const,
};
const route: PathResult = {
  path: [{ id: "route", lat: 10, lng: 20, type: "node" }],
  totalDistance: 100,
  estimatedTime: 2,
};

test("camera destination stays committed through pending and failed replacement, then swaps atomically", () => {
  const committedA = commitRoute(beginRouteRequest(clearRouteCommit(), contextA), contextA, route);
  const pendingB = beginRouteRequest(committedA, contextB);

  assert.deepEqual(getRouteFacingDestination(pendingB, null), contextA.end);
  assert.deepEqual(getRouteFacingDestination(failRouteRequest(pendingB), null), contextA.end);

  const committedB = commitRoute(pendingB, contextB, route);
  assert.deepEqual(getRouteFacingDestination(committedB, null), contextB.end);
  assert.equal(getRouteFacingDestination(clearRouteCommit(), null), null);
});

test("pending destination is used before the first route has committed", () => {
  const pending = beginRouteRequest(clearRouteCommit(), contextB);

  assert.deepEqual(getRouteFacingDestination(pending, null), contextB.end);
  assert.deepEqual(getRouteFacingDestination(clearRouteCommit(), { lat: 13, lng: 23 }), {
    lat: 13,
    lng: 23,
  });
});
