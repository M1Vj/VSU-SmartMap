import type { PathResult, TransportMode } from "@/lib/types/graph";

export type NavigationPhase =
  | "idle"
  | "acquiring"
  | "resolving"
  | "active"
  | "refreshing"
  | "failed"
  | "cleared";

export type NavigationOrigin = "live" | "manual";
export type MarkerMode = "default" | "destination-focused";

export interface NavigationPoint {
  lat: number;
  lng: number;
}

export interface NavigationRequestSnapshot {
  requestId: number;
  destinationId: string;
  origin: NavigationOrigin;
  mode: TransportMode;
  start: NavigationPoint | null;
  end: NavigationPoint | null;
}

export interface CommittedNavigationSnapshot {
  route: PathResult;
  destinationId: string;
  origin: NavigationOrigin;
  mode: TransportMode;
  start: NavigationPoint | null;
  end: NavigationPoint | null;
}

export interface MapRuntimeState {
  selectedItemId: string | null;
  navigation: {
    phase: NavigationPhase;
    origin: NavigationOrigin | null;
    mode: TransportMode;
    destinationId: string | null;
    /** Item selection that owns the current navigation flow, including a failed replacement. */
    selectionDestinationId: string | null;
    pendingRequestId: number | null;
    request: NavigationRequestSnapshot | null;
    committed: CommittedNavigationSnapshot | null;
    error: string | null;
  };
  presentation: {
    markerMode: MarkerMode;
    controls: {
      primaryAction: "clear" | "cancel" | "none";
      canReportRoute: boolean;
      statusText: string | null;
    };
  };
}

export type MapRuntimeEvent =
  | { type: "selection/set"; itemId: string }
  | { type: "selection/cleared" }
  | {
      type: "navigation/requested";
      requestId: number;
      destinationId: string;
      origin: NavigationOrigin;
      mode?: TransportMode;
      awaitingStart?: boolean;
      start?: NavigationPoint | null;
      end?: NavigationPoint | null;
    }
  | { type: "navigation/acquiring"; requestId: number }
  | {
      type: "navigation/resolving";
      requestId: number;
      origin?: NavigationOrigin;
      start?: NavigationPoint | null;
      end?: NavigationPoint | null;
    }
  | {
      type: "navigation/committed";
      requestId: number;
      route: PathResult;
      snapshot?: Omit<CommittedNavigationSnapshot, "route">;
    }
  | { type: "navigation/failed"; requestId: number; message: string }
  | { type: "navigation/restored"; requestId: number; destinationId: string }
  | { type: "navigation/cleared" };

export function createInitialMapRuntimeState(
  mode: TransportMode = "walking",
): MapRuntimeState {
  const navigation: MapRuntimeState["navigation"] = {
    phase: "idle",
    origin: null,
    mode,
    destinationId: null,
    selectionDestinationId: null,
    pendingRequestId: null,
    request: null,
    committed: null,
    error: null,
  };
  return {
    selectedItemId: null,
    navigation,
    presentation: derivePresentation(navigation),
  };
}

function isCurrentRequest(state: MapRuntimeState, requestId: number): boolean {
  return state.navigation.pendingRequestId === requestId;
}

function derivePresentation(
  input: Pick<
    MapRuntimeState["navigation"],
    "phase" | "destinationId" | "error" | "request" | "committed"
  >,
): MapRuntimeState["presentation"] {
  const presentedDestination =
    input.committed?.destinationId ?? input.request?.destinationId ?? input.destinationId;
  const hasDestination = Boolean(presentedDestination);
  const hasRoute = Boolean(input.committed?.route);
  const routeMode: MarkerMode = hasDestination || hasRoute ? "destination-focused" : "default";

  return {
    markerMode: routeMode,
    controls: {
      primaryAction: !hasDestination ? "none" : hasRoute ? "clear" : "cancel",
      canReportRoute: hasRoute && input.phase !== "cleared" && input.phase !== "idle",
      statusText:
        input.phase === "acquiring"
          ? "Waiting for your location..."
          : input.phase === "resolving" || input.phase === "refreshing"
            ? "Loading route..."
            : null,
    },
  };
}

