import type { MapEdge } from "@/lib/types/graph";

export interface NewEditorEdge {
  sourceId: string;
  targetId: string;
  bidirectional: boolean;
}

/**
 * Returns whether an edge can be added without duplicating an existing route.
 *
 * Two one-way edges in opposite directions are distinct graph relationships
 * and are therefore allowed. A two-way edge already represents both directed
 * relationships, so it conflicts with either direction.
 */
export function canAddEditorEdge(edges: readonly MapEdge[], candidate: NewEditorEdge): boolean {
  return !edges.some((edge) => {
    const sameDirection =
      edge.source_id === candidate.sourceId && edge.target_id === candidate.targetId;
    const reverseDirection =
      edge.source_id === candidate.targetId && edge.target_id === candidate.sourceId;

    if (!sameDirection && !reverseDirection) return false;
    if (sameDirection) return true;

    return edge.bidirectional || candidate.bidirectional;
  });
}
