import assert from "node:assert/strict";
import test from "node:test";

import { canAddEditorEdge } from "./editor-edges.ts";
import type { MapEdge } from "@/lib/types/graph";

const makeEdge = (
  source_id: string,
  target_id: string,
  bidirectional: boolean,
): MapEdge => ({
  id: `${source_id}-${target_id}`,
  source_id,
  target_id,
  weight: 0,
  bidirectional,
  type: "walkway",
  access: ["walking"],
});

test("allows a reverse one-way edge beside an existing one-way edge", () => {
  assert.equal(
    canAddEditorEdge([makeEdge("a", "b", false)], {
      sourceId: "b",
      targetId: "a",
      bidirectional: false,
    }),
    true,
  );
});

test("rejects duplicate directed edges and overlaps with two-way edges", () => {
  assert.equal(
    canAddEditorEdge([makeEdge("a", "b", false)], {
      sourceId: "a",
      targetId: "b",
      bidirectional: false,
    }),
    false,
  );
  assert.equal(
    canAddEditorEdge([makeEdge("a", "b", true)], {
      sourceId: "b",
      targetId: "a",
      bidirectional: false,
    }),
    false,
  );
  assert.equal(
    canAddEditorEdge([makeEdge("a", "b", false)], {
      sourceId: "b",
      targetId: "a",
      bidirectional: true,
    }),
    false,
  );
});

test("allows another neighbor edge from the same node", () => {
  assert.equal(
    canAddEditorEdge([makeEdge("a", "b", false)], {
      sourceId: "a",
      targetId: "c",
      bidirectional: false,
    }),
    true,
  );
});