export function mapRuntimeReducer(
  state: MapRuntimeState,
  event: MapRuntimeEvent,
): MapRuntimeState {
  if (event.type === "selection/set") {
    return { ...state, selectedItemId: event.itemId };
  }
  if (event.type === "selection/cleared") {
    return { ...state, selectedItemId: null };
  }
  if (event.type === "navigation/cleared") {
    const navigation = {
      ...state.navigation,
      phase: "cleared" as const,
      origin: null,
      destinationId: null,
      selectionDestinationId: null,
      pendingRequestId: null,
      request: null,
      committed: null,
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/restored") {
    const committed = state.navigation.committed;
    if (
      !committed ||
      state.navigation.pendingRequestId !== event.requestId ||
      committed.destinationId !== event.destinationId
    ) {
      return state;
    }

    const navigation = {
      ...state.navigation,
      phase: "active" as const,
      origin: committed.origin,
      mode: committed.mode,
      destinationId: committed.destinationId,
      selectionDestinationId: committed.destinationId,
      pendingRequestId: null,
      request: null,
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/requested") {
    const hasCommittedRoute = state.navigation.committed !== null;
    const navigation = {
      ...state.navigation,
      phase: event.awaitingStart
        ? ("acquiring" as const)
        : hasCommittedRoute
          ? ("refreshing" as const)
          : ("resolving" as const),
      origin: event.origin,
      mode: event.mode ?? state.navigation.mode,
      destinationId: event.destinationId,
      selectionDestinationId: event.destinationId,
      pendingRequestId: event.requestId,
      request: {
        requestId: event.requestId,
        destinationId: event.destinationId,
        origin: event.origin,
        mode: event.mode ?? state.navigation.mode,
        start: event.start ?? null,
        end: event.end ?? null,
      },
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/acquiring" || event.type === "navigation/resolving") {
    if (!isCurrentRequest(state, event.requestId)) return state;
    const phase = event.type === "navigation/acquiring"
      ? (state.navigation.committed ? "refreshing" : "acquiring")
      : (state.navigation.committed ? "refreshing" : "resolving");
    const navigation = {
      ...state.navigation,
      phase: phase as NavigationPhase,
      origin: event.type === "navigation/resolving" && event.origin ? event.origin : state.navigation.origin,
      request: state.navigation.request
        ? {
            ...state.navigation.request,
            origin:
              event.type === "navigation/resolving"
                ? event.origin ?? state.navigation.request.origin
                : state.navigation.request.origin,
            start:
              event.type === "navigation/resolving" && event.start !== undefined
                ? event.start
                : state.navigation.request.start,
            end:
              event.type === "navigation/resolving" && event.end !== undefined
                ? event.end
                : state.navigation.request.end,
          }
        : null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/committed") {
    if (!isCurrentRequest(state, event.requestId)) return state;
    const request = state.navigation.request;
    const snapshot: CommittedNavigationSnapshot = {
      route: event.route,
      destinationId: event.snapshot?.destinationId ?? request?.destinationId ?? state.navigation.destinationId ?? "",
      origin: event.snapshot?.origin ?? request?.origin ?? state.navigation.origin ?? "manual",
      mode: event.snapshot?.mode ?? request?.mode ?? state.navigation.mode,
      start: event.snapshot?.start ?? request?.start ?? null,
      end: event.snapshot?.end ?? request?.end ?? null,
    };
    const navigation = {
      ...state.navigation,
      phase: "active" as const,
      pendingRequestId: null,
      destinationId: snapshot.destinationId,
      selectionDestinationId: snapshot.destinationId,
      origin: snapshot.origin,
      mode: snapshot.mode,
      request: null,
      committed: snapshot,
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/failed") {
    if (!isCurrentRequest(state, event.requestId)) return state;
    const navigation = {
      ...state.navigation,
      phase: "failed" as const,
      pendingRequestId: null,
      request: state.navigation.committed ? null : state.navigation.request,
      error: event.message,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  return state;
}

/**
 * Returns the metadata that should drive map presentation. A committed route
 * always wins over a replacement request so refresh/failure cannot relabel an
 * old overlay as the pending destination. Before the first commit, the request
 * still supplies the destination-focused marker state.
 */
export function getPresentedNavigationSnapshot(
  state: MapRuntimeState,
): CommittedNavigationSnapshot | NavigationRequestSnapshot | null {
  return state.navigation.committed ?? state.navigation.request;
}

/**
 * Returns the endpoint that should drive visible map controls and camera hints.
 * A committed route remains authoritative while a replacement is resolving or
 * has failed; persisted/request metadata is only used before the first commit.
 */
export function getRouteFacingEndpoint(
  state: MapRuntimeState,
  persistedEnd: NavigationPoint | null = null,
): NavigationPoint | null {
  if (state.navigation.committed) return state.navigation.committed.end;
  return state.navigation.request?.end ?? persistedEnd;
}

export interface MapRuntimeController {
  getState: () => MapRuntimeState;
  dispatch: (event: MapRuntimeEvent) => MapRuntimeState;
  subscribe: (listener: () => void) => () => void;
}

export function createMapRuntimeController(
  initialState: MapRuntimeState = createInitialMapRuntimeState(),
): MapRuntimeController {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch: (event) => {
      const next = mapRuntimeReducer(state, event);
      if (next !== state) {
        state = next;
        listeners.forEach((listener) => listener());
      }
      return state;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
