import type {
  MapEvidenceApi,
  MapEvidenceEventName,
  MapEvidenceModality,
} from "./e2e-probe";
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline as LeafletPolyline } from "leaflet";
import type { Map as MapLibreMap } from "maplibre-gl";

type ProbeCore = typeof import("./e2e-probe");
type PendingOperation = {
  cancelled: boolean;
  dispose?: () => void;
  apply: (core: ProbeCore) => () => void;
};
type PendingEvent = [MapEvidenceEventName, string | number | undefined, MapEvidenceModality | undefined];
type PendingCorrelation = [string | number | undefined, string | number];
type BridgeState = {
  url: string;
  owners: number;
  disposed: boolean;
  core: ProbeCore | null;
  loading: Promise<ProbeCore> | null;
  coreCleanup: (() => void) | null;
  pendingOperations: PendingOperation[];
  pendingEvents: PendingEvent[];
  pendingCorrelations: PendingCorrelation[];
};

const MAX_PENDING = 100;
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app",
]);

declare global {
  interface Window {
    __VSU_MAP_E2E__?: MapEvidenceApi;
  }
}

let bridgeState: BridgeState | null = null;

function isEnabled(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.username === "" &&
      parsed.password === "" &&
      ALLOWED_ORIGINS.has(parsed.origin) &&
      parsed.searchParams.getAll("mapEvidence").length === 1 &&
      parsed.searchParams.get("mapEvidence") === "1"
    );
  } catch {
    return false;
  }
}

function appendBounded<T>(items: T[], value: T) {
  items.push(value);
  if (items.length > MAX_PENDING) items.splice(0, items.length - MAX_PENDING);
}

function currentState() {
  return bridgeState && !bridgeState.disposed ? bridgeState : null;
}

function attachCore(state: BridgeState, core: ProbeCore) {
  if (state.disposed || bridgeState !== state) return;
  state.core = core;
  state.coreCleanup = core.initializeMapEvidence(state.url);
  for (const operation of state.pendingOperations) {
    if (operation.cancelled) continue;
    operation.dispose = operation.apply(core);
  }
  state.pendingOperations = [];
  for (const [name, correlation, modality] of state.pendingEvents) {
    core.recordMapEvidenceEvent(name, correlation, modality);
  }
  state.pendingEvents = [];
  for (const [sessionToken, requestId] of state.pendingCorrelations) {
    core.establishMapEvidenceCorrelation(sessionToken, requestId);
  }
  state.pendingCorrelations = [];
}

function ensureCore(state: BridgeState) {
  if (state.loading) return state.loading;
  state.loading = import("./e2e-probe").then((core) => {
    attachCore(state, core);
    return core;
  });
  return state.loading;
}

function queueOperation(state: BridgeState, apply: PendingOperation["apply"]) {
  const operation: PendingOperation = { cancelled: false, apply };
  if (state.core) {
    operation.dispose = apply(state.core);
  } else {
    appendBounded(state.pendingOperations, operation);
    void ensureCore(state);
  }
  return () => {
    operation.cancelled = true;
    operation.dispose?.();
  };
}

export function initializeMapEvidence(url: string): () => void {
  if (typeof window === "undefined" || !isEnabled(url)) return () => undefined;
  let state = currentState();
  if (!state) {
    state = {
      url,
      owners: 0,
      disposed: false,
      core: null,
      loading: null,
      coreCleanup: null,
      pendingOperations: [],
      pendingEvents: [],
      pendingCorrelations: [],
    };
    bridgeState = state;
  }
  state.owners += 1;
  void ensureCore(state);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state!.owners -= 1;
    if (state!.owners > 0) return;
    state!.disposed = true;
    for (const operation of state!.pendingOperations) operation.cancelled = true;
    state!.pendingOperations = [];
    state!.pendingEvents = [];
    state!.pendingCorrelations = [];
    state!.coreCleanup?.();
    state!.coreCleanup = null;
    if (bridgeState === state) bridgeState = null;
  };
}

export function registerLeafletMapForEvidence(map: LeafletMap): () => void {
  const state = currentState();
  if (!state) return () => undefined;
  return queueOperation(state, (core) => core.registerLeafletMapForEvidence(map));
}

export function registerMapLibreForEvidence(map: MapLibreMap): () => void {
  const state = currentState();
  if (!state) return () => undefined;
  return queueOperation(state, (core) => core.registerMapLibreForEvidence(map));
}

export function registerRouteForEvidence(input: {
  map: LeafletMap;
  polyline: LeafletPolyline;
  path: readonly { lat: number; lng: number }[];
}): () => void {
  const state = currentState();
  if (!state) return () => undefined;
  return queueOperation(state, (core) => core.registerRouteForEvidence(input));
}

export function registerDestinationMarkerForEvidence(input: {
  marker: LeafletMarker;
  coordinate: { lat: number; lng: number };
  iconAnchor: readonly [number, number];
  iconSize: readonly [number, number];
}): () => void {
  const state = currentState();
  if (!state) return () => undefined;
  return queueOperation(state, (core) => core.registerDestinationMarkerForEvidence(input));
}

export function recordMapEvidenceEvent(
  name: MapEvidenceEventName,
  correlation?: string | number,
  modality?: MapEvidenceModality,
) {
  const state = currentState();
  if (!state) return;
  if (state.core) {
    state.core.recordMapEvidenceEvent(name, correlation, modality);
    return;
  }
  appendBounded(state.pendingEvents, [name, correlation, modality]);
  void ensureCore(state);
}

export function establishMapEvidenceCorrelation(
  sessionToken: string | number | undefined,
  requestId: string | number,
) {
  const state = currentState();
  if (!state) return;
  if (state.core) {
    state.core.establishMapEvidenceCorrelation(sessionToken, requestId);
    return;
  }
  appendBounded(state.pendingCorrelations, [sessionToken, requestId]);
  void ensureCore(state);
}

export async function waitForMapEvidenceRouteDelay(signal: AbortSignal) {
  const state = currentState();
  if (!state) return;
  const core = state.core ?? await ensureCore(state);
  if (!state.disposed && bridgeState === state) await core.waitForMapEvidenceRouteDelay(signal);
}

export function throwIfMapEvidenceRouteFailureRequested(signal: AbortSignal) {
  const state = currentState();
  if (!state?.core) return;
  state.core.throwIfMapEvidenceRouteFailureRequested(signal);
}
