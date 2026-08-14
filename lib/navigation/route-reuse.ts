import type { TransportMode } from "@/lib/types/graph";
import type {
  CommittedNavigationSnapshot,
  NavigationPoint,
} from "@/lib/map/map-runtime";

function pointsEqual(left: NavigationPoint | null, right: NavigationPoint | null): boolean {
  if (left === null || right === null) return left === right;
  return left.lat === right.lat && left.lng === right.lng;
}

export function canReuseCommittedRoute({
  committed,
  destinationId,
  mode,
  start,
  end,
}: {
  committed: CommittedNavigationSnapshot | null;
  destinationId: string | null | undefined;
  mode: TransportMode;
  start: NavigationPoint | null;
  end: NavigationPoint | null;
}): boolean {
  if (!committed || !destinationId) return false;
  return (
    committed.destinationId === destinationId &&
    committed.mode === mode &&
    pointsEqual(committed.start, start) &&
    pointsEqual(committed.end, end)
  );
}
