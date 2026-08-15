import assert from "node:assert/strict";
import test from "node:test";

import {
  getRenderableRouteEndpoints,
  shouldAppendRequestedEndpoint,
} from "./route-endpoint.ts";

test("empty route geometry has no renderable endpoints", () => {
  assert.equal(getRenderableRouteEndpoints([]), null);
});

test("single-node route geometry reuses the same node for both endpoints", () => {
  const node = { id: "only", lat: 10, lng: 20, type: "node" as const };
  const endpoints = getRenderableRouteEndpoints([node]);

  assert.ok(endpoints);
  assert.strictEqual(endpoints.start, node);
  assert.strictEqual(endpoints.end, node);
});

test("multi-node route geometry reuses the first and final nodes without copying", () => {
  const start = { id: "start", lat: 10, lng: 20, type: "node" as const };
  const middle = { id: "middle", lat: 11, lng: 21, type: "node" as const };
  const end = { id: "end", lat: 12, lng: 22, type: "node" as const };
  const endpoints = getRenderableRouteEndpoints([start, middle, end]);

  assert.ok(endpoints);
  assert.strictEqual(endpoints.start, start);
  assert.strictEqual(endpoints.end, end);
});

test("appends the requested endpoint for a non-building destination snapped to a graph node", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: false,
      snappedNodeType: "node",
    }),
    true,
  );
});

test("does not append the requested endpoint when the destination snaps to a building entry", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: false,
      snappedNodeType: "building_entry",
    }),
    false,
  );
});

test("does not append a centroid segment for a building with entries when no entry is navigable", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: true,
      snappedNodeType: "node",
    }),
    false,
  );
});

test("does not append a requested endpoint for a building when the snapped node type is unavailable", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: true,
      snappedNodeType: undefined,
    }),
    false,
  );
});
