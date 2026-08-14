import assert from "node:assert/strict";
import test from "node:test";

import {
  beginRouteRequest,
  canReuseCommittedRoute,
  clearRouteCommit,
  commitRoute,
  failRouteRequest,
  type RouteCommitState,
} from "./route-commit-state.ts";
import type { PathResult } from "@/lib/types/graph";

const firstContext = {
  destinationId: "facility-a",
  start: { lat: 10, lng: 20 },
  end: { lat: 11, lng: 21 },
  mode: "walking" as const,
  origin: "live" as const,
};
const secondContext = {
  destinationId: "facility-b",
  start: { lat: 10, lng: 20 },
  end: { lat: 12, lng: 22 },
  mode: "walking" as const,
  origin: "live" as const,
};
const firstRoute: PathResult = {
  path: [{ id: "first", lat: 10, lng: 20, type: "node" }],
  totalDistance: 100,
  estimatedTime: 2,
};
const secondRoute: PathResult = {
  path: [{ id: "second", lat: 10, lng: 20, type: "node" }],
  totalDistance: 200,
  estimatedTime: 4,
};

function committedState(): RouteCommitState {
  return commitRoute(
    beginRouteRequest(clearRouteCommit(), firstContext),
    firstContext,
    firstRoute,
  );
}

test("a pending replacement keeps the old route identity and metrics", () => {
  const state = beginRouteRequest(committedState(), secondContext);

  assert.equal(state.committed?.destinationId, "facility-a");
  assert.equal(state.committed?.route.totalDistance, 100);
  assert.equal(state.pending?.destinationId, "facility-b");
});

test("a committed route is reusable only when its request context is unchanged", () => {
  const committed = committedState().committed;

  assert.equal(canReuseCommittedRoute(committed, firstContext), true);
  assert.equal(
    canReuseCommittedRoute(committed, { ...firstContext, destinationId: "facility-b" }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute(committed, {
      ...firstContext,
      start: { lat: firstContext.start.lat + 0.001, lng: firstContext.start.lng },
    }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute(committed, { ...firstContext, end: { lat: 12, lng: 22 } }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute(committed, { ...firstContext, mode: "driving" }),
    false,
  );
});

test("replacement failure retains the old committed route and clears pending state", () => {
  const state = failRouteRequest(beginRouteRequest(committedState(), secondContext));

  assert.equal(state.committed?.destinationId, "facility-a");
  assert.equal(state.committed?.route.totalDistance, 100);
  assert.equal(state.pending, null);
});

test("replacement success atomically swaps route and identity", () => {
  const state = commitRoute(
    beginRouteRequest(committedState(), secondContext),
    secondContext,
    secondRoute,
  );

  assert.equal(state.committed?.destinationId, "facility-b");
  assert.equal(state.committed?.route.totalDistance, 200);
  assert.equal(state.pending, null);
});

test("stale results cannot be represented as a commit for the pending request", () => {
  const pending = beginRouteRequest(committedState(), secondContext);
  const stale = commitRoute(pending, firstContext, firstRoute);

  assert.equal(stale.committed?.destinationId, "facility-a");
  assert.equal(stale.committed?.route.totalDistance, 100);
  assert.equal(stale.pending?.destinationId, "facility-b");
});

test("explicit clear removes committed and pending route state", () => {
  assert.deepEqual(
    clearRouteCommit(),
    { committed: null, pending: null },
  );
});

test("a deferred completion cannot resurrect a route after explicit clear", () => {
  const pending = beginRouteRequest(clearRouteCommit(), firstContext);
  const cleared = clearRouteCommit();

  assert.deepEqual(commitRoute(cleared, firstContext, firstRoute), cleared);
  assert.equal(pending.pending?.destinationId, "facility-a");
});

test("a completion without a pending request is ignored", () => {
  const cleared = clearRouteCommit();

  assert.deepEqual(commitRoute(cleared, firstContext, firstRoute), cleared);
});
