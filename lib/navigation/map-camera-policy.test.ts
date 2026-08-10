import assert from "node:assert/strict";
import test from "node:test";

import {
  doesNavigationOwnViewport,
  getMapCameraPolicy,
} from "./map-camera-policy.ts";

test("normal facility selection performs one animated selection move", () => {
  assert.deepEqual(
    getMapCameraPolicy({ owner: "selection", navigationOwnsViewport: false, reducedMotion: false }),
    { shouldMove: true, animate: true },
  );
});

test("active navigation suppresses the selection move", () => {
  assert.deepEqual(
    getMapCameraPolicy({ owner: "selection", navigationOwnsViewport: true, reducedMotion: false }),
    { shouldMove: false, animate: false },
  );
});

test("route completion does not own a camera move", () => {
  assert.deepEqual(
    getMapCameraPolicy({ owner: "route", navigationOwnsViewport: true, reducedMotion: false }),
    { shouldMove: false, animate: false },
  );
});

test("reduced motion keeps useful moves but disables animation", () => {
  assert.deepEqual(
    getMapCameraPolicy({ owner: "selection", navigationOwnsViewport: false, reducedMotion: true }),
    { shouldMove: true, animate: false },
  );
  assert.deepEqual(
    getMapCameraPolicy({ owner: "route", navigationOwnsViewport: true, reducedMotion: true }),
    { shouldMove: false, animate: false },
  );
});

test("pending navigation owns the camera before the destination is established", () => {
  assert.equal(
    doesNavigationOwnViewport({
      hasDestination: false,
      manualStartPending: false,
      pendingNavigation: true,
    }),
    true,
  );
});

test("selected facility to pending navigation keeps the camera stable while the route resolves", () => {
  const ownsDuringPending = doesNavigationOwnViewport({
    hasDestination: false,
    manualStartPending: false,
    pendingNavigation: true,
  });
  const handoffPolicies = [
    getMapCameraPolicy({
      owner: "selection",
      navigationOwnsViewport: ownsDuringPending,
      reducedMotion: false,
    }),
    getMapCameraPolicy({
      owner: "route",
      navigationOwnsViewport: true,
      reducedMotion: false,
    }),
  ];

  assert.equal(handoffPolicies.filter((policy) => policy.shouldMove).length, 0);
});
