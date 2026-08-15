import type { GraphNodeType } from "@/lib/types/graph";

export function shouldAppendRequestedEndpoint({
  destinationHasBuildingEntries,
  snappedNodeType,
}: {
  destinationHasBuildingEntries: boolean;
  snappedNodeType?: GraphNodeType;
}): boolean {
  return !destinationHasBuildingEntries && snappedNodeType !== "building_entry";
}
