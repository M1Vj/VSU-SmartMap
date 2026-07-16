import test from "node:test";
import assert from "node:assert/strict";

import { spreadCoLocatedItems } from "./declutter.ts";

type TestItem = {
  readonly id: string;
  readonly coordinates: {
    readonly lat: number;
    readonly lng: number;
  };
};

const item = (id: string, lat: number, lng: number): TestItem => ({
  id,
  coordinates: { lat, lng },
});

test("separates two co-located items at fan-out zoom", () => {
  const source = [
    item("statistics", 10.745, 124.792),
    item("arts-sciences", 10.745, 124.792),
  ];

  const spread = spreadCoLocatedItems(source, 19);

  assert.equal(spread.length, 2);
  assert.notDeepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.notDeepEqual(spread[1].displayCoordinates, source[1].coordinates);
  assert.notDeepEqual(spread[0].displayCoordinates, spread[1].displayCoordinates);
});

test("places three co-located items at distinct display coordinates", () => {
  const source = [
    item("c", 10.745, 124.792),
    item("a", 10.745, 124.792),
    item("b", 10.745, 124.792),
  ];

  const spread = spreadCoLocatedItems(source, 19);
  const distinct = new Set(
    spread.map(({ displayCoordinates }) =>
      `${displayCoordinates.lat.toFixed(8)},${displayCoordinates.lng.toFixed(8)}`,
    ),
  );

  assert.equal(distinct.size, 3);
});

test("leaves far-apart items at their true coordinates", () => {
  const source = [
    item("library", 10.7468, 124.7955),
    item("admin", 10.7471, 124.7966),
  ];

  const spread = spreadCoLocatedItems(source, 19);

  assert.deepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(spread[1].displayCoordinates, source[1].coordinates);
});

test("returns deterministic display positions for the same items", () => {
  const source = [
    item("department-z", 10.745, 124.792),
    item("college", 10.745, 124.792),
    item("department-a", 10.745, 124.792),
  ];

  const first = spreadCoLocatedItems(source, 19);
  const second = spreadCoLocatedItems(source, 19);

  assert.deepEqual(first, second);
});

test("preserves the original item coordinates", () => {
  const source = [
    item("department", 10.745, 124.792),
    item("college", 10.745000001, 124.792000001),
  ];

  const spread = spreadCoLocatedItems(source, 19);

  assert.deepEqual(spread[0].item.coordinates, source[0].coordinates);
  assert.deepEqual(spread[1].item.coordinates, source[1].coordinates);
  assert.deepEqual(source[0].coordinates, { lat: 10.745, lng: 124.792 });
  assert.deepEqual(source[1].coordinates, { lat: 10.745000001, lng: 124.792000001 });
});

test("keeps co-located groups at their centroid below fan-out zoom", () => {
  const source = [
    item("department", 10.745, 124.792),
    item("college", 10.745000001, 124.792000001),
  ];

  const spread = spreadCoLocatedItems(source, 15);

  assert.deepEqual(spread[0].displayCoordinates, spread[1].displayCoordinates);
  assert.equal(spread[0].displayCoordinates.lat, 10.7450000005);
  assert.equal(spread[0].displayCoordinates.lng, 124.7920000005);
});

test("same-building pins stay true at campus zoom and fan only when the ring is honest", () => {
  // Real case: a department pin ~5m from its college pin. At campus zoom a
  // fan ring would displace pins ~50m, so they stay put (click-to-zoom
  // separates them); at zoom 19 the ring is under a building footprint and
  // engages; fully zoomed in they are naturally separate and ungrouped.
  const source = [
    item("statistics", 10.745, 124.792),
    item("arts-sciences", 10.745, 124.79205),
  ];

  const atCampusZoom = spreadCoLocatedItems(source, 16);
  assert.deepEqual(atCampusZoom[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(atCampusZoom[1].displayCoordinates, source[1].coordinates);

  const atDetailZoom = spreadCoLocatedItems(source, 19);
  assert.notDeepEqual(atDetailZoom[0].displayCoordinates, source[0].coordinates);
  assert.notDeepEqual(
    atDetailZoom[0].displayCoordinates,
    atDetailZoom[1].displayCoordinates,
  );

  const fullyZoomedIn = spreadCoLocatedItems(source, 20);
  assert.deepEqual(fullyZoomedIn[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(fullyZoomedIn[1].displayCoordinates, source[1].coordinates);
});

test("never groups separate buildings into a detached ring", () => {
  // Regression: at campus zoom the pixel tolerance spans ~80m, which chained
  // unrelated buildings into one circle away from their true locations.
  const source = [
    item("building-a", 10.745, 124.792),
    item("building-b", 10.745, 124.79235),
    item("building-c", 10.745, 124.7927),
  ];

  const spread = spreadCoLocatedItems(source, 16);

  assert.deepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(spread[1].displayCoordinates, source[1].coordinates);
  assert.deepEqual(spread[2].displayCoordinates, source[2].coordinates);
});

test("dot zoom keeps merging nearby buildings into one centroid dot", () => {
  // Regression: the anti-ring 12m cap must not apply below fan-out zoom —
  // zoomed out, overlapping dots should still consolidate to a centroid,
  // then separate to their true spots once pins return at zoom 16.
  const source = [
    item("building-a", 10.745, 124.792),
    item("building-b", 10.745, 124.79235),
    item("building-c", 10.745, 124.7927),
  ];

  const atDotZoom = spreadCoLocatedItems(source, 15);
  const distinct = new Set(
    atDotZoom.map(({ displayCoordinates }) =>
      `${displayCoordinates.lat.toFixed(8)},${displayCoordinates.lng.toFixed(8)}`,
    ),
  );
  assert.equal(distinct.size, 1);

  const atPinZoom = spreadCoLocatedItems(source, 16);
  assert.deepEqual(atPinZoom[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(atPinZoom[1].displayCoordinates, source[1].coordinates);
  assert.deepEqual(atPinZoom[2].displayCoordinates, source[2].coordinates);
});

test("large groups scale the fan-out ring so pins stay separated", () => {
  const source = Array.from({ length: 8 }, (_, index) =>
    item(`facility-${index}`, 10.745, 124.792),
  );

  const spread = spreadCoLocatedItems(source, 19);
  const distinct = new Set(
    spread.map(({ displayCoordinates }) =>
      `${displayCoordinates.lat.toFixed(8)},${displayCoordinates.lng.toFixed(8)}`,
    ),
  );

  assert.equal(distinct.size, 8);
});
