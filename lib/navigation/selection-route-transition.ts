import {
  cancelPendingRouteReplacement,
  type RouteCommitState,
  type RouteRequestContext,
} from "./route-commit-state";

export type RouteSelectionTransition =
  | { kind: "retain" }
  | { kind: "clear" }
  | {
      kind: "cancel-replacement";
      routeState: RouteCommitState;
      restoreContext: RouteRequestContext;
    };

export function resolveRouteSelectionTransition({
  selectedItemId,
  flowDestinationId,
  routeState,
  hasNavigationState,
}: {
  selectedItemId: string | null;
  flowDestinationId: string | null;
  routeState: RouteCommitState;
  hasNavigationState: boolean;
}): RouteSelectionTransition {
  if (!hasNavigationState || !selectedItemId) {
    return { kind: "retain" };
  }

  const committedDestinationId = routeState.committed?.destinationId;
  if (
    routeState.committed &&
    selectedItemId === committedDestinationId &&
    routeState.pending &&
    routeState.pending.destinationId !== committedDestinationId
  ) {
    return {
      kind: "cancel-replacement",
      routeState: cancelPendingRouteReplacement(routeState),
      restoreContext: {
        destinationId: routeState.committed.destinationId,
        start: routeState.committed.start,
        end: routeState.committed.end,
        mode: routeState.committed.mode,
        origin: routeState.committed.origin,
      },
    };
  }

  const validOwnerIds = new Set(
    [
      committedDestinationId,
      routeState.pending?.destinationId,
      flowDestinationId,
    ].filter((id): id is string => Boolean(id)),
  );

  return validOwnerIds.has(selectedItemId) ? { kind: "retain" } : { kind: "clear" };
}
