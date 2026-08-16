import assert from "node:assert/strict";
import test from "node:test";

import type { PathResult } from "@/lib/types/graph";
import {
  isValidPathResult,
  isValidPathResultForEndpoints,
  ROUTE_ENDPOINT_SNAP_TOLERANCE_METERS,
} from "./route-validation";

test("rejects sparse route geometry instead of treating holes as valid nodes", () => {
  const sparsePath = new Array<PathResult["path"][number]>(2);
  sparsePath[0] = { id: "start", lat: 10, lng: 20, type: "node" };

  assert.equal(
    isValidPathResult({ path: sparsePath, totalDistance: 10, estimatedTime: 1 }),
    false,
  );
});

test("accepts dense route geometry with valid coordinates", () => {
  const path: PathResult["path"] = [
    { id: "start", lat: 10, lng: 20, type: "node" },
    { id: "end", lat: 10.001, lng: 20.001, type: "node" },
  ];

  assert.equal(isValidPathResult({ path, totalDistance: 10, estimatedTime: 1 }), true);
});

test("accepts an endpoint snap exactly on the 100m tolerance boundary", () => {
  const latitudeOffset = ROUTE_ENDPOINT_SNAP_TOLERANCE_METERS / (6_371_000 * (Math.PI / 180));
  const start = { lat: 0, lng: 0 };
  const end = { lat: 0, lng: 0.001 };
  const path: PathResult["path"] = [
    { id: "snapped-start", lat: latitudeOffset, lng: 0, type: "node" },
    { id: "end", ...end, type: "node" },
  ];

  assert.equal(
    isValidPathResultForEndpoints({ path, totalDistance: 100, estimatedTime: 1 }, start, end),
    true,
  );
});

test("rejects a close reversed provider path despite both endpoint offsets being tolerated", () => {
  const start = { lat: 0, lng: 0 };
  const end = { lat: 0, lng: 0.0008 };
  const path: PathResult["path"] = [
    { id: "reversed-end", ...end, type: "node" },
    { id: "reversed-start", ...start, type: "node" },
  ];

  assert.equal(
    isValidPathResultForEndpoints({ path, totalDistance: 90, estimatedTime: 1 }, start, end),
    false,
  );
});

test("rejects an ambiguous midpoint endpoint assignment", () => {
  const start = { lat: 0, lng: 0 };
  const end = { lat: 0, lng: 0.0008 };
  const path: PathResult["path"] = [
    { id: "midpoint-north", lat: 0.0004, lng: 0.0004, type: "node" },
    { id: "midpoint-south", lat: -0.0004, lng: 0.0004, type: "node" },
  ];

  assert.equal(
    isValidPathResultForEndpoints({ path, totalDistance: 90, estimatedTime: 1 }, start, end),
    false,
  );
});

test("rejects requested spans shorter than one meter, including a nonzero loop", () => {
  const start = { lat: 0, lng: 0 };
  const shortEnd = { lat: 0.000004, lng: 0 };
  const shortPath: PathResult["path"] = [
    { id: "short-start", ...start, type: "node" },
    { id: "short-end", ...shortEnd, type: "node" },
  ];
  const loopPoint = { lat: 0.0001, lng: 0 };
  const loopPath: PathResult["path"] = [
    { id: "loop-start", ...start, type: "node" },
    { id: "loop-point", ...loopPoint, type: "node" },
    { id: "loop-end", ...start, type: "node" },
  ];

  assert.equal(
    isValidPathResultForEndpoints({ path: shortPath, totalDistance: 1, estimatedTime: 1 }, start, shortEnd),
    false,
  );
  assert.equal(
    isValidPathResultForEndpoints({ path: loopPath, totalDistance: 1, estimatedTime: 1 }, start, start),
    false,
  );
});
