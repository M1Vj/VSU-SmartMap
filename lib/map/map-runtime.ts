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

export interface MapRuntimeState {
  selectedItemId: string | null;
  navigation: {
    phase: NavigationPhase;
    origin: NavigationOrigin | null;
    mode: TransportMode;
    destinationId: string | null;
    pendingRequestId: number | null;
    committedRoute: PathResult | null;
    error: string | null;
  };
  presentation: {
    markerMode: MarkerMode;
    controls: {
      primaryAction: "clear" | "cancel" | "none";
      canReportRoute: boolean;
      statusText: string | null;
    };
    announcement: string | null;
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
    }
  | { type: "navigation/acquiring"; requestId: number }
  | { type: "navigation/resolving"; requestId: number }
  | { type: "navigation/committed"; requestId: number; route: PathResult }
  | { type: "navigation/failed"; requestId: number; message: string }
  | { type: "navigation/cleared" };

export function createInitialMapRuntimeState(
  mode: TransportMode = "walking",
): MapRuntimeState {
  return {
    selectedItemId: null,
    navigation: {
      phase: "idle",
      origin: null,
      mode,
      destinationId: null,
      pendingRequestId: null,
      committedRoute: null,
      error: null,
    },
    presentation: derivePresentation({
      phase: "idle",
      destinationId: null,
      committedRoute: null,
      error: null,
    }),
  };
}

function isCurrentRequest(state: MapRuntimeState, requestId: number): boolean {
  return state.navigation.pendingRequestId === requestId;
}

function derivePresentation(input: Pick<MapRuntimeState["navigation"], "phase" | "destinationId" | "committedRoute" | "error">): MapRuntimeState["presentation"] {
  const hasDestination = Boolean(input.destinationId);
  const hasRoute = Boolean(input.committedRoute);
  const routeMode: MarkerMode = hasDestination || hasRoute ? "destination-focused" : "default";

  let announcement: string | null = null;
  if (input.phase === "active" && hasRoute) announcement = "Route found!";
  if (input.phase === "failed") announcement = input.error ?? "No route found.";

  return {
    markerMode: routeMode,
    controls: {
      primaryAction: hasDestination ? "clear" : "none",
      canReportRoute: hasRoute && input.phase !== "cleared" && input.phase !== "idle",
      statusText:
        input.phase === "acquiring"
          ? "Waiting for your location..."
          : input.phase === "resolving" || input.phase === "refreshing"
            ? "Loading route..."
            : null,
    },
    announcement,
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
      pendingRequestId: null,
      committedRoute: null,
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/requested") {
    const hasCommittedRoute = state.navigation.committedRoute !== null;
    const navigation = {
      ...state.navigation,
      phase: event.awaitingStart
        ? hasCommittedRoute
          ? ("refreshing" as const)
          : ("acquiring" as const)
        : hasCommittedRoute
          ? ("refreshing" as const)
          : ("resolving" as const),
      origin: event.origin,
      mode: event.mode ?? state.navigation.mode,
      destinationId: event.destinationId,
      pendingRequestId: event.requestId,
      error: null,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/acquiring" || event.type === "navigation/resolving") {
    if (!isCurrentRequest(state, event.requestId)) return state;
    const phase = event.type === "navigation/acquiring"
      ? (state.navigation.committedRoute ? "refreshing" : "acquiring")
      : (state.navigation.committedRoute ? "refreshing" : "resolving");
    const navigation = { ...state.navigation, phase: phase as NavigationPhase };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  if (event.type === "navigation/committed") {
    if (!isCurrentRequest(state, event.requestId)) return state;
    const navigation = {
      ...state.navigation,
      phase: "active" as const,
      pendingRequestId: null,
      committedRoute: event.route,
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
      error: event.message,
    };
    return { ...state, navigation, presentation: derivePresentation(navigation) };
  }
  return state;
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
      return () => listeners.delete(listener);
    },
  };
}
