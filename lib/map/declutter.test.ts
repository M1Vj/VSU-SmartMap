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

test("keeps exact co-located items as separate source-coordinate entries below fan-out zoom", () => {
  const source = [
    item("department", 10.745, 124.792),
    item("college", 10.745, 124.792),
  ];

  const spread = spreadCoLocatedItems(source, 15);

  assert.equal(spread.length, source.length);
  assert.deepEqual(
    spread.map(({ displayCoordinates }) => displayCoordinates),
    source.map(({ coordinates }) => coordinates),
  );
});

test("keeps one stable render entry per source item below fan-out zoom", () => {
  const source = [
    item("library", 10.7468, 124.7955),
    item("admin", 10.7471, 124.7956),
    item("gate", 10.7445, 124.7923),
  ];

  const spread = spreadCoLocatedItems(source, 15);

  assert.deepEqual(
    spread.map(({ item: renderedItem }) => renderedItem.id),
    source.map(({ id }) => id),
  );
  assert.deepEqual(
    spread.map(({ trueCoordinates }) => trueCoordinates),
    source.map(({ coordinates }) => coordinates),
  );
  assert.equal(spread.length, source.length);
});

test("keeps selected and destination items at true coordinates at overview zoom", () => {
  const source = [
    item("selected", 10.745, 124.792),
    item("destination", 10.7450001, 124.7920001),
    item("nearby-a", 10.7450002, 124.7920002),
    item("nearby-b", 10.7450003, 124.7920003),
  ];

  const spread = spreadCoLocatedItems(source, 15, {
    protectedIds: new Set(["selected", "destination"]),
  });

  assert.equal(spread.length, source.length);
  assert.deepEqual(spread.find(({ item: renderedItem }) => renderedItem.id === "selected")?.displayCoordinates, source[0].coordinates);
  assert.deepEqual(spread.find(({ item: renderedItem }) => renderedItem.id === "destination")?.displayCoordinates, source[1].coordinates);
  assert.deepEqual(
    spread.map(({ item: renderedItem }) => renderedItem.id),
    source.map(({ id }) => id),
  );
});

test("keeps every item at true coordinates when all marker IDs are protected", () => {
  const source = [
    item("facility-a", 10.745, 124.792),
    item("facility-b", 10.7450001, 124.7920001),
    item("facility-c", 10.7450002, 124.7920002),
  ];

  const spread = spreadCoLocatedItems(source, 15, {
    protectedIds: new Set(source.map(({ id }) => id)),
  });

  assert.deepEqual(
    spread.map(({ displayCoordinates }) => displayCoordinates),
    source.map(({ coordinates }) => coordinates),
  );
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

test("overview keeps nearby buildings at distinct source coordinates", () => {
  // Overview keeps every item individually selectable at its true source
  // coordinate; fan-out is only used once pins return at zoom 16.
  const source = [
    item("building-a", 10.745, 124.792),
    item("building-b", 10.745, 124.79235),
    item("building-c", 10.745, 124.7927),
  ];

  const atDotZoom = spreadCoLocatedItems(source, 15);
  assert.deepEqual(
    atDotZoom.map(({ displayCoordinates }) => displayCoordinates),
    source.map(({ coordinates }) => coordinates),
  );

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

test("keeps runtime-owned markers at source coordinates at every zoom boundary", () => {
  const source = [
    item("selected", 10.745, 124.792),
    item("committed", 10.745, 124.792),
    item("pending", 10.745, 124.792),
    item("nearby-a", 10.745, 124.792),
    item("nearby-b", 10.745, 124.792),
  ];
  const protectedIds = new Set(["selected", "committed", "pending"]);

  for (const zoom of [15, 15.99, 16, 16.01, 19, 20]) {
    const spread = spreadCoLocatedItems(source, zoom, { protectedIds });

    for (const protectedId of protectedIds) {
      const rendered = spread.find(({ item: renderedItem }) => renderedItem.id === protectedId);
      const original = source.find(({ id }) => id === protectedId);
      assert.ok(rendered);
      assert.ok(original);
      assert.deepEqual(rendered.displayCoordinates, original.coordinates, `zoom ${zoom}: ${protectedId}`);
    }

    if (zoom >= 19) {
      const unprotected = spread.filter(({ item: renderedItem }) => renderedItem.id.startsWith("nearby-"));
      assert.equal(unprotected.length, 2);
      assert.notDeepEqual(unprotected[0].displayCoordinates, unprotected[1].displayCoordinates);
      assert.notDeepEqual(unprotected[0].displayCoordinates, source[3].coordinates);
      assert.notDeepEqual(unprotected[1].displayCoordinates, source[4].coordinates);
    }
  }
});

test("leaves an all-protected overlap group unchanged at high zoom", () => {
  const source = [
    item("selected", 10.745, 124.792),
    item("committed", 10.745, 124.792),
    item("pending", 10.745, 124.792),
  ];

  const spread = spreadCoLocatedItems(source, 19, {
    protectedIds: new Set(source.map(({ id }) => id)),
  });

  assert.deepEqual(
    spread.map(({ displayCoordinates }) => displayCoordinates),
    source.map(({ coordinates }) => coordinates),
  );
});

test("protected overview markers cannot bridge beyond-tolerance neighbors", () => {
  const source = [
    item("a", 10.745, 124.792),
    item("m-protected", 10.745, 124.7925),
    item("z", 10.745, 124.793),
  ];

  const spread = spreadCoLocatedItems(source, 15, {
    protectedIds: new Set(["m-protected"]),
  });

  assert.deepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(spread[1].displayCoordinates, source[1].coordinates);
  assert.deepEqual(spread[2].displayCoordinates, source[2].coordinates);
});

test("protected fan-out markers cannot bridge beyond-tolerance neighbors", () => {
  const source = [
    item("a", 10.745, 124.792),
    item("m-protected", 10.745, 124.79207),
    item("z", 10.745, 124.79214),
  ];

  const spread = spreadCoLocatedItems(source, 19, {
    protectedIds: new Set(["m-protected"]),
  });

  assert.deepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.deepEqual(spread[1].displayCoordinates, source[1].coordinates);
  assert.deepEqual(spread[2].displayCoordinates, source[2].coordinates);
});
