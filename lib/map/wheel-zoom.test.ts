import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  clampZoomTarget,
  handleZoomControlKey,
  nextZoomTarget,
  MAP_LEAFLET_ZOOM_OPTIONS,
  MAP_ZOOM_ANIMATION_OPTIONS,
} from "./wheel-zoom.ts";

test("zoom targets accumulate exact fractional control steps", () => {
  let target = clampZoomTarget(16, 14, 20);

  target = nextZoomTarget(target, 0.25, 14, 20);
  target = nextZoomTarget(target, 0.25, 14, 20);
  target = nextZoomTarget(target, 0.25, 14, 20);
  target = nextZoomTarget(target, 0.25, 14, 20);

  assert.equal(target, 17);
});

test("zoom targets clamp accumulated values without losing fractional state", () => {
  assert.equal(nextZoomTarget(16, -10, 14, 20), 14);
  assert.equal(nextZoomTarget(14, -0.25, 14, 20), 14);
  assert.equal(nextZoomTarget(14, 10, 14, 20), 20);
  assert.equal(nextZoomTarget(20, 0.25, 14, 20), 20);
  assert.equal(clampZoomTarget(17.125, 14, 20), 17.125);
});

test("bound zoom controls no-op before invoking the flight callback", () => {
  const flights: number[] = [];

  const min = nextZoomTarget(14, -0.25, 14, 20);
  const max = nextZoomTarget(20, 0.25, 14, 20);
  if (min !== 14) flights.push(min);
  if (max !== 20) flights.push(max);

  assert.deepEqual(flights, []);
});

test("Enter and Space activate an enabled zoom control without page scrolling", () => {
  const events = ["Enter", " "].map((key) => {
    let prevented = false;
    let stopped = false;
    let activations = 0;
    const handled = handleZoomControlKey(
      {
        key,
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: () => {
          stopped = true;
        },
      },
      false,
      () => {
        activations += 1;
      },
    );
    return { handled, prevented, stopped, activations };
  });

  assert.deepEqual(events, [
    { handled: true, prevented: true, stopped: true, activations: 1 },
    { handled: true, prevented: true, stopped: true, activations: 1 },
  ]);
});

test("disabled or unrelated keys never activate zoom", () => {
  let activations = 0;
  let prevented = 0;
  let stopped = 0;
  const makeEvent = (key: string) => ({
    key,
    preventDefault: () => {
      prevented += 1;
    },
    stopPropagation: () => {
      stopped += 1;
    },
  });

  assert.equal(handleZoomControlKey(makeEvent("Enter"), true, () => activations++), true);
  assert.equal(handleZoomControlKey(makeEvent("ArrowUp"), false, () => activations++), false);
  assert.equal(activations, 0);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});

test("map zoom options use Leaflet's supported native input lifecycle", () => {
  assert.deepEqual(MAP_LEAFLET_ZOOM_OPTIONS, {
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    keyboard: true,
    zoomSnap: 0,
    zoomDelta: 0.25,
    wheelDebounceTime: 16,
    wheelPxPerZoomLevel: 120,
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
