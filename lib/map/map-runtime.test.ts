import assert from "node:assert/strict";
import test from "node:test";
import type { PathResult } from "@/lib/types/graph";
import {
  createInitialMapRuntimeState,
  mapRuntimeReducer,
  type MapRuntimeEvent,
} from "./map-runtime";

const route: PathResult = {
  path: [
    { id: "a", lat: 10, lng: 10, type: "node" },
    { id: "b", lat: 10.001, lng: 10.001, type: "node" },
  ],
  totalDistance: 150,
  estimatedTime: 2,
};

test("runtime derives one presentation state for every navigation phase", () => {
  let state = createInitialMapRuntimeState();
  const events: MapRuntimeEvent[] = [
    { type: "navigation/requested", requestId: 1, destinationId: "facility-1", origin: "live" },
    { type: "navigation/resolving", requestId: 1 },
    { type: "navigation/committed", requestId: 1, route },
  ];

  for (const event of events) state = mapRuntimeReducer(state, event);

  assert.equal(state.navigation.phase, "active");
  assert.equal(state.navigation.committedRoute, route);
  assert.equal(state.presentation.markerMode, "destination-focused");
  assert.equal(state.presentation.controls.primaryAction, "clear");
  assert.equal(state.presentation.announcement, "Route found!");
});

test("stale route results cannot replace the committed route", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-1",
    origin: "live",
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-2",
    origin: "live",
  });

  const stale = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 1,
    route: { ...route, totalDistance: 999 },
  });

  assert.equal(stale.navigation.committedRoute?.totalDistance, 150);
  assert.equal(stale.navigation.pendingRequestId, 2);
  assert.equal(stale.navigation.phase, "refreshing");
});

test("clear explicitly retires the committed route instead of inferring from an empty result array", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-1",
    origin: "manual",
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, { type: "navigation/cleared" });

  assert.equal(state.navigation.phase, "cleared");
  assert.equal(state.navigation.committedRoute, null);
  assert.equal(state.navigation.destinationId, null);
  assert.equal(state.presentation.markerMode, "default");
});

test("refresh and failure preserve the committed overlay and destination-focused presentation", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-1",
    origin: "live",
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-1",
    origin: "live",
  });
  assert.equal(state.navigation.phase, "refreshing");
  assert.equal(state.navigation.committedRoute, route);
  assert.equal(state.presentation.markerMode, "destination-focused");

  state = mapRuntimeReducer(state, {
    type: "navigation/failed",
    requestId: 2,
    message: "provider unavailable",
  });
  assert.equal(state.navigation.phase, "failed");
  assert.equal(state.navigation.committedRoute, route);
  assert.equal(state.presentation.markerMode, "destination-focused");
  assert.equal(state.presentation.controls.canReportRoute, true);
});

test("adapter resolving event cannot hide a committed route during refresh", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, { type: "navigation/requested", requestId: 1, destinationId: "facility-1", origin: "live" });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, { type: "navigation/requested", requestId: 2, destinationId: "facility-1", origin: "live" });
  state = mapRuntimeReducer(state, { type: "navigation/resolving", requestId: 2 });
  assert.equal(state.navigation.phase, "refreshing");
  assert.equal(state.navigation.committedRoute, route);
});
