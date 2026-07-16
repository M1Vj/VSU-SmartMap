import test from "node:test";
import assert from "node:assert/strict";

import {
  VSU_CAMPUS_BOUNDS,
  clampPointToVsuCampus,
  filterGraphToVsuCampus,
  isPointInsideVsuCampus,
} from "./vsu-campus-boundary.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

test("VSU campus bounds match requested lock polygon", () => {
  assert.deepEqual(VSU_CAMPUS_BOUNDS, [
    { lat: 10.814, lng: 124.749348 },
    { lat: 10.822038081627637, lng: 124.7757491696657 },
    { lat: 10.658947200761956, lng: 124.79274733931466 },
    { lat: 10.668224762427302, lng: 124.86089376097551 },
  ]);
});

test("isPointInsideVsuCampus accepts campus points and rejects outside points", () => {
  assert.equal(isPointInsideVsuCampus({ lat: 10.7445, lng: 124.79194 }), true);
  assert.equal(isPointInsideVsuCampus({ lat: 10.9, lng: 124.9 }), false);
});

test("clampPointToVsuCampus keeps route pins inside campus bounds", () => {
  const inside = { lat: 10.7445, lng: 124.79194 };
  assert.deepEqual(clampPointToVsuCampus(inside), inside);

  const clamped = clampPointToVsuCampus({ lat: 10.9, lng: 124.9 });
  assert.equal(isPointInsideVsuCampus(clamped), true);
});

test("filterGraphToVsuCampus removes outside pathfinding nodes and edges", () => {
  const nodes: MapNode[] = [
    { id: "inside-a", lat: 10.7445, lng: 124.79194, type: "node" },
    { id: "inside-b", lat: 10.745, lng: 124.792, type: "node" },
    { id: "outside", lat: 10.9, lng: 124.9, type: "node" },
  ];
  const edges: MapEdge[] = [
    { id: "keep", source_id: "inside-a", target_id: "inside-b", weight: 1, bidirectional: true, type: "walkway" },
    { id: "drop", source_id: "inside-a", target_id: "outside", weight: 1, bidirectional: true, type: "walkway" },
  ];

  const graph = filterGraphToVsuCampus(nodes, edges);

  assert.deepEqual(graph.nodes.map((node) => node.id), ["inside-a", "inside-b"]);
  assert.deepEqual(graph.edges.map((edge) => edge.id), ["keep"]);
});
