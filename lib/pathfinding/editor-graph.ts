import type { GraphNodeType, MapEdge, MapNode, TransportMode } from "@/lib/types/graph";

const NODE_TYPES: ReadonlySet<GraphNodeType> = new Set([
  "node",
  "building_entry",
  "gate",
  "path_start",
  "path_middle",
  "path_end",
]);

// `cycling` exists in the imported legacy graph even though the current UI
// only creates walking/driving edges. Keep it valid so an unrelated edit can
// round-trip those rows without silently changing their access metadata.
const ACCESS_MODES: ReadonlySet<string> = new Set(["walking", "driving", "cycling"]);

export type EditorGraphValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): EditorGraphValidationResult => ({
  ok: false,
  code,
  message,
});

const endpointPair = (sourceId: string, targetId: string) =>
  sourceId < targetId ? `${sourceId}\u0000${targetId}` : `${targetId}\u0000${sourceId}`;

/**
 * Validate the entire graph before applying an editor mutation or sending a
 * save. The API/server repeats these checks; this function exists to prevent
 * the editor from ever creating a dangling or directionally ambiguous draft.
 */
export function validateEditorGraph(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
): EditorGraphValidationResult {
  const nodeIds = new Set<string>();

  for (const node of nodes) {
    if (!node || typeof node.id !== "string" || node.id.length === 0) {
      return fail("invalid_node_id", "Each node must have an id.");
    }
    if (nodeIds.has(node.id)) {
      return fail("duplicate_node_id", "Duplicate node ids are not allowed.");
    }
    nodeIds.add(node.id);

    if (!Number.isFinite(node.lat) || node.lat < -90 || node.lat > 90) {
      return fail("invalid_latitude", "Node latitude must be a finite value between -90 and 90.");
    }
    if (!Number.isFinite(node.lng) || node.lng < -180 || node.lng > 180) {
      return fail("invalid_longitude", "Node longitude must be a finite value between -180 and 180.");
    }
    if (!NODE_TYPES.has(node.type)) {
      return fail("invalid_node_type", "Node type is not supported.");
    }
  }

  const edgeIds = new Set<string>();
  const directedEdges = new Set<string>();
  const pairEdges = new Map<string, MapEdge[]>();

  for (const edge of edges) {
    if (!edge || typeof edge.id !== "string" || edge.id.length === 0) {
      return fail("invalid_edge_id", "Each edge must have an id.");
    }
    if (edgeIds.has(edge.id)) {
      return fail("duplicate_edge_id", "Duplicate edge ids are not allowed.");
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source_id) || !nodeIds.has(edge.target_id)) {
      return fail("dangling_edge", "Every edge endpoint must reference a node.");
    }
    if (edge.source_id === edge.target_id) {
      return fail("self_loop", "Edges cannot connect a node to itself.");
    }
    if (!Number.isFinite(edge.weight) || edge.weight < 0) {
      return fail("invalid_weight", "Edge weight must be a finite, non-negative value.");
    }
    if (edge.type !== "walkway" && edge.type !== "road") {
      return fail("invalid_edge_type", "Edge type is not supported.");
    }
    if (typeof edge.bidirectional !== "boolean") {
      return fail("invalid_direction", "Edge direction must be explicit.");
    }
    if (edge.access !== undefined) {
      if (!Array.isArray(edge.access) || edge.access.length === 0 || edge.access.length > 3) {
        return fail("invalid_access", "Edge access must contain one to three supported modes.");
      }
      if (edge.access.some((mode) => !ACCESS_MODES.has(mode))) {
        return fail("invalid_access", "Edge access contains an unsupported mode.");
      }
      if (new Set(edge.access).size !== edge.access.length) {
        return fail("duplicate_access", "Edge access modes must be unique.");
      }
    }

    const directedKey = `${edge.source_id}\u0000${edge.target_id}`;
    if (directedEdges.has(directedKey)) {
      return fail("duplicate_direction", "Only one edge is allowed for each direction between two nodes.");
    }
    directedEdges.add(directedKey);

    const pair = endpointPair(edge.source_id, edge.target_id);
    const pairRows = pairEdges.get(pair) ?? [];
    pairRows.push(edge);
    pairEdges.set(pair, pairRows);
  }

  for (const pairRows of pairEdges.values()) {
    if (pairRows.length > 1 && pairRows.some((edge) => edge.bidirectional)) {
      return fail(
        "bidirectional_overlap",
        "A two-way edge cannot overlap another edge between the same nodes.",
      );
    }
  }

  return { ok: true };
}

export const isEditorGraphValid = (
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
) => validateEditorGraph(nodes, edges).ok;

export type EditorAccessMode = TransportMode | "cycling";
