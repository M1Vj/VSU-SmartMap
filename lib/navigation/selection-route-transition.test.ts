import assert from "node:assert/strict";
import test from "node:test";

import type { PathResult } from "@/lib/types/graph";
import {
  beginRouteRequest,
  clearRouteCommit,
  commitRoute,
  failRouteRequest,
} from "./route-commit-state.ts";
import { resolveRouteSelectionTransition } from "./selection-route-transition.ts";

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
const routeA: PathResult = {
  path: [{ id: "a", lat: 10, lng: 20, type: "node" }],
  totalDistance: 100,
  estimatedTime: 2,
};
const routeB: PathResult = {
  path: [{ id: "b", lat: 10, lng: 20, type: "node" }],
  totalDistance: 200,
  estimatedTime: 4,
};

function committedA() {
  return commitRoute(beginRouteRequest(clearRouteCommit(), contextA), contextA, routeA);
}

test("terminal replacement failure keeps both the failed flow owner and committed destination valid", () => {
  const stateAfterFailedB = failRouteRequest(
    beginRouteRequest(committedA(), contextB),
  );

  assert.equal(
    resolveRouteSelectionTransition({
      selectedItemId: contextB.destinationId,
      flowDestinationId: contextB.destinationId,
      routeState: stateAfterFailedB,
      hasNavigationState: true,
    }).kind,
    "retain",
  );

  assert.equal(
    resolveRouteSelectionTransition({
      selectedItemId: contextA.destinationId,
      flowDestinationId: contextB.destinationId,
      routeState: stateAfterFailedB,
      hasNavigationState: true,
    }).kind,
    "retain",
  );

  assert.equal(
    resolveRouteSelectionTransition({
      selectedItemId: "facility-c",
      flowDestinationId: contextB.destinationId,
      routeState: stateAfterFailedB,
      hasNavigationState: true,
    }).kind,
    "clear",
  );
});

test("selecting the committed destination cancels a pending replacement and restores its context", () => {
  const stateWithPendingB = beginRouteRequest(committedA(), contextB);

  const decision = resolveRouteSelectionTransition({
    selectedItemId: contextA.destinationId,
    flowDestinationId: contextB.destinationId,
    routeState: stateWithPendingB,
    hasNavigationState: true,
  });

  assert.equal(decision.kind, "cancel-replacement");
  if (decision.kind !== "cancel-replacement") return;

  assert.deepEqual(decision.routeState, {
    committed: stateWithPendingB.committed,
    pending: null,
  });
  assert.deepEqual(decision.restoreContext, contextA);
});

test("a deferred replacement completion cannot commit after its replacement was cancelled", () => {
  const stateWithPendingB = beginRouteRequest(committedA(), contextB);
  const decision = resolveRouteSelectionTransition({
    selectedItemId: contextA.destinationId,
    flowDestinationId: contextB.destinationId,
    routeState: stateWithPendingB,
    hasNavigationState: true,
  });

  assert.equal(decision.kind, "cancel-replacement");
  if (decision.kind !== "cancel-replacement") return;

  assert.deepEqual(commitRoute(decision.routeState, contextB, routeB), decision.routeState);
  assert.deepEqual(failRouteRequest(decision.routeState), decision.routeState);
});

test("selecting the committed destination does not cancel a same-destination recalculation", () => {
  const stateWithPendingRecalculation = beginRouteRequest(committedA(), {
    ...contextA,
    start: { lat: 10.5, lng: 20.5 },
  });

  assert.deepEqual(
    resolveRouteSelectionTransition({
      selectedItemId: contextA.destinationId,
      flowDestinationId: contextA.destinationId,
      routeState: stateWithPendingRecalculation,
      hasNavigationState: true,
    }),
    { kind: "retain" },
  );
});

test("without navigation state selection remains a no-op", () => {
  assert.deepEqual(
    resolveRouteSelectionTransition({
      selectedItemId: "facility-c",
      flowDestinationId: null,
      routeState: clearRouteCommit(),
      hasNavigationState: false,
    }),
    { kind: "retain" },
  );
});
