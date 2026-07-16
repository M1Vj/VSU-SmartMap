import test from "node:test";
import assert from "node:assert/strict";

import {
  filterGraphToRoutingBoundary,
  findClosestTransitionGate,
  isPointInsideRoutingBoundary,
  mergePathsAtTransitionGate,
} from "./transition-gates.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

const node = (id: string, lat: number, lng: number): MapNode => ({
  id,
  lat,
  lng,
  type: "path_middle",
});

test("routing boundary accepts points inside polygon and on transition gates", () => {
  assert.equal(isPointInsideRoutingBoundary({ lat: 10.7445, lng: 124.796 }), true);
  assert.equal(isPointInsideRoutingBoundary({ lat: 10.744749262354008, lng: 124.78503904754665 }), true);
  assert.equal(isPointInsideRoutingBoundary({ lat: 10.755, lng: 124.81 }), false);
});

const CAMPUS_CENTER = { lat: 10.7445, lng: 124.796 };

test("closest transition gate minimizes the total detour", () => {
  const gate = findClosestTransitionGate({ lat: 10.742, lng: 124.809 }, CAMPUS_CENTER);

  assert.equal(gate.id, "gate-east");
});

test("findClosestTransitionGate prefers admin-defined gate nodes when present", () => {
  const graphNodes: MapNode[] = [
    { id: "main-gate", lat: 10.7448, lng: 124.786, type: "gate" },
    { id: "side-gate", lat: 10.746, lng: 124.798, type: "gate" },
    { id: "ordinary", lat: 10.7449, lng: 124.7861, type: "node" },
  ];

  const gate = findClosestTransitionGate(
    { lat: 10.7449, lng: 124.7861 },
    { lat: 10.7448, lng: 124.787 },
    graphNodes,
  );

  assert.equal(gate.id, "main-gate");
});

test("findClosestTransitionGate falls back to boundary gates when no gate nodes exist", () => {
  const graphNodes: MapNode[] = [{ id: "ordinary", lat: 10.7445, lng: 124.796, type: "node" }];

  const gate = findClosestTransitionGate({ lat: 10.742, lng: 124.809 }, CAMPUS_CENTER, graphNodes);

  assert.equal(gate.id, "gate-east");
});

test("an outside start near a side gate routes through that gate, not the main gate", () => {
  // Real report: starts near Ilang Gate were funneled through the main gate.
  const graphNodes: MapNode[] = [
    { id: "main-gate", lat: 10.7446569181352, lng: 124.791995311957, type: "gate" },
    { id: "ilang-gate", lat: 10.7426591363419, lng: 124.79477662133, type: "gate" },
  ];
  const outsideNearIlang = { lat: 10.7415, lng: 124.7952 };
  const destinationNearIlang = { lat: 10.7432, lng: 124.7946 };

  const gate = findClosestTransitionGate(outsideNearIlang, destinationNearIlang, graphNodes);

  assert.equal(gate.id, "ilang-gate");
});

test("filterGraphToRoutingBoundary removes outside nodes and connected edges", () => {
  const nodes = [
    node("inside-a", 10.7445, 124.796),
    node("inside-b", 10.745, 124.797),
    node("outside", 10.755, 124.81),
  ];
  const edges: MapEdge[] = [
    { id: "inside-edge", source_id: "inside-a", target_id: "inside-b", weight: 1, bidirectional: true, type: "walkway" },
    { id: "outside-edge", source_id: "inside-a", target_id: "outside", weight: 1, bidirectional: true, type: "walkway" },
  ];

  const graph = filterGraphToRoutingBoundary(nodes, edges);

  assert.deepEqual(graph.nodes.map((entry) => entry.id), ["inside-a", "inside-b"]);
  assert.deepEqual(graph.edges.map((entry) => entry.id), ["inside-edge"]);
});

test("mergePathsAtTransitionGate emits one continuous path without duplicate gate points", () => {
  const gate = node("gate-east", 10.743422208739132, 124.80770893961328);
  const external = [
    node("public-start", 10.743, 124.81),
    node("external-gate", 10.743422208739132, 124.80770893961328),
  ];
  const internal = [
    node("internal-gate", 10.743422208739132, 124.80770893961328),
    node("destination", 10.744, 124.797),
  ];

  const route = mergePathsAtTransitionGate(external, gate, internal, "walking");

  assert.deepEqual(route.path.map((entry) => entry.id), ["public-start", "external-gate", "destination"]);
  assert.equal(route.estimatedTime !== undefined, true);
});
