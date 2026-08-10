import assert from "node:assert/strict";
import test from "node:test";

import type { MapEdge, MapNode } from "@/lib/types/graph";
import { validateEditorGraph } from "./editor-graph.ts";

const node = (id: string): MapNode => ({
  id,
  lat: 10.744,
  lng: 124.794,
  type: "node",
});

const edge = (
  id: string,
  source_id: string,
  target_id: string,
  bidirectional = false,
): MapEdge => ({
  id,
  source_id,
  target_id,
  weight: 1,
  bidirectional,
  type: "walkway",
  access: ["walking"],
});

test("editor graph validator rejects dangling edges without filtering them", () => {
  const result = validateEditorGraph([node("a")], [edge("e", "a", "missing")]);

  assert.equal(result.ok, false);
  assert.match(result.message, /endpoint|node/i);
});

test("editor graph validator allows opposite one-way pairs", () => {
  const result = validateEditorGraph(
    [node("a"), node("b")],
    [edge("a-b", "a", "b"), edge("b-a", "b", "a")],
  );

  assert.equal(result.ok, true);
});

test("editor graph validator rejects duplicate directions and two-way overlap", () => {
  const duplicate = validateEditorGraph(
    [node("a"), node("b")],
    [edge("one", "a", "b"), edge("two", "a", "b")],
  );
  const overlap = validateEditorGraph(
    [node("a"), node("b")],
    [edge("one", "a", "b", true), edge("two", "b", "a")],
  );

  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /duplicate|direction/i);
  assert.equal(overlap.ok, false);
  assert.match(overlap.message, /two-way|overlap|direction/i);
});

test("editor graph validator catches swap/toggle states before mutation", () => {
  const nodes = [node("a"), node("b"), node("c")];
  const valid = [edge("a-b", "a", "b"), edge("b-a", "b", "a"), edge("b-c", "b", "c", true)];
  const swapped = valid.map((current) =>
    current.id === "b-a" ? { ...current, source_id: "a", target_id: "b" } : current,
  );

  const result = validateEditorGraph(nodes, swapped);
  const toggled = validateEditorGraph(nodes, [
    { ...valid[0], bidirectional: true },
    valid[1],
    valid[2],
  ]);

  assert.equal(result.ok, false);
  assert.equal(toggled.ok, false);
});
