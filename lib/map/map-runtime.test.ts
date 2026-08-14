import assert from "node:assert/strict";
import test from "node:test";
import type { PathResult } from "@/lib/types/graph";
import { shouldClearRouteForSelectedItem } from "@/lib/navigation/selection-route-reset";
import {
  createInitialMapRuntimeState,
  getRouteFacingEndpoint,
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
  assert.equal(state.navigation.selectionDestinationId, "facility-1");
  assert.equal(state.presentation.markerMode, "destination-focused");
  assert.equal(state.presentation.controls.primaryAction, "clear");
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

test("manual start resolution keeps the exact request and updates origin", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 42,
    destinationId: "facility-1",
    origin: "manual",
    awaitingStart: true,
  });
  state = mapRuntimeReducer(state, { type: "navigation/resolving", requestId: 42, origin: "live" });
  assert.equal(state.navigation.pendingRequestId, 42);
  assert.equal(state.navigation.phase, "resolving");
  assert.equal(state.navigation.origin, "live");
  assert.equal(state.presentation.controls.primaryAction, "cancel");
});

test("runtime controls clear the committed route during replacement and failure", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-1",
    origin: "live",
  });
  assert.equal(state.presentation.controls.primaryAction, "cancel");
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  assert.equal(state.presentation.controls.primaryAction, "clear");
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-1",
    origin: "live",
  });
  assert.equal(state.presentation.controls.primaryAction, "clear");
  state = mapRuntimeReducer(state, { type: "navigation/failed", requestId: 2, message: "provider unavailable" });
  assert.equal(state.presentation.controls.primaryAction, "clear");
});

test("replacement keeps the committed route snapshot authoritative until atomic success", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-old",
    origin: "live",
    mode: "walking",
    start: { lat: 10, lng: 10 },
    end: { lat: 10.1, lng: 10.1 },
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });

  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-new",
    origin: "manual",
    mode: "driving",
    start: { lat: 11, lng: 11 },
    end: { lat: 11.1, lng: 11.1 },
  });

  assert.equal(state.navigation.committed?.destinationId, "facility-old");
  assert.equal(state.navigation.committed?.origin, "live");
  assert.equal(state.navigation.committed?.mode, "walking");
  assert.deepEqual(state.navigation.committed?.start, { lat: 10, lng: 10 });
  assert.equal(state.navigation.request?.destinationId, "facility-new");
  assert.equal(state.navigation.request?.origin, "manual");
  assert.equal(state.navigation.request?.mode, "driving");

  state = mapRuntimeReducer(state, { type: "navigation/failed", requestId: 2, message: "provider unavailable" });
  assert.equal(state.navigation.committed?.destinationId, "facility-old");
  assert.equal(state.navigation.request, null);

  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 3,
    destinationId: "facility-new",
    origin: "manual",
    mode: "driving",
    start: { lat: 11, lng: 11 },
    end: { lat: 11.1, lng: 11.1 },
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 3,
    route: { ...route, totalDistance: 250 },
  });
  assert.equal(state.navigation.committed?.destinationId, "facility-new");
  assert.equal(state.navigation.committed?.origin, "manual");
  assert.equal(state.navigation.committed?.mode, "driving");
  assert.equal(state.navigation.committed?.route.totalDistance, 250);

  const stale = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 1,
    route: { ...route, totalDistance: 999 },
  });
  assert.equal(stale.navigation.committed?.destinationId, "facility-new");
  assert.equal(stale.navigation.committed?.route.totalDistance, 250);

  state = mapRuntimeReducer(state, { type: "navigation/cleared" });
  assert.equal(state.navigation.committed, null);
  assert.equal(state.navigation.request, null);
});

