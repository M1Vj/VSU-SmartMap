import assert from "node:assert/strict";
import test from "node:test";

import type { PathResult } from "@/lib/types/graph";
import { isValidPathResult } from "./route-validation";

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
