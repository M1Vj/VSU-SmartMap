import assert from "node:assert/strict";
import test from "node:test";
import type { MapEdge, MapNode } from "@/lib/types/graph";
import { createRouteEngine, getRouteGraphRevision, prepareRouteGraph } from "./route-engine";

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
  assert.equal(engine.setGraph(nodes, edges, "graph-1"), true);
  assert.equal(engine.setGraph(nodes, edges, "graph-1"), false);
  const result = await engine.route({ startNodeId: "a", endNodeId: "c", mode: "walking" });
  assert.equal(result?.path.map((node) => node.id).join(">"), "a>b>c");
});

test("route requests honour cancellation before committing work", async () => {
  const engine = createRouteEngine();
  engine.setGraph(nodes, edges, "graph-1");
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    engine.route({ startNodeId: "a", endNodeId: "c", mode: "walking", signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("prepared route lookup can be reused without rebuilding node indexes", () => {
  const prepared = prepareRouteGraph(nodes, edges, "graph-1");
  const first = prepared.nodeById;
  assert.equal(prepared.nodeById, first);
  assert.equal(prepared.nodeById.get("a")?.lat, 10);
});

test("authoritative graph content revision invalidates coordinate, edge, and closure changes", () => {
  const revision = getRouteGraphRevision(nodes, edges);
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
});