test("a fresh recalculation request replaces atomically while stale results remain ignored", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 10,
    destinationId: "facility-a",
    origin: "live",
    mode: "walking",
    start: { lat: 10, lng: 10 },
    end: { lat: 10.1, lng: 10.1 },
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 10,
    route,
  });

  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 11,
    destinationId: "facility-a",
    origin: "manual",
    mode: "driving",
    start: { lat: 11, lng: 11 },
    end: { lat: 10.1, lng: 10.1 },
  });
  state = mapRuntimeReducer(state, { type: "navigation/resolving", requestId: 11 });
  assert.equal(state.navigation.phase, "refreshing");
  assert.equal(state.navigation.pendingRequestId, 11);
  assert.equal(state.navigation.committed?.mode, "walking");
  assert.deepEqual(state.navigation.committed?.start, { lat: 10, lng: 10 });

  const stale = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 10,
    route: { ...route, totalDistance: 999 },
  });
  assert.equal(stale.navigation.committed?.route.totalDistance, route.totalDistance);
  assert.equal(stale.navigation.pendingRequestId, 11);

  const committed = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 11,
    route: { ...route, totalDistance: 220 },
  });
  assert.equal(committed.navigation.committed?.mode, "driving");
  assert.deepEqual(committed.navigation.committed?.start, { lat: 11, lng: 11 });
  assert.equal(committed.navigation.committed?.route.totalDistance, 220);
});

test("selection ownership survives a failed replacement without relabeling the committed route", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 10, lng: 10 },
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-b",
    origin: "manual",
    end: { lat: 11, lng: 11 },
  });

  assert.equal(state.navigation.selectionDestinationId, "facility-b");
  state = mapRuntimeReducer(state, {
    type: "navigation/failed",
    requestId: 2,
    message: "provider unavailable",
  });

  assert.equal(state.navigation.committed?.destinationId, "facility-a");
  assert.equal(state.navigation.selectionDestinationId, "facility-b");
  assert.equal(state.navigation.request, null);
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-b",
      routeDestinationId: state.navigation.selectionDestinationId,
      hasNavigationState: true,
    }),
    false,
  );
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "unrelated",
      routeDestinationId: state.navigation.selectionDestinationId,
      hasNavigationState: true,
    }),
    true,
  );

  state = mapRuntimeReducer(state, { type: "navigation/cleared" });
  assert.equal(state.navigation.selectionDestinationId, null);
});

test("route-facing endpoint stays committed during a pending or failed replacement", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 10, lng: 10 },
  });
  assert.deepEqual(getRouteFacingEndpoint(state, { lat: 12, lng: 12 }), { lat: 10, lng: 10 });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-b",
    origin: "manual",
    end: { lat: 11, lng: 11 },
  });

  assert.deepEqual(getRouteFacingEndpoint(state, { lat: 12, lng: 12 }), { lat: 10, lng: 10 });
  state = mapRuntimeReducer(state, {
    type: "navigation/failed",
    requestId: 2,
    message: "provider unavailable",
  });
  assert.deepEqual(getRouteFacingEndpoint(state, { lat: 12, lng: 12 }), { lat: 10, lng: 10 });
});

test("awaiting a replacement start keeps manual controls available over the committed overlay", () => {
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 10, lng: 10 },
  });
  state = mapRuntimeReducer(state, { type: "navigation/committed", requestId: 1, route });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-b",
    origin: "manual",
    awaitingStart: true,
    end: { lat: 11, lng: 11 },
  });

  assert.equal(state.navigation.phase, "acquiring");
  assert.equal(state.navigation.committed?.destinationId, "facility-a");
  assert.equal(state.navigation.committedRoute, route);
  assert.equal(state.presentation.controls.primaryAction, "clear");
  assert.equal(state.presentation.controls.canReportRoute, true);
  assert.equal(state.presentation.controls.statusText, "Waiting for your location...");

  state = mapRuntimeReducer(state, {
    type: "navigation/resolving",
    requestId: 2,
    origin: "manual",
    start: { lat: 9, lng: 9 },
  });
  assert.equal(state.navigation.phase, "refreshing");
  assert.equal(state.navigation.committedRoute, route);
});
