import test from "node:test";
import assert from "node:assert/strict";

import {
  MAP_LEAFLET_ZOOM_OPTIONS,
  MAP_SMOOTH_CONTROL_ZOOM_OPTIONS,
  MAP_SMOOTH_WHEEL_ZOOM_OPTIONS,
  MAP_ZOOM_ANIMATION_OPTIONS,
} from "./wheel-zoom.ts";

test("map zoom options disable Leaflet's batched wheel handler for continuous wheel zoom", () => {
  assert.deepEqual(MAP_LEAFLET_ZOOM_OPTIONS, {
    scrollWheelZoom: false,
    zoomSnap: 0,
    zoomDelta: 0.25,
  });
});

test("shared map zoom options can be spread into every Leaflet map", () => {
  assert.deepEqual(Object.keys(MAP_LEAFLET_ZOOM_OPTIONS).sort(), [
    "scrollWheelZoom",
    "zoomDelta",
    "zoomSnap",
  ]);
});

test("smooth wheel zoom options keep mouse and trackpad zoom responsive without jumpy steps", () => {
  assert.deepEqual(MAP_SMOOTH_WHEEL_ZOOM_OPTIONS, {
    enabled: true,
    easing: 0.32,
    minZoomDelta: 0.001,
    sensitivity: 0.0048,
    settleDelayMs: 140,
  });
});

test("smooth zoom control options use the same small zoom step as the map controls", () => {
  assert.deepEqual(MAP_SMOOTH_CONTROL_ZOOM_OPTIONS, {
    enabled: true,
    zoomDelta: 0.25,
  });
});

test("shared map zoom animation options enable animated zoom controls", () => {
  assert.deepEqual(MAP_ZOOM_ANIMATION_OPTIONS, {
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
  });
});
