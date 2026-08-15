import assert from "node:assert/strict";
import test from "node:test";

import { shouldAppendRequestedEndpoint } from "./route-endpoint.ts";

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
