import assert from "node:assert/strict";
import test from "node:test";

import { resolveMapGraphSnapshotResult, saveMapGraph } from "./navigation.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

const node = (id: string): MapNode => ({
  id,
  lat: 10.744 + id.length / 10_000,
  lng: 124.794 + id.length / 10_000,
  type: "node",
});

const edge = (
  id: string,
  source_id: string,
  target_id: string,
  bidirectional = true,
): MapEdge => ({
  id,
  source_id,
  target_id,
  weight: 0,
  bidirectional,
  type: "walkway",
  access: ["walking"],
});

interface FakeState {
  revision: number;
  map_nodes: MapNode[];
  map_edges: MapEdge[];
}

interface FakeOptions {
  failReplace?: boolean;
}

/** A transaction-shaped fake: a failed RPC leaves every committed value intact. */
function createFakeClient(initial: FakeState, options: FakeOptions = {}) {
  const state: FakeState = {
    revision: initial.revision,
    map_nodes: [...initial.map_nodes],
    map_edges: [...initial.map_edges],
  };

  const client = {
    rpc: async (name: string, args: { p_expected_revision: number; p_nodes: MapNode[]; p_edges: MapEdge[] }) => {
      assert.equal(name, "replace_map_graph");
      if (options.failReplace) {
        return { data: null, error: new Error("simulated atomic failure") };
      }
      if (args.p_expected_revision !== state.revision) {
        return { data: null, error: Object.assign(new Error("stale graph revision"), { code: "P0002" }) };
      }
      state.map_nodes = [...args.p_nodes];
      state.map_edges = [...args.p_edges];
      state.revision += 1;
      return { data: state.revision, error: null };
    },
  };

  return { client, state };
}

test("saveMapGraph leaves the last committed graph and revision intact on RPC failure", async () => {
  const existingNodes = [node("a"), node("b")];
  const existingEdges = [edge("old", "a", "b")];
  const nextNodes = [...existingNodes, node("c")];
  const nextEdges = [...existingEdges, edge("new", "b", "c", false)];
  const { client, state } = createFakeClient(
    { revision: 4, map_nodes: existingNodes, map_edges: existingEdges },
    { failReplace: true },
  );

  const result = await saveMapGraph(nextNodes, nextEdges, 4, client as never);

  assert.ok(result.error);
  assert.equal(state.revision, 4);
  assert.deepEqual(state.map_nodes, existingNodes);
  assert.deepEqual(state.map_edges, existingEdges);
});

test("resolveMapGraphSnapshotResult does not turn a failed snapshot into an empty graph", () => {
  const nodes = [node("a"), node("b")];
  const edges = [edge("old", "a", "b")];

  assert.deepEqual(
    resolveMapGraphSnapshotResult({
      data: [{ revision: 3, nodes, edges }],
      error: null,
    }),
    { revision: 3, nodes, edges },
  );

  assert.throws(
    () =>
      resolveMapGraphSnapshotResult({
        data: null,
        error: new Error("snapshot unavailable"),
      }),
    /snapshot unavailable/,
  );
});

test("saveMapGraph round-trips retained and new edges, including reverse one-way pairs", async () => {
  const existingNodes = [node("a"), node("b")];
  const existingEdges = [edge("a-to-b", "a", "b", false)];
  const nextNodes = [...existingNodes, node("c")];
  const nextEdges = [
    ...existingEdges,
    edge("b-to-a", "b", "a", false),
    edge("a-to-c", "a", "c", true),
  ];
  const { client, state } = createFakeClient({
    revision: 0,
    map_nodes: existingNodes,
    map_edges: existingEdges,
  });

  const result = await saveMapGraph(nextNodes, nextEdges, 0, client as never);

  assert.equal(result.error, null);
  assert.equal(result.revision, 1);
  assert.deepEqual(state.map_nodes, nextNodes);
  assert.deepEqual(state.map_edges, nextEdges);
});

test("saveMapGraph rejects a second caller that reuses a committed revision", async () => {
  const initialNodes = [node("a"), node("b")];
  const initialEdges = [edge("old", "a", "b", false)];
  const { client, state } = createFakeClient({
    revision: 9,
    map_nodes: initialNodes,
    map_edges: initialEdges,
  });

  const first = await saveMapGraph(initialNodes, initialEdges, 9, client as never);
  const second = await saveMapGraph(
    [...initialNodes, node("c")],
    [...initialEdges, edge("new", "b", "c", false)],
    9,
    client as never,
  );

  assert.equal(first.error, null);
  assert.equal(first.revision, 10);
  assert.equal(second.revision, null);
  assert.equal((second.error as { code?: string }).code, "P0002");
  assert.equal(state.revision, 10);
  assert.deepEqual(state.map_nodes, initialNodes);
  assert.deepEqual(state.map_edges, initialEdges);
});
