import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_NAVIGATION_STATE,
  parseStoredNavigationState,
} from "./use-navigation-persistence";

const now = 1_700_000_000_000;

test("valid persisted navigation retains route metadata for hydration", () => {
  const state = parseStoredNavigationState(
    {
      navStart: { lat: 11.0, lng: 124.0 },
      navEnd: { lat: 11.1, lng: 124.1 },
      destinationId: "facility-a",
      mode: "driving",
      origin: "manual",
      routeStartTime: now - 1_000,
    },
    now,
  );

  assert.deepEqual(state, {
    navStart: { lat: 11.0, lng: 124.0 },
    navEnd: { lat: 11.1, lng: 124.1 },
    destinationId: "facility-a",
    mode: "driving",
    origin: "manual",
    routeStartTime: now - 1_000,
  });
});

test("expired or incomplete persisted navigation cannot resurrect a cleared route", () => {
  assert.strictEqual(
    parseStoredNavigationState(
      {
        navStart: { lat: 11, lng: 124 },
        navEnd: { lat: 11.1, lng: 124.1 },
        destinationId: "facility-a",
        mode: "walking",
        origin: "live",
        routeStartTime: now - (2 * 60 * 60 * 1000),
      },
      now,
    ),
    EMPTY_NAVIGATION_STATE,
  );
  assert.strictEqual(
    parseStoredNavigationState({ navStart: { lat: 11, lng: 124 } }, now),
    EMPTY_NAVIGATION_STATE,
  );
});
