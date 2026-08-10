import assert from "node:assert/strict";
import test from "node:test";

import type { MapEdge, MapNode } from "@/lib/types/graph";
import {
  decideNavigationConflict,
  resolveNavigationConflictSnapshot,
} from "./navigation-conflict.ts";

const node = (id: string): MapNode => ({ id, lat: 10.744, lng: 124.794, type: "node" });
const edge = (id: string, source_id: string, target_id: string): MapEdge => ({
  id,
  source_id,
  target_id,
  weight: 1,
  bidirectional: true,
  type: "walkway",
  access: ["walking"],
});

test("keeping a draft advances only the revision and requires an intentional save", () => {
  const draft = { nodes: [node("draft")], edges: [] };
  const latest = { revision: 8, nodes: [node("server")], edges: [] };

  assert.deepEqual(decideNavigationConflict(latest, draft, "keep-draft"), {
    choice: "keep-draft",
    revision: 8,
    nodes: draft.nodes,
    edges: draft.edges,
    requiresExplicitSave: true,
  });
});

test("discarding a draft returns the coherent server snapshot for hydration", () => {
  const draft = { nodes: [node("draft")], edges: [] };
  const latest = {
    revision: 9,
    nodes: [node("server-a"), node("server-b")],
    edges: [edge("server-edge", "server-a", "server-b")],
  };

  assert.deepEqual(decideNavigationConflict(latest, draft, "discard-draft"), {
    choice: "discard-draft",
    revision: 9,
    nodes: latest.nodes,
    edges: latest.edges,
    requiresExplicitSave: false,
  });
});

test("a failed snapshot remains an explicit conflict and never becomes an empty graph", () => {
  assert.deepEqual(
    resolveNavigationConflictSnapshot({ data: null, error: new Error("network") }),
    {
      status: "error",
      message: "The latest server graph could not be loaded. Your draft is still preserved.",
    },
  );
});
