import test from "node:test";
import assert from "node:assert/strict";

import { findPath } from "./astar.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

const node = (id: string, lat: number, lng: number): MapNode => ({
  id,
  lat,
  lng,
  type: "path_middle",
});

const edge = (id: string, source: string, target: string, weight: number): MapEdge => ({
  id,
  source_id: source,
  target_id: target,
  weight,
  type: "walkway",
  bidirectional: true,
});

test("findPath returns only the optimal route", () => {
  const nodes = [
    node("A", 0, 0),
    node("B", 0, 0.001),
    node("C", 0, 0.002),
    node("D", 0, 0.003),
    node("E", 0.001, 0.001),
  ];

  const edges = [
    edge("ab", "A", "B", 1),
    edge("bc", "B", "C", 1),
    edge("cd", "C", "D", 1),
    edge("ae", "A", "E", 2),
    edge("ed", "E", "D", 2),
  ];

  const route = findPath(nodes, edges, "A", "D", "walking");

  assert.deepEqual(route?.path.map((pathNode) => pathNode.id), ["A", "B", "C", "D"]);
});
