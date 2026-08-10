import test from "node:test";
import assert from "node:assert/strict";

import { spreadCoLocatedItems } from "./declutter.ts";
import {
  getMapMarkerRenderItems,
  MIN_CLUSTER_EXPANSION_ZOOM,
} from "./marker-clusters.ts";

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

test("combines nearby markers into one cluster at an overview zoom", () => {
  const rendered = getMapMarkerRenderItems(
    [
      item("library", 10.7468, 124.7955),
      item("admin", 10.7471, 124.7956),
      item("gate", 10.7445, 124.7923),
    ],
    15,
  );

  assert.equal(rendered.length, 2);

  const cluster = rendered.find((entry) => entry.renderType === "cluster");
  assert.ok(cluster);
  assert.deepEqual(
    cluster.items.map((entry) => entry.id),
    ["admin", "library"],
  );
  assert.deepEqual(cluster.coordinates, {
    lat: (10.7468 + 10.7471) / 2,
    lng: (124.7955 + 124.7956) / 2,
  });
});

test("keeps individual markers available at detail zoom", () => {
  const source = [
    item("library", 10.7468, 124.7955),
    item("admin", 10.7471, 124.7956),
  ];

  const rendered = getMapMarkerRenderItems(source, 16);

  assert.deepEqual(
    rendered.map((entry) => entry.renderType),
    ["marker", "marker"],
  );
  const markers = rendered.filter((entry) => entry.renderType === "marker");
  assert.deepEqual(
    markers.map((entry) => entry.item.id),
    source.map((entry) => entry.id),
  );
});

test("uses a stable cluster identity when source order changes", () => {
  const source = [
    item("library", 10.7468, 124.7955),
    item("admin", 10.7471, 124.7956),
  ];

  const first = getMapMarkerRenderItems(source, 15);
  const second = getMapMarkerRenderItems([...source].reverse(), 15);

  assert.equal(first[0].renderType, "cluster");
  assert.equal(second[0].renderType, "cluster");
  assert.equal(first[0].id, second[0].id);
});

test("keeps selected and destination markers out of nearby overview clusters", () => {
  const rendered = getMapMarkerRenderItems(
    [
      item("selected", 10.7468, 124.7955),
      item("destination", 10.7468001, 124.7955001),
      item("nearby-a", 10.7468002, 124.7955002),
      item("nearby-b", 10.7468003, 124.7955003),
    ],
    15,
    { protectedIds: new Set(["selected", "destination"]) },
  );

  const markers = rendered.filter((entry) => entry.renderType === "marker");
  assert.deepEqual(
    markers.map((entry) => entry.item.id).filter((id) => id === "selected" || id === "destination").sort(),
    ["destination", "selected"],
  );

  const cluster = rendered.find((entry) => entry.renderType === "cluster");
  assert.ok(cluster);
  assert.deepEqual(
    cluster.items.map((entry) => entry.id),
    ["nearby-a", "nearby-b"],
  );
});

test("keeps every marker individual for low-zoom manual-start taps", () => {
  const source = [
    item("facility-a", 10.7468, 124.7955),
    item("facility-b", 10.7468001, 124.7955001),
    item("facility-c", 10.7468002, 124.7955002),
  ];
  const manualStartProtectedIds = new Set(source.map((entry) => entry.id));

  const rendered = getMapMarkerRenderItems(source, 15, {
    protectedIds: manualStartProtectedIds,
  });

  assert.equal(rendered.length, source.length);
  assert.ok(rendered.every((entry) => entry.renderType === "marker"));
  assert.deepEqual(
    rendered.map((entry) => entry.renderType === "marker" && entry.item.id),
    ["facility-a", "facility-b", "facility-c"],
  );
});

test("cluster expansion reaches a zoom where co-located markers fan out honestly", () => {
  const source = [
    item("facility-a", 10.7468, 124.7955),
    item("facility-b", 10.7468, 124.7955),
  ];

  const spread = spreadCoLocatedItems(source, MIN_CLUSTER_EXPANSION_ZOOM);

  assert.notDeepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.notDeepEqual(spread[0].displayCoordinates, spread[1].displayCoordinates);
});
