import test from "node:test";
import assert from "node:assert/strict";

import {
  getNavigationControlsState,
  getNavigationMapBounds,
} from "./navigation-viewport.ts";

test("getNavigationMapBounds keeps the current map view after route clear", () => {
  assert.equal(getNavigationMapBounds(null), null);
});

test("getNavigationMapBounds fits only active route bounds", () => {
  const bounds = [
    [10.7441, 124.7912],
    [10.7451, 124.7925],
  ] satisfies [[number, number], [number, number]];

  assert.equal(getNavigationMapBounds(bounds), bounds);
});

test("navigation controls expose route reporting only after a route exists", () => {
  assert.deepEqual(
    getNavigationControlsState({
      hasActiveRoute: true,
      isManualStartPending: false,
      isWaitingForLocation: false,
    }),
    {
      primaryActionLabel: "Clear Route",
      canReportRoute: true,
      statusText: null,
    },
  );
});

test("navigation controls use cancel wording while placing a manual start", () => {
  assert.deepEqual(
    getNavigationControlsState({
      hasActiveRoute: false,
      isManualStartPending: true,
      isWaitingForLocation: false,
    }),
    {
      primaryActionLabel: "Cancel Route",
      canReportRoute: false,
      statusText: "Tap the map to place your starting pin",
    },
  );
});

test("navigation controls use cancel wording while waiting for location", () => {
  assert.deepEqual(
    getNavigationControlsState({
      hasActiveRoute: false,
      isManualStartPending: false,
      isWaitingForLocation: true,
    }),
    {
      primaryActionLabel: "Cancel Route",
      canReportRoute: false,
      statusText: "Waiting for your location...",
    },
  );
});
