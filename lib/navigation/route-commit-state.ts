import type { PathResult, TransportMode } from "@/lib/types/graph";

export type RoutePoint = { lat: number; lng: number };

export type RouteRequestContext = {
  destinationId: string | null;
  start: RoutePoint | null;
  end: RoutePoint | null;
  mode: TransportMode;
  origin: "live" | "manual" | null;
};

export type CommittedRoute = RouteRequestContext & {
  route: PathResult;
};

export type RouteCommitState = {
  committed: CommittedRoute | null;
  pending: RouteRequestContext | null;
};

export const EMPTY_ROUTE_COMMIT_STATE: RouteCommitState = {
  committed: null,
  pending: null,
};

export function beginRouteRequest(
  state: RouteCommitState,
  pending: RouteRequestContext,
): RouteCommitState {
  return { committed: state.committed, pending };
}

export function commitRoute(
  state: RouteCommitState,
  context: RouteRequestContext,
  route: PathResult,
): RouteCommitState {
  if (!state.pending || !routeContextsEqual(state.pending, context)) {
    return state;
  }
  return { committed: { ...context, route }, pending: null };
}

export function failRouteRequest(state: RouteCommitState): RouteCommitState {
  return cancelPendingRouteReplacement(state);
}

export type RouteRequestFailureTransition = {
  state: RouteCommitState;
  restoreContext: RouteRequestContext | null;
};

export function resolveRouteRequestFailure(
  state: RouteCommitState,
  failedContext: RouteRequestContext | null,
): RouteRequestFailureTransition {
  if (
    !state.pending ||
    !failedContext ||
    !areRouteRequestContextsEqual(state.pending, failedContext)
  ) {
    return { state, restoreContext: null };
  }

  const committed = state.committed;
  return {
    state: failRouteRequest(state),
    restoreContext: committed
      ? {
          destinationId: committed.destinationId,
          start: committed.start,
          end: committed.end,
          mode: committed.mode,
          origin: committed.origin,
        }
      : null,
  };
}

export function cancelPendingRouteReplacement(
  state: RouteCommitState,
): RouteCommitState {
  return { committed: state.committed, pending: null };
}

export function clearRouteCommit(): RouteCommitState {
  return EMPTY_ROUTE_COMMIT_STATE;
}

export function canReuseCommittedRoute(
  committed: CommittedRoute | null,
  current: RouteRequestContext | null,
): boolean {
  return committed !== null && current !== null && routeContextsEqual(committed, current);
}

export function areRouteRequestContextsEqual(
  first: RouteRequestContext,
  second: RouteRequestContext,
): boolean {
  return routeContextsEqual(first, second);
}

function routeContextsEqual(
  committed: RouteRequestContext,
  pending: RouteRequestContext,
): boolean {
  return (
    committed.destinationId === pending.destinationId &&
    committed.mode === pending.mode &&
    committed.origin === pending.origin &&
    samePoint(committed.start, pending.start) &&
    samePoint(committed.end, pending.end)
  );
}

function samePoint(first: RoutePoint | null, second: RoutePoint | null): boolean {
  return first?.lat === second?.lat && first?.lng === second?.lng;
}
