import test from "node:test";
import assert from "node:assert/strict";
import type { PathResult } from "@/lib/types/graph";
import {
  createInitialMapRuntimeState,
  mapRuntimeReducer,
} from "@/lib/map/map-runtime";

import { shouldRestoreCommittedRouteForSelectedItem } from "./selection-route-reset.ts";

test("restores the committed route only when its destination is selected during a pending replacement", () => {
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-a",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: 2,
    }),
    true,
  );
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-b",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: 2,
    }),
    false,
  );
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-a",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: null,
    }),
    false,
  );
});

test("committed route A survives selecting and dismissing popup B", () => {
  const route: PathResult = {
    path: [
      { id: "a", lat: 10, lng: 10, type: "node" },
      { id: "b", lat: 10.001, lng: 10.001, type: "node" },
    ],
    totalDistance: 150,
    estimatedTime: 2,
  };
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 10, lng: 10 },
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 1,
    route,
    snapshot: {
      destinationId: "facility-a",
      origin: "live",
      mode: "walking",
      start: { lat: 9.9, lng: 9.9 },
      end: { lat: 10, lng: 10 },
    },
  });

  state = mapRuntimeReducer(state, { type: "selection/set", itemId: "facility-b" });
  state = mapRuntimeReducer(state, { type: "selection/cleared" });

  assert.equal(state.navigation.committed?.destinationId, "facility-a");
  assert.equal(state.navigation.committed?.route, route);
});

test("committed route A survives a changed map search", () => {
  const route: PathResult = {
    path: [
      { id: "a", lat: 10, lng: 10, type: "node" },
      { id: "b", lat: 10.001, lng: 10.001, type: "node" },
    ],
    totalDistance: 150,
    estimatedTime: 2,
  };
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 10, lng: 10 },
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 1,
    route,
    snapshot: {
      destinationId: "facility-a",
      origin: "live",
      mode: "walking",
      start: { lat: 9.9, lng: 9.9 },
      end: { lat: 10, lng: 10 },
    },
  });
  const changedSearch = "another facility";

  assert.equal(changedSearch, "another facility");
  assert.equal(state.navigation.committed?.destinationId, "facility-a");
  assert.equal(state.navigation.committed?.route, route);
});
