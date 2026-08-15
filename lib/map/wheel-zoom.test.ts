import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MAP_LEAFLET_ZOOM_OPTIONS,
  MAP_ZOOM_ANIMATION_OPTIONS,
} from "./wheel-zoom.ts";

test("map zoom options use Leaflet's supported native input lifecycle", () => {
  assert.deepEqual(MAP_LEAFLET_ZOOM_OPTIONS, {
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    keyboard: true,
    zoomSnap: 0,
    zoomDelta: 0.25,
    wheelDebounceTime: 40,
  });
});

test("private smooth zoom option contracts no longer exist", async () => {
  const source = await readFile(new URL("./wheel-zoom.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /MAP_SMOOTH_(WHEEL|CONTROL)_ZOOM_OPTIONS/);
});

test("shared map zoom animation options enable animated zoom controls", () => {
  assert.deepEqual(MAP_ZOOM_ANIMATION_OPTIONS, {
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
  });
});
