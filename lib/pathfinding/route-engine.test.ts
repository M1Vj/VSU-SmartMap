import assert from "node:assert/strict";
import test from "node:test";
import type { MapEdge, MapNode } from "@/lib/types/graph";
import { findPath } from "./astar";
import {
  createRouteEngine,
  findPreparedNearestEdge,
  findPreparedPath,
  getRouteGraphRevision,
  isPreparedNodeNavigable,
  prepareRouteGraph,
} from "./route-engine";

const nodes: MapNode[] = [
  { id: "a", lat: 10, lng: 10, type: "node" },
  { id: "b", lat: 10, lng: 10.001, type: "node" },
  { id: "c", lat: 10, lng: 10.002, type: "node" },
];
const edges: MapEdge[] = [
  { id: "ab", source_id: "a", target_id: "b", weight: 1, bidirectional: true, type: "walkway" },
  { id: "bc", source_id: "b", target_id: "c", weight: 1, bidirectional: true, type: "walkway" },
];

test("prepared graph indexes identifiers and adjacency once per revision", async () => {
  const prepared = prepareRouteGraph(nodes, edges, "graph-1");
  assert.equal(prepared.nodeById.get("b")?.id, "b");
  assert.equal(prepared.adjacency.get("b")?.length, 2);
  assert.equal(prepared.revision, "graph-1");

  const engine = createRouteEngine();
  assert.equal(engine.setGraph(nodes, edges), true);
  assert.equal(engine.setGraph(nodes, edges), false);
  const result = await engine.route({ startNodeId: "a", endNodeId: "c", mode: "walking" });
  assert.equal(result?.path.map((node) => node.id).join(">"), "a>b>c");
});

test("prepared graph exposes snapping indexes without rescanning route input arrays", () => {
  const prepared = prepareRouteGraph(nodes, edges, "graph-1");
  assert.equal(isPreparedNodeNavigable(prepared, "a", "walking"), true);
  assert.equal(isPreparedNodeNavigable(prepared, "a", "driving"), false);
  assert.equal(findPreparedNearestEdge(prepared, 10, 10.0004, "walking")?.nearestEdge?.id, "ab");
});

test("prepared destination snapping preserves directed-edge navigability", () => {
  const prepared = prepareRouteGraph(
    [nodes[0], nodes[1]],
    [{ ...edges[0], bidirectional: false }],
    "directed",
  );
  assert.equal(isPreparedNodeNavigable(prepared, "a", "walking", true), true);
  assert.equal(isPreparedNodeNavigable(prepared, "b", "walking", false), true);
});

test("route requests honour cancellation before committing work", async () => {
  const engine = createRouteEngine();
  engine.setGraph(nodes, edges);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    engine.route({ startNodeId: "a", endNodeId: "c", mode: "walking", signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("route requests keep the graph snapshot captured before an async yield", async () => {
  const engine = createRouteEngine();
  engine.setGraph(nodes, edges);
  const pending = engine.route({ startNodeId: "a", endNodeId: "c", mode: "walking" });
  engine.setGraph(
    nodes,
    [{ id: "ac", source_id: "a", target_id: "c", weight: 1, bidirectional: true, type: "walkway" }],
  );

  const result = await pending;
  assert.equal(result?.path.map((node) => node.id).join(">"), "a>b>c");
});

test("prepared route lookup can be reused without rebuilding node indexes", () => {
  const prepared = prepareRouteGraph(nodes, edges, "graph-1");
  const first = prepared.nodeById;
  assert.equal(prepared.nodeById, first);
  assert.equal(prepared.nodeById.get("a")?.lat, 10);
});

test("authoritative graph content revision invalidates coordinate, edge, and closure changes", () => {
  const revision = getRouteGraphRevision(nodes, edges);
  assert.ok(revision.length < 100_000);
  assert.match(revision, /^graph-v2-/);
  assert.equal(revision, getRouteGraphRevision([...nodes].reverse(), [...edges].reverse()));
  assert.notEqual(
    revision,
    getRouteGraphRevision([{ ...nodes[0], lat: nodes[0].lat + 0.01 }, ...nodes.slice(1)], edges),
  );
  assert.notEqual(
    revision,
    getRouteGraphRevision(nodes, [{ ...edges[0], weight: edges[0].weight + 1 }, ...edges.slice(1)]),
  );
  assert.notEqual(
    revision,
    getRouteGraphRevision([{ ...nodes[0], is_closed: true }, ...nodes.slice(1)], edges),
  );
  assert.notEqual(
    revision,
    getRouteGraphRevision([{ ...nodes[0], building_ids: ["facility-1"] }, ...nodes.slice(1)], edges),
  );
  assert.notEqual(
    revision,
    getRouteGraphRevision(nodes, [{ ...edges[0], access: ["driving"] }, ...edges.slice(1)]),
  );
});

test("route engine invalidates graphs from canonical content", () => {
  const engine = createRouteEngine();
  assert.equal(engine.setGraph(nodes, edges), true);
  assert.equal(
    engine.setGraph(
      [{ ...nodes[0], lat: nodes[0].lat + 0.01 }, ...nodes.slice(1)],
      edges,
    ),
    true,
  );
});

test("graph revision is stable when schedule object keys arrive in a different order", () => {
  const first = [{ ...nodes[0], closure_daily_schedule: { 1: { start: "08:00", end: "17:00" }, 0: { start: "09:00", end: "16:00" } } }, ...nodes.slice(1)];
  const second = [{ ...nodes[0], closure_daily_schedule: { 0: { start: "09:00", end: "16:00" }, 1: { start: "08:00", end: "17:00" } } }, ...nodes.slice(1)];
  assert.equal(getRouteGraphRevision(first, edges), getRouteGraphRevision(second, edges));
});

test("prepared engine preserves established path and cost semantics for both modes", () => {
  const fixtureNodes: MapNode[] = [
    ...nodes,
    { id: "d", lat: 10.001, lng: 10.002, type: "node" },
  ];
  const fixtureEdges: MapEdge[] = [
    { id: "ab-road", source_id: "a", target_id: "b", weight: 1, bidirectional: true, type: "road", access: ["walking", "driving"] },
    { id: "cd", source_id: "c", target_id: "d", weight: 2, bidirectional: true, type: "road", access: ["walking", "driving"] },
    { id: "bd-road", source_id: "b", target_id: "d", weight: 1, bidirectional: true, type: "road", access: ["walking", "driving"] },
  ];
  const prepared = prepareRouteGraph(fixtureNodes, fixtureEdges, "equivalence");
  for (const mode of ["walking", "driving"] as const) {
    const established = findPath(fixtureNodes, fixtureEdges, "a", "d", mode);
    const preparedResult = findPreparedPath(prepared, "a", "d", mode);
    assert.ok(established);
    assert.ok(preparedResult);
    assert.equal(preparedResult?.path.map((node) => node.id).join(">"), "a>b>d");
    assert.equal(preparedResult?.path.map((node) => node.id).join(">"), established?.path.map((node) => node.id).join(">"));
    assert.equal(preparedResult?.totalDistance, established?.totalDistance);
    assert.equal(preparedResult?.estimatedTime, established?.estimatedTime);
  }
});
