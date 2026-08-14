import type { RouteCommitState, RoutePoint } from "./route-commit-state";

export function getRouteFacingDestination(
  state: Pick<RouteCommitState, "committed" | "pending">,
  rawDestination: RoutePoint | null,
): RoutePoint | null {
  if (state.committed?.end) return state.committed.end;
  if (!state.committed && state.pending?.end) return state.pending.end;
  return rawDestination;
}
