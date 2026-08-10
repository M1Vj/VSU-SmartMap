import type { MapEdge, MapNode } from "@/lib/types/graph";

export interface NavigationGraphSnapshot {
  revision: number;
  nodes: MapNode[];
  edges: MapEdge[];
}

export type NavigationConflictSnapshotState =
  | { status: "ready"; snapshot: NavigationGraphSnapshot }
  | { status: "error"; message: string };

export type NavigationConflictChoice = "keep-draft" | "discard-draft";

export type NavigationConflictDecision =
  | {
      choice: "keep-draft";
      revision: number;
      nodes: MapNode[];
      edges: MapEdge[];
      requiresExplicitSave: true;
    }
  | {
      choice: "discard-draft";
      revision: number;
      nodes: MapNode[];
      edges: MapEdge[];
      requiresExplicitSave: false;
    };

/**
 * Convert a failed or successful snapshot fetch into UI state without
 * touching the editor draft. A failed fetch must never be interpreted as an
 * empty graph or as permission to discard the local edits.
 */
export function resolveNavigationConflictSnapshot(
  result: { data: NavigationGraphSnapshot | null; error: unknown | null },
): NavigationConflictSnapshotState {
  if (result.error || !result.data) {
    return {
      status: "error",
      message: "The latest server graph could not be loaded. Your draft is still preserved.",
    };
  }

  return { status: "ready", snapshot: result.data };
}

/**
 * Apply an explicit conflict choice. Keeping a draft only advances its
 * optimistic revision; the caller must still invoke Save. Discarding is the
 * only choice that returns server rows for hydration/cache replacement.
 */
export function decideNavigationConflict(
  snapshot: NavigationGraphSnapshot,
  draft: Pick<NavigationGraphSnapshot, "nodes" | "edges">,
  choice: NavigationConflictChoice,
): NavigationConflictDecision {
  if (choice === "keep-draft") {
    return {
      choice,
      revision: snapshot.revision,
      nodes: draft.nodes,
      edges: draft.edges,
      requiresExplicitSave: true,
    };
  }

  return {
    choice,
    revision: snapshot.revision,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    requiresExplicitSave: false,
  };
}
