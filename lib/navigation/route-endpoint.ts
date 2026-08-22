import type { GraphNodeType, MapNode } from "@/lib/types/graph";

export interface RenderableRouteEndpoints {
  start: MapNode;
  end: MapNode;
}

export function getRenderableRouteEndpoints(
  path: readonly MapNode[],
): RenderableRouteEndpoints | null {
  if (path.length === 0) return null;

  const start = path[0];
  const end = path[path.length - 1];
  if (!start || !end) return null;

  return { start, end };
}

export function shouldAppendRequestedEndpoint({
  destinationHasBuildingEntries,
  snappedNodeType,
}: {
  destinationHasBuildingEntries: boolean;
  snappedNodeType?: GraphNodeType;
}): boolean {
  return !destinationHasBuildingEntries && snappedNodeType !== "building_entry";
}
