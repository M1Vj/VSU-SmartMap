import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
} from "leaflet";
import type { Map as MapLibreMap } from "maplibre-gl";

export type MapEvidenceEventName =
  | "marker-activation"
  | "background-activation"
  | "popup-open"
  | "popup-close"
  | "details"
  | "navigate"
  | "route-request"
  | "navigation-feedback";

export type MapEvidenceModality = "mouse" | "touch" | "pen" | "keyboard";

export type MapEvidenceEvent = {
  sequence: number;
  name: MapEvidenceEventName;
  correlationOrdinal: number | null;
  modality: MapEvidenceModality | null;
};

export type MapFrameSampleFailure =
  | "missing-map"
  | "missing-route"
  | "missing-route-path"
  | "route-not-synced"
  | "missing-route-baseline"
  | "missing-route-element"
  | "missing-route-geometry"
  | "missing-overlay-transform"
  | "missing-raster-pane"
  | "missing-raster-tile"
  | "inconsistent-raster-projection"
  | "incompatible-sample-count"
  | "sampling-capped"
  | "missing-destination"
  | "missing-destination-element"
  | "missing-destination-geometry"
  | "missing-renderer-projection"
  | "missing-renderer-frame"
  | "missing-renderer-registration";

export type MapFrameSample = {
  frameIndex: number;
  at: number;
  routeVisible: boolean;
  routeErrorPx: number | null;
  destinationErrorPx: number | null;
  rendererErrorPx: number | null;
  expectedSampleCount: number;
  renderedSampleCount: number;
  visualRouteSpanPx: number | null;
  visualRouteScale: number | null;
  rendererFrameToken: number | null;
  rendererGeneration: number | null;
  probeCostMs: number;
  zoom: number | null;
  animatingZoom: boolean;
  failure: MapFrameSampleFailure | null;
};

type ScreenPoint = { x: number; y: number };
export type AffineTransform = { a: number; b: number; c: number; d: number; e: number; f: number };

export type MapEvidenceRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SampledScreenPolyline = {
  points: ScreenPoint[];
  failure: "sampling-capped" | null;
};

export type MapEvidenceSnapshot = {
  events: readonly MapEvidenceEvent[];
  frames: readonly MapFrameSample[];
  routeDelayMs: number;
  frameProbeRunning: boolean;
  frameProbe: {
    startedAt: number | null;
    stoppedAt: number | null;
    frameCount: number;
    stopReason: "explicit" | "max-frames" | "wall-clock-timeout" | "visibilitychange" | "cleanup" | "route-readiness-timeout" | "renderer-replacement" | null;
    totalCostMs: number;
  };
};

export type MapFrameProbeBoundary = {
  generation: number;
  token: number | null;
};

export type MapEvidenceApi = {
  snapshot: () => MapEvidenceSnapshot;
  events: () => readonly MapEvidenceEvent[];
  reset: () => void;
  startFrameProbe: () => void;
  armFrameProbeForInput: () => MapFrameProbeBoundary;
  markFrameProbeBoundary: () => void;
  stopFrameProbe: () => void;
  setRouteDelayMs: (delayMs: number) => void;
  failNextRoute: () => void;
  zoomTo: (zoom: number) => void;
  panBy: (x: number, y: number) => void;
};

const MAP_EVIDENCE_EVENT_NAMES = new Set<MapEvidenceEventName>([
  "marker-activation",
  "background-activation",
  "popup-open",
  "popup-close",
  "details",
  "navigate",
  "route-request",
  "navigation-feedback",
]);
const MAP_EVIDENCE_MODALITIES = new Set<MapEvidenceModality>([
  "mouse",
  "touch",
  "pen",
  "keyboard",
]);

declare global {
  interface Window {
    __VSU_MAP_E2E__?: MapEvidenceApi;
  }
}

type RegisteredRoute = {
  map: LeafletMap;
  polyline: LeafletPolyline;
  path: readonly { lat: number; lng: number }[];
  ready: boolean;
  readinessSettled: boolean;
  readinessFailure: MapFrameSampleFailure | null;
  settleFrameId: number | null;
  settleTimeout: ReturnType<typeof setTimeout> | null;
  readinessRetryTimeout: ReturnType<typeof setTimeout> | null;
  readinessDeadlineTimeout: ReturnType<typeof setTimeout> | null;
  readinessAttempts: number;
  readinessDeadlineAt: number;
};

type RegisteredDestination = {
  marker: LeafletMarker;
  coordinate: { lat: number; lng: number };
  iconAnchor: { x: number; y: number };
  iconSize: { x: number; y: number };
};

type MapLibreRenderSnapshot = {
  generation: number;
  token: number;
  canvasRect: MapEvidenceRect;
  clientWidth: number;
  clientHeight: number;
  projectedAnchor: ScreenPoint;
  zoom: number | null;
  bearing: number | null;
  pitch: number | null;
};

type PendingDelay = {
  timer: ReturnType<typeof setTimeout>;
  signal: AbortSignal;
  onAbort: (error?: unknown) => void;
  resolve: () => void;
  reject: (error: unknown) => void;
};

type ProbeState = {
  ownerCount: number;
  api: MapEvidenceApi;
  window: Window;
  leafletMap: LeafletMap | null;
  mapLibreMap: MapLibreMap | null;
  route: RegisteredRoute | null;
  destination: RegisteredDestination | null;
  events: MapEvidenceEvent[];
  frames: MapFrameSample[];
  correlationOrdinals: Map<string, number>;
  correlationAliases: Map<string, number>;
  nextCorrelationOrdinal: number;
  nextEventSequence: number;
  routeDelayMs: number;
  failNextRoute: boolean;
  frameId: number | null;
  frameTimeout: ReturnType<typeof setTimeout> | null;
  frameCount: number;
  pendingDelays: Set<PendingDelay>;
  wallClockTimeout: ReturnType<typeof setTimeout> | null;
  frameProbeStartedAt: number | null;
  frameProbeStoppedAt: number | null;
  frameProbeStopReason: MapEvidenceSnapshot["frameProbe"]["stopReason"];
  frameProbeCostMs: number;
  totalFrameCount: number;
  mapLibreRenderGeneration: number;
  mapLibreRenderSequence: number;
  mapLibreRenderToken: number | null;
  mapLibreRenderMap: MapLibreMap | null;
  mapLibreRenderListener: (() => void) | null;
  mapLibreRenderSnapshot: MapLibreRenderSnapshot | null;
  frameTransitionRendererToken: number | null;
  frameTransitionRendererGeneration: number | null;
  frameTransitionRendererSnapshot: MapLibreRenderSnapshot | null;
  frameAwaitingRendererFrame: boolean;
  frameAwaitingRendererTimeout: ReturnType<typeof setTimeout> | null;
  visibilityDocument: Document | null;
  visibilityChangeHandler: (() => void) | null;
};

let activeState: ProbeState | null = null;

function isStateActive(state: ProbeState | null): state is ProbeState {
  return state !== null && activeState === state && state.window.__VSU_MAP_E2E__ === state.api;
}

function correlationKey(value: string | number) {
  return `${typeof value}:${String(value)}`;
}

function getOrdinal(state: ProbeState, correlation?: string | number) {
  if (correlation === undefined) return null;
  const key = correlationKey(correlation);
  const alias = state.correlationAliases.get(key);
  if (alias !== undefined) return alias;
  const existing = state.correlationOrdinals.get(key);
  if (existing !== undefined) return existing;
  if (state.correlationOrdinals.size >= 100) {
    const oldest = state.correlationOrdinals.keys().next().value;
    if (oldest !== undefined) state.correlationOrdinals.delete(oldest);
  }
  const ordinal = state.nextCorrelationOrdinal++;
  state.correlationOrdinals.set(key, ordinal);
  return ordinal;
}

function eventModality(modality?: MapEvidenceModality) {
  return modality ?? null;
}

function pushEvent(
  state: ProbeState,
  name: MapEvidenceEventName,
  correlation?: string | number,
  modality?: MapEvidenceModality,
) {
  state.events.push({
    sequence: state.nextEventSequence++,
    name,
    correlationOrdinal: getOrdinal(state, correlation),
    modality: eventModality(modality),
  });
  if (state.events.length > 100) state.events.splice(0, state.events.length - 100);
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFiniteScreenPoint(point: ScreenPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function getAffineTransformScale(transform: AffineTransform | null | undefined): number | null {
  if (
    !transform ||
    ![transform.a, transform.b, transform.c, transform.d, transform.e, transform.f].every(Number.isFinite)
  ) return null;
  const xScale = Math.hypot(transform.a, transform.b);
  const yScale = Math.hypot(transform.c, transform.d);
  const scale = Math.sqrt(xScale * yScale);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

export function hasInFlightVisualScale(scales: readonly (number | null)[]) {
  const epsilon = 1e-3;
  if (scales.length < 3 || scales.some((scale) => typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0)) return false;
  const before = scales[0]!;
  const after = scales.at(-1)!;
  return scales.slice(1, -1).some((scale) =>
    typeof scale === "number" &&
    Math.abs(scale - before) > epsilon && Math.abs(scale - after) > epsilon,
  );
}

function nearestDistance(point: ScreenPoint, points: readonly ScreenPoint[]) {
  let nearest = Infinity;
  for (const candidate of points) nearest = Math.min(nearest, distance(point, candidate));
  return nearest;
}

export function sampleScreenPolyline(
  points: readonly ScreenPoint[],
  maxSamples = 256,
): ScreenPoint[] {
  return sampleScreenPolylineDetailed(points, maxSamples).points;
}

function buildScreenPolylineSamples(points: readonly ScreenPoint[], interval: number) {
  if (points.length <= 1) return points.map((point) => ({ x: point.x, y: point.y }));
  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point));
  if (segmentLengths.every((length) => length === 0)) return [{ x: points[0].x, y: points[0].y }];

  const sampled: ScreenPoint[] = [{ x: points[0].x, y: points[0].y }];
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = segmentLengths[index];
    const steps = Math.max(1, Math.ceil(length / interval));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      sampled.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  return sampled;
}

export function resamplePolylineByNormalizedLength(
  points: readonly ScreenPoint[],
  sampleCount: number,
) {
  const count = Math.min(256, Math.max(0, Math.floor(Number.isFinite(sampleCount) ? sampleCount : 0)));
  if (count === 0 || points.length === 0) return [];
  const first = { x: points[0].x, y: points[0].y };
  if (count === 1 || points.length === 1) {
    return Array.from({ length: count }, () => ({ ...first }));
  }
  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const cumulative = [0];
  for (const length of lengths) cumulative.push(cumulative.at(-1)! + length);
  const total = cumulative.at(-1)!;
  if (total === 0) return Array.from({ length: count }, () => ({ ...first }));
  const result: ScreenPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = (total * index) / (count - 1);
    let segment = 0;
    while (segment < lengths.length - 1 && cumulative[segment + 1] < target) segment += 1;
    const segmentStart = cumulative[segment];
    const segmentLength = lengths[segment] || 1;
    const ratio = (target - segmentStart) / segmentLength;
    result.push({
      x: points[segment].x + (points[segment + 1].x - points[segment].x) * ratio,
      y: points[segment].y + (points[segment + 1].y - points[segment].y) * ratio,
    });
  }
  return result;
}

export function sampleScreenPolylineDetailed(
  points: readonly ScreenPoint[],
  maxSamples = 256,
): SampledScreenPolyline {
  if (points.length <= 1) {
    return { points: points.map((point) => ({ x: point.x, y: point.y })), failure: null };
  }
  const limit = Math.max(2, Math.floor(maxSamples));
  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point));
  const countForInterval = (interval: number) => {
    let count = 1;
    for (const length of segmentLengths) count += Math.max(1, Math.ceil(length / interval));
    return count;
  };
  let interval = 16;
  const capped = countForInterval(interval) > limit;
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  while (countForInterval(interval) > limit && interval < Math.max(16, totalLength * 2)) interval *= 2;
  let sampled = buildScreenPolylineSamples(points, interval);
  if (sampled.length > limit) sampled = resamplePolylineByNormalizedLength(sampled, limit);
  return {
    points: sampled,
    failure: capped ? "sampling-capped" : null,
  };
}

export function normalizeMapLibreProjection(
  point: ScreenPoint,
  clientSize: { width: number; height: number },
  renderedRect: MapEvidenceRect,
  targetRect: MapEvidenceRect,
): ScreenPoint {
  const scaleX = renderedRect.width / clientSize.width;
  const scaleY = renderedRect.height / clientSize.height;
  return {
    x: renderedRect.left - targetRect.left + point.x * scaleX,
    y: renderedRect.top - targetRect.top + point.y * scaleY,
  };
}

export function normalizeLeafletPaneProjection(
  point: ScreenPoint,
  paneRect: MapEvidenceRect,
  paneSize: { width: number; height: number },
  targetRect: MapEvidenceRect,
): ScreenPoint {
  const scaleX = paneSize.width > 0 ? paneRect.width / paneSize.width : 1;
  const scaleY = paneSize.height > 0 ? paneRect.height / paneSize.height : 1;
  return {
    x: point.x * scaleX + paneRect.left - targetRect.left,
    y: point.y * scaleY + paneRect.top - targetRect.top,
  };
}

type MapLibreEvidenceMap = MapLibreMap & {
  project: (coordinate: readonly [number, number]) => ScreenPoint;
  getZoom?: () => number;
  getBearing?: () => number;
  getPitch?: () => number;
};

function finiteMapLibreCameraValue(map: MapLibreEvidenceMap, method: "getZoom" | "getBearing" | "getPitch") {
  const value = typeof map[method] === "function" ? map[method]!() : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMapLibreCanvasFrame(map: MapLibreEvidenceMap) {
  const canvas = map.getCanvas?.();
  const rendererContainer = map.getContainer?.();
  const rect = canvas?.getBoundingClientRect?.();
  const clientWidth = rendererContainer?.clientWidth || canvas?.clientWidth || canvas?.width || rect?.width || 0;
  const clientHeight = rendererContainer?.clientHeight || canvas?.clientHeight || canvas?.height || rect?.height || 0;
  if (
    !rect ||
    ![rect.left, rect.top].every((value) => Number.isFinite(value)) ||
    ![rect.width, rect.height, clientWidth, clientHeight]
      .every((value) => Number.isFinite(value) && value > 0)
  ) return null;
  return {
    canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    clientWidth,
    clientHeight,
  };
}

function captureMapLibreRenderSnapshot(
  map: MapLibreMap,
  generation: number,
  token: number,
): MapLibreRenderSnapshot | null {
  const mapWithProject = map as MapLibreEvidenceMap;
  const frame = readMapLibreCanvasFrame(mapWithProject);
  if (!frame || typeof mapWithProject.project !== "function") return null;
  let projectedAnchor: ScreenPoint;
  try {
    projectedAnchor = mapWithProject.project.call(mapWithProject, [0, 0]);
  } catch {
    return null;
  }
  if (!isFiniteScreenPoint(projectedAnchor)) return null;
  return {
    generation,
    token,
    ...frame,
    projectedAnchor: { x: projectedAnchor.x, y: projectedAnchor.y },
    zoom: finiteMapLibreCameraValue(mapWithProject, "getZoom"),
    bearing: finiteMapLibreCameraValue(mapWithProject, "getBearing"),
    pitch: finiteMapLibreCameraValue(mapWithProject, "getPitch"),
  };
}

function closeEnough(left: number, right: number, tolerance = 0.25) {
  return Math.abs(left - right) <= tolerance;
}

function mapLibreRenderSnapshotsMatch(
  expected: MapLibreRenderSnapshot,
  actual: MapLibreRenderSnapshot,
) {
  return (
    expected.generation === actual.generation &&
    expected.token === actual.token &&
    closeEnough(expected.canvasRect.left, actual.canvasRect.left) &&
    closeEnough(expected.canvasRect.top, actual.canvasRect.top) &&
    closeEnough(expected.canvasRect.width, actual.canvasRect.width) &&
    closeEnough(expected.canvasRect.height, actual.canvasRect.height) &&
    closeEnough(expected.clientWidth, actual.clientWidth) &&
    closeEnough(expected.clientHeight, actual.clientHeight) &&
    closeEnough(expected.projectedAnchor.x, actual.projectedAnchor.x) &&
    closeEnough(expected.projectedAnchor.y, actual.projectedAnchor.y) &&
    (expected.zoom === null ? actual.zoom === null : actual.zoom !== null && closeEnough(expected.zoom, actual.zoom, 1e-3)) &&
    (expected.bearing === null ? actual.bearing === null : actual.bearing !== null && closeEnough(expected.bearing, actual.bearing, 1e-3)) &&
    (expected.pitch === null ? actual.pitch === null : actual.pitch !== null && closeEnough(expected.pitch, actual.pitch, 1e-3))
  );
}

function insideRect(point: ScreenPoint, rect: MapEvidenceRect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function clipSegmentToRect(start: ScreenPoint, end: ScreenPoint, rect: MapEvidenceRect) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let t0 = 0;
  let t1 = 1;
  const boundaries: Array<[number, number]> = [
    [-dx, start.x - rect.left],
    [dx, rect.left + rect.width - start.x],
    [-dy, start.y - rect.top],
    [dy, rect.top + rect.height - start.y],
  ];
  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) t0 = Math.max(t0, ratio);
    else t1 = Math.min(t1, ratio);
    if (t0 > t1) return null;
  }
  return [
    { x: start.x + dx * t0, y: start.y + dy * t0 },
    { x: start.x + dx * t1, y: start.y + dy * t1 },
  ] as const;
}

export function clipScreenPolylineToRect(
  points: readonly ScreenPoint[],
  rect: MapEvidenceRect,
): ScreenPoint[] {
  if (points.length === 0) return [];
  const result: ScreenPoint[] = [];
  const append = (point: ScreenPoint) => {
    const previous = result.at(-1);
    if (!previous || previous.x !== point.x || previous.y !== point.y) result.push(point);
  };
  for (let index = 0; index < points.length - 1; index += 1) {
    const clipped = clipSegmentToRect(points[index], points[index + 1], rect);
    if (!clipped) continue;
    append(clipped[0]);
    if (insideRect(points[index + 1], rect)) append(points[index + 1]);
    else append(clipped[1]);
  }
  return result;
}

export function getConfiguredMarkerAnchorPoint(
  markerRect: MapEvidenceRect,
  iconSize: { x: number; y: number },
  iconAnchor: { x: number; y: number },
  containerRect: MapEvidenceRect,
): ScreenPoint {
  const scaleX = iconSize.x > 0 ? markerRect.width / iconSize.x : 1;
  const scaleY = iconSize.y > 0 ? markerRect.height / iconSize.y : 1;
  return {
    x: markerRect.left + iconAnchor.x * scaleX - containerRect.left,
    y: markerRect.top + iconAnchor.y * scaleY - containerRect.top,
  };
}

function getOrderedPolylineError(
  expected: readonly ScreenPoint[],
  rendered: readonly ScreenPoint[],
) {
  if (expected.length === 0 || rendered.length === 0 || expected.length !== rendered.length) return Infinity;
  let maximum = 0;
  for (let index = 0; index < expected.length; index += 1) {
    maximum = Math.max(maximum, distance(expected[index], rendered[index]));
  }
  return maximum;
}

export function getSymmetricPolylineError(
  expected: readonly ScreenPoint[],
  rendered: readonly ScreenPoint[],
) {
  if (expected.length === 0 || rendered.length === 0) return Infinity;
  let maximum = 0;
  for (const point of expected) maximum = Math.max(maximum, nearestDistance(point, rendered));
  for (const point of rendered) maximum = Math.max(maximum, nearestDistance(point, expected));
  return maximum;
}

function getMapContainerRect(map: LeafletMap) {
  const container = map.getContainer?.();
  return container?.getBoundingClientRect?.() ?? null;
}

type RasterTile = {
  src?: string;
  getAttribute?: (name: string) => string | null;
  getBoundingClientRect?: () => MapEvidenceRect;
  isConnected?: boolean;
  ownerDocument?: Document;
  offsetWidth?: number;
  offsetHeight?: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

type RasterPane = {
  querySelectorAll?: (selector: string) => ArrayLike<RasterTile>;
};

export type LeafletRasterTileAddress = { zoom: number; x: number; y: number };

/** Parse only the tile URL forms used by the configured ArcGIS/Carto layers. */
export function parseLeafletRasterTileUrl(source: string): LeafletRasterTileAddress | null {
  try {
    const parsed = new URL(source);
    const arcgis = parsed.pathname.match(/\/tile\/(\d+)\/(\d+)\/(\d+)\/?$/i);
    if (arcgis && parsed.hostname === "server.arcgisonline.com") {
      return { zoom: Number(arcgis[1]), x: Number(arcgis[3]), y: Number(arcgis[2]) };
    }
    const carto = parsed.pathname.match(/\/(\d+)\/(\d+)\/(\d+)(?:@2x)?\.png\/?$/i);
    if (carto && (parsed.hostname === "basemaps.cartocdn.com" || parsed.hostname.endsWith(".basemaps.cartocdn.com"))) {
      return { zoom: Number(carto[1]), x: Number(carto[2]), y: Number(carto[3]) };
    }
  } catch {
    // An unloaded/invalid image is a typed probe failure, not a public error.
  }
  return null;
}

const LEAFLET_TILE_SIZE = 256;

type LeafletRasterTileFrame = {
  address: LeafletRasterTileAddress;
  rect: MapEvidenceRect;
  width: number;
  height: number;
};

type LeafletRasterProjection = {
  map: LeafletMap;
  containerRect: DOMRect;
  frames: readonly LeafletRasterTileFrame[];
};

function isConnectedVisibleRasterTile(tile: RasterTile, rect: MapEvidenceRect, containerRect: DOMRect) {
  if (tile.isConnected === false) return false;
  const view = tile.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    const style = view.getComputedStyle(tile as unknown as Element);
    if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) <= 0) return false;
  }
  const intersectionWidth = Math.min(rect.left + rect.width, containerRect.left + containerRect.width) - Math.max(rect.left, containerRect.left);
  const intersectionHeight = Math.min(rect.top + rect.height, containerRect.top + containerRect.height) - Math.max(rect.top, containerRect.top);
  return intersectionWidth > 0 && intersectionHeight > 0;
}

function projectThroughLeafletRasterFrame(
  projection: LeafletRasterProjection,
  frame: LeafletRasterTileFrame,
  coordinate: { lat: number; lng: number },
): ScreenPoint | null {
  const mapWithProject = projection.map as LeafletMap & {
    project: (latLng: [number, number], zoom: number) => ScreenPoint;
  };
  const projected = mapWithProject.project([coordinate.lat, coordinate.lng], frame.address.zoom);
  if (!isFiniteScreenPoint(projected)) return null;
  const localX = projected.x - frame.address.x * LEAFLET_TILE_SIZE;
  const localY = projected.y - frame.address.y * LEAFLET_TILE_SIZE;
  const point = {
    x: frame.rect.left - projection.containerRect.left + localX * (frame.rect.width / frame.width),
    y: frame.rect.top - projection.containerRect.top + localY * (frame.rect.height / frame.height),
  };
  return isFiniteScreenPoint(point) ? point : null;
}

function projectLeafletRasterCoordinate(
  projection: LeafletRasterProjection,
  coordinate: { lat: number; lng: number },
): { point: ScreenPoint; failure: MapFrameSampleFailure | null } {
  const points = projection.frames
    .map((frame) => projectThroughLeafletRasterFrame(projection, frame, coordinate))
    .filter((point): point is ScreenPoint => point !== null);
  if (points.length === 0) return { point: { x: 0, y: 0 }, failure: "missing-raster-tile" };
  const first = points[0];
  if (points.some((point) => distance(point, first) > 2)) {
    return { point: { x: 0, y: 0 }, failure: "inconsistent-raster-projection" };
  }
  return { point: first, failure: null };
}

function buildLeafletRasterProjection(
  map: LeafletMap,
  containerRect: DOMRect,
): { projection: LeafletRasterProjection | null; failure: MapFrameSampleFailure | null } {
  const tilePane = map.getPanes?.().tilePane as RasterPane | undefined;
  const rawTiles = tilePane?.querySelectorAll?.(".leaflet-tile");
  const tiles = rawTiles ? Array.from(rawTiles) : [];
  if (tiles.length === 0 || typeof (map as LeafletMap & { project?: unknown }).project !== "function") {
    return { projection: null, failure: "missing-raster-tile" };
  }
  const frames: LeafletRasterTileFrame[] = [];
  for (const tile of tiles) {
    const source = tile.src ?? tile.getAttribute?.("src") ?? "";
    const address = parseLeafletRasterTileUrl(source);
    if (!address) continue;
    const rect = tile.getBoundingClientRect?.();
    const width = tile.offsetWidth ?? 0;
    const height = tile.offsetHeight ?? 0;
    const naturalWidth = tile.naturalWidth ?? 0;
    const naturalHeight = tile.naturalHeight ?? 0;
    if (
      !rect ||
      ![rect.left, rect.top, rect.width, rect.height, width, height, naturalWidth, naturalHeight]
        .every((value) => Number.isFinite(value)) ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      width <= 0 ||
      height <= 0 ||
      naturalWidth <= 0 ||
      naturalHeight <= 0
    ) continue;
    if (!isConnectedVisibleRasterTile(tile, rect, containerRect)) continue;
    frames.push({ address, rect, width, height });
  }
  if (frames.length === 0) return { projection: null, failure: "missing-raster-tile" };
  const projection: LeafletRasterProjection = { map, containerRect, frames };
  const validationCoordinates = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }];
  for (const coordinate of validationCoordinates) {
    const validation = projectLeafletRasterCoordinate(projection, coordinate);
    if (validation.failure) return { projection: null, failure: validation.failure };
  }
  return { projection, failure: null };
}

function getLeafletRasterTilePoint(
  map: LeafletMap,
  containerRect: DOMRect,
  coordinate: { lat: number; lng: number },
): { point: ScreenPoint; failure: MapFrameSampleFailure | null } {
  const result = buildLeafletRasterProjection(map, containerRect);
  if (!result.projection || result.failure) return { point: { x: 0, y: 0 }, failure: result.failure ?? "missing-raster-tile" };
  return projectLeafletRasterCoordinate(result.projection, coordinate);
}

function transformScreenPoint(
  x: number,
  y: number,
  transform: { a: number; b: number; c: number; d: number; e: number; f: number },
  containerRect: MapEvidenceRect,
): ScreenPoint {
  return {
    x: transform.a * x + transform.c * y + transform.e - containerRect.left,
    y: transform.b * x + transform.d * y + transform.f - containerRect.top,
  };
}

/**
 * Samples an SVG path in rendered screen space. SVG `getTotalLength()` is in
 * local path units, so the affine transform's Frobenius norm provides a safe
 * upper bound for each transformed segment. The 256-point cap is explicit:
 * callers receive a typed sampling failure rather than silently violating the
 * 16 CSS-pixel spacing budget.
 */
export function sampleRenderedPolylineScreenSpace(
  totalLength: number,
  getPointAtLength: (length: number) => ScreenPoint | null | undefined,
  transform: AffineTransform,
  containerRect: MapEvidenceRect,
  maxSamples = 256,
): SampledScreenPolyline {
  const limit = Math.min(256, Math.max(2, Math.floor(Number.isFinite(maxSamples) ? maxSamples : 256)));
  const screenScaleBound = Math.hypot(transform.a, transform.b, transform.c, transform.d);
  if (
    !Number.isFinite(totalLength) ||
    totalLength <= 0 ||
    !Number.isFinite(screenScaleBound) ||
    screenScaleBound <= 0
  ) return { points: [], failure: null };
  const localInterval = 16 / screenScaleBound;
  const requestedSampleCount = Math.max(2, Math.ceil(totalLength / localInterval) + 1);
  const sampleCount = Math.min(limit, requestedSampleCount);
  const result: ScreenPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const point = getPointAtLength((totalLength * index) / (sampleCount - 1));
    if (!point || !isFiniteScreenPoint(point)) return { points: [], failure: null };
    const transformed = transformScreenPoint(point.x, point.y, transform, containerRect);
    if (!isFiniteScreenPoint(transformed)) return { points: [], failure: null };
    result.push(transformed);
  }
  return {
    points: result,
    failure: requestedSampleCount > limit ? "sampling-capped" : null,
  };
}

function readRenderedPolyline(
  polyline: LeafletPolyline,
  containerRect: DOMRect,
): { points: ScreenPoint[]; visualRouteScale: number | null; failure: MapFrameSampleFailure | null } {
  const element = polyline.getElement?.() as (SVGPathElement & {
    getTotalLength?: () => number;
    getPointAtLength?: (length: number) => { x: number; y: number };
    getScreenCTM?: () => {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
    } | null;
  }) | null;
  if (!element) return { points: [], visualRouteScale: null, failure: "missing-route-element" };
  const totalLength = element.getTotalLength?.();
  const transform = element.getScreenCTM?.();
  const visualRouteScale = getAffineTransformScale(transform);
  if (
    typeof totalLength !== "number" ||
    !Number.isFinite(totalLength) ||
    totalLength <= 0 ||
    !transform ||
    ![transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]
      .every((value) => Number.isFinite(value))
  ) return { points: [], visualRouteScale: null, failure: "missing-route-geometry" };
  if (visualRouteScale === null) return { points: [], visualRouteScale: null, failure: "missing-route-geometry" };
  const sampled = sampleRenderedPolylineScreenSpace(
    totalLength,
    (length) => element.getPointAtLength?.(length),
    transform,
    containerRect,
  );
  if (sampled.points.length === 0) return { points: [], visualRouteScale, failure: "missing-route-geometry" };
  const clipped = clipScreenPolylineToRect(sampled.points, {
    left: 0,
    top: 0,
    width: containerRect.width,
    height: containerRect.height,
  });
  return clipped.length > 0
    ? { points: clipped, visualRouteScale, failure: sampled.failure }
    : { points: [], visualRouteScale, failure: "missing-route-geometry" };
}

function projectCoordinate(
  state: ProbeState,
  map: LeafletMap,
  containerRect: DOMRect,
  coordinate: { lat: number; lng: number },
  rasterProjection?: LeafletRasterProjection | null,
): { point: ScreenPoint; failure: MapFrameSampleFailure | null } {
  if (state.mapLibreMap) {
    const mapLibre = state.mapLibreMap;
    const canvas = mapLibre.getCanvas?.();
    const mapLibreContainer = mapLibre.getContainer?.();
    if (!canvas || !mapLibreContainer || typeof mapLibre.project !== "function") {
      return { point: { x: 0, y: 0 }, failure: "missing-renderer-projection" };
    }
    const mapLibreRect = canvas.getBoundingClientRect();
    const mapWithProject = mapLibre as MapLibreEvidenceMap;
    let projected: ScreenPoint;
    try {
      projected = mapWithProject.project.call(mapWithProject, [coordinate.lng, coordinate.lat]);
    } catch {
      return { point: { x: 0, y: 0 }, failure: "missing-renderer-projection" };
    }
    const clientSize = {
      width: mapLibreContainer.clientWidth || canvas.clientWidth || canvas.width || mapLibreRect.width,
      height: mapLibreContainer.clientHeight || canvas.clientHeight || canvas.height || mapLibreRect.height,
    };
    if (
      ![mapLibreRect.left, mapLibreRect.top].every((value) => Number.isFinite(value)) ||
      ![mapLibreRect.width, mapLibreRect.height, clientSize.width, clientSize.height]
        .every((value) => Number.isFinite(value) && value > 0) ||
      !isFiniteScreenPoint(projected)
    ) return { point: { x: 0, y: 0 }, failure: "missing-renderer-projection" };
    return {
      point: normalizeMapLibreProjection(
        projected,
        clientSize,
        mapLibreRect,
        {
          left: containerRect.left,
          top: containerRect.top,
          width: containerRect.width,
          height: containerRect.height,
        },
      ),
      failure: null,
    };
  }

  if (rasterProjection) return projectLeafletRasterCoordinate(rasterProjection, coordinate);
  return getLeafletRasterTilePoint(map, containerRect, coordinate);
}

function getRouteCoordinates(polyline: LeafletPolyline) {
  const latLngs = polyline.getLatLngs?.() as unknown;
  const result: Array<{ lat: number; lng: number }> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (
      value &&
      typeof value === "object" &&
      typeof (value as { lat?: unknown }).lat === "number" &&
      typeof (value as { lng?: unknown }).lng === "number"
    ) {
      result.push({ lat: (value as { lat: number }).lat, lng: (value as { lng: number }).lng });
    }
  };
  visit(latLngs);
  return result;
}

function routeMatchesAuthoritativePath(route: RegisteredRoute) {
  const actual = getRouteCoordinates(route.polyline);
  return (
    actual.length === route.path.length &&
    actual.every((point, index) =>
      Math.abs(point.lat - route.path[index].lat) <= 1e-7 &&
      Math.abs(point.lng - route.path[index].lng) <= 1e-7,
    )
  );
}

function getMapLibreRenderedFrameFailure(state: ProbeState): MapFrameSampleFailure | null {
  if (!state.mapLibreMap) return null;
  const mapWithProject = state.mapLibreMap as MapLibreEvidenceMap;
  if (typeof mapWithProject.project !== "function") return "missing-renderer-projection";
  if (!readMapLibreCanvasFrame(mapWithProject)) return "missing-route-baseline";
  const token = state.mapLibreRenderToken;
  const snapshot = state.mapLibreRenderSnapshot;
  if (state.mapLibreRenderGeneration <= 0 || token === null || token <= 0 || !snapshot) return "missing-renderer-frame";
  if (snapshot.generation !== state.mapLibreRenderGeneration || snapshot.token !== token) return "missing-renderer-frame";
  const current = captureMapLibreRenderSnapshot(state.mapLibreMap, state.mapLibreRenderGeneration, token);
  if (!current || !mapLibreRenderSnapshotsMatch(snapshot, current)) {
    return "missing-renderer-frame";
  }
  return null;
}

function getRouteBaselineFailure(
  state: ProbeState,
  route: RegisteredRoute,
  mapRect: DOMRect,
): MapFrameSampleFailure | null {
  const rendererFailure = getMapLibreRenderedFrameFailure(state);
  if (rendererFailure) return rendererFailure;
  const rasterProjectionResult = state.mapLibreMap
    ? { projection: null, failure: null }
    : buildLeafletRasterProjection(route.map, mapRect);
  if (rasterProjectionResult.failure) return rasterProjectionResult.failure;
  const projectedPath: ScreenPoint[] = [];
  let projectionFailure: MapFrameSampleFailure | null = null;
  for (const coordinate of route.path) {
    const projected = projectCoordinate(
      state,
      route.map,
      mapRect,
      coordinate,
      rasterProjectionResult.projection,
    );
    projectionFailure ??= projected.failure;
    projectedPath.push(projected.point);
  }
  if (projectionFailure) return projectionFailure;
  const expectedDetailed = sampleScreenPolylineDetailed(
    clipScreenPolylineToRect(projectedPath, {
      left: 0,
      top: 0,
      width: mapRect.width,
      height: mapRect.height,
    }),
    256,
  );
  const rendered = readRenderedPolyline(route.polyline, mapRect);
  if (expectedDetailed.failure || rendered.failure) {
    return expectedDetailed.failure ?? rendered.failure;
  }
  if (expectedDetailed.points.length < 2 || rendered.points.length < 2) {
    return "missing-route-baseline";
  }
  const comparisonCount = Math.min(
    256,
    Math.max(expectedDetailed.points.length, rendered.points.length),
  );
  if (comparisonCount < 2) return "missing-route-baseline";
  const expected = resamplePolylineByNormalizedLength(expectedDetailed.points, comparisonCount);
  const actual = resamplePolylineByNormalizedLength(rendered.points, comparisonCount);
  const error = getOrderedPolylineError(expected, actual);
  return Number.isFinite(error) && error <= 2 ? null : "missing-route-baseline";
}

function hasFiniteAffineTransform(transform: AffineTransform | null | undefined) {
  return Boolean(transform) && [
    transform!.a,
    transform!.b,
    transform!.c,
    transform!.d,
    transform!.e,
    transform!.f,
  ].every((value) => Number.isFinite(value));
}

function routeReadinessFailure(state: ProbeState, route: RegisteredRoute): MapFrameSampleFailure | null {
  if (route.readinessFailure && (route.readinessSettled || route.readinessAttempts === 0)) {
    return route.readinessFailure;
  }
  if (route.path.length < 2) return "missing-route-path";
  if (!routeMatchesAuthoritativePath(route)) return "route-not-synced";

  const vectorCanvasExists = typeof document !== "undefined" && Boolean(document.querySelector(".maplibregl-canvas"));
  if (vectorCanvasExists && !state.mapLibreMap) return "missing-renderer-registration";

  const routeElement = route.polyline.getElement?.() as (SVGPathElement & {
    getScreenCTM?: () => AffineTransform | null;
  }) | null;
  if (!routeElement) return "missing-route-baseline";
  if (!hasFiniteAffineTransform(routeElement.getScreenCTM?.())) return "missing-route-geometry";

  const mapContainer = route.map.getContainer?.();
  const mapRect = mapContainer?.getBoundingClientRect?.();
  if (!mapRect || ![mapRect.left, mapRect.top, mapRect.width, mapRect.height].every(Number.isFinite) || mapRect.width <= 0 || mapRect.height <= 0) {
    return "missing-route-baseline";
  }

  const baselineFailure = getRouteBaselineFailure(state, route, mapRect as DOMRect);
  if (baselineFailure) return baselineFailure;

  const destination = state.destination;
  if (!destination) return "missing-destination";
  const markerElement = destination.marker.getElement?.();
  const markerRect = markerElement?.getBoundingClientRect?.();
  if (!markerElement || !markerRect || ![markerRect.left, markerRect.top, markerRect.width, markerRect.height].every(Number.isFinite) || markerRect.width <= 0 || markerRect.height <= 0) {
    return "missing-destination-element";
  }
  return null;
}

const RETRYABLE_ROUTE_READINESS_FAILURES = new Set<MapFrameSampleFailure>([
  "missing-destination",
  "missing-destination-element",
  "missing-renderer-frame",
]);

const ROUTE_READINESS_DEADLINE_MS = 1_500;
const ROUTE_READINESS_MAX_ATTEMPTS = 90;

function evidenceNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function finishRouteReadiness(
  state: ProbeState,
  route: RegisteredRoute,
  failure: MapFrameSampleFailure | null,
) {
  if (!isStateActive(state) || state.route !== route) return;
  if (route.settleFrameId !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(route.settleFrameId);
  }
  if (route.settleTimeout !== null) clearTimeout(route.settleTimeout);
  route.readinessFailure = failure;
  route.ready = failure === null;
  route.readinessSettled = true;
  if (route.readinessRetryTimeout !== null) clearTimeout(route.readinessRetryTimeout);
  if (route.readinessDeadlineTimeout !== null) clearTimeout(route.readinessDeadlineTimeout);
  route.readinessRetryTimeout = null;
  route.readinessDeadlineTimeout = null;
  route.settleFrameId = null;
  route.settleTimeout = null;
}

function cancelRouteReadiness(route: RegisteredRoute) {
  if (route.settleFrameId !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(route.settleFrameId);
  }
  if (route.settleTimeout !== null) clearTimeout(route.settleTimeout);
  if (route.readinessRetryTimeout !== null) clearTimeout(route.readinessRetryTimeout);
  if (route.readinessDeadlineTimeout !== null) clearTimeout(route.readinessDeadlineTimeout);
  route.settleFrameId = null;
  route.settleTimeout = null;
  route.readinessRetryTimeout = null;
  route.readinessDeadlineTimeout = null;
}

function scheduleRouteReadiness(state: ProbeState, route: RegisteredRoute) {
  const settle = () => {
    route.settleFrameId = null;
    route.settleTimeout = null;
    if (!isStateActive(state) || state.route !== route) return;
    const failure = routeReadinessFailure(state, route);
    if (!failure) {
      finishRouteReadiness(state, route, null);
      return;
    }
    route.readinessFailure = failure;
    route.ready = false;
    const now = evidenceNow();
    if (
      RETRYABLE_ROUTE_READINESS_FAILURES.has(failure) &&
      now < route.readinessDeadlineAt &&
      route.readinessAttempts < ROUTE_READINESS_MAX_ATTEMPTS
    ) {
      route.readinessSettled = false;
      route.readinessAttempts += 1;
      route.readinessRetryTimeout = setTimeout(() => {
        route.readinessRetryTimeout = null;
        scheduleRouteReadiness(state, route);
      }, 16);
      return;
    }
    finishRouteReadiness(state, route, failure);
  };
  if (route.readinessSettled) return;
  if (typeof requestAnimationFrame === "function") route.settleFrameId = requestAnimationFrame(settle);
  else route.settleTimeout = setTimeout(settle, 0);
}

function appendFrame(
  state: ProbeState,
  startedAt: number,
  sample: Omit<MapFrameSample, "frameIndex" | "at" | "probeCostMs" | "zoom" | "animatingZoom" | "visualRouteSpanPx" | "visualRouteScale" | "rendererFrameToken" | "rendererGeneration"> &
    Partial<Pick<MapFrameSample, "zoom" | "animatingZoom" | "visualRouteSpanPx" | "visualRouteScale" | "rendererFrameToken" | "rendererGeneration">>,
) {
  const at = typeof performance === "undefined" ? Date.now() : performance.now();
  const measurementCostMs = Math.max(0, at - startedAt);
  const map = state.route?.map ?? state.leafletMap;
  const zoom = sample.zoom ?? (typeof map?.getZoom === "function" ? map.getZoom() : null);
  const animatingZoom = sample.animatingZoom ?? Boolean((map as unknown as { _animatingZoom?: unknown } | null)?._animatingZoom);
  state.frameProbeCostMs += measurementCostMs;
  state.frames.push({
    frameIndex: state.frameCount,
    at,
    probeCostMs: measurementCostMs,
    zoom: typeof zoom === "number" && Number.isFinite(zoom) ? zoom : null,
    animatingZoom,
    ...sample,
    visualRouteSpanPx: sample.visualRouteSpanPx ?? null,
    visualRouteScale: sample.visualRouteScale ?? null,
    rendererFrameToken: sample.rendererFrameToken ?? (state.mapLibreMap ? state.mapLibreRenderToken : null),
    rendererGeneration: sample.rendererGeneration ?? (state.mapLibreMap ? state.mapLibreRenderGeneration : null),
  });
}

function recordFrame(state: ProbeState) {
  const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
  const map = state.route?.map ?? state.leafletMap;
  if (!map) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-map" });
    return;
  }
  const vectorCanvasExists = typeof document !== "undefined" && Boolean(document.querySelector(".maplibregl-canvas"));
  if (vectorCanvasExists && !state.mapLibreMap) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-renderer-registration" });
    return;
  }
  if (state.mapLibreMap && state.mapLibreRenderToken === null) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-renderer-frame" });
    return;
  }
  if (state.frameAwaitingRendererFrame) {
    return;
  }
  if (
    state.mapLibreMap &&
    state.frameTransitionRendererToken !== null &&
    state.mapLibreRenderToken === state.frameTransitionRendererToken
  ) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-renderer-frame" });
    return;
  }
  const renderedFrameFailure = state.mapLibreMap ? getMapLibreRenderedFrameFailure(state) : null;
  if (renderedFrameFailure) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: renderedFrameFailure });
    return;
  }
  const route = state.route;
  if (!route) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route" });
    return;
  }
  if (!route.ready) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: route.readinessFailure ?? "route-not-synced" });
    return;
  }
  if (route.path.length < 2) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route-path" });
    return;
  }
  const containerRect = getMapContainerRect(map);
  if (
    !containerRect ||
    ![containerRect.left, containerRect.top, containerRect.width, containerRect.height]
      .every((value) => Number.isFinite(value)) ||
    containerRect.width <= 0 ||
    containerRect.height <= 0
  ) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route-geometry" });
    return;
  }

  try {
    const rasterProjectionResult = state.mapLibreMap
      ? { projection: null, failure: null }
      : buildLeafletRasterProjection(map, containerRect);
    const projectedPath: ScreenPoint[] = [];
    let projectionFailure: MapFrameSampleFailure | null = rasterProjectionResult.failure;
    for (const point of route.path) {
      const projected = projectCoordinate(state, map, containerRect, point, rasterProjectionResult.projection);
      projectionFailure ??= projected.failure;
      projectedPath.push(projected.point);
    }
    const clippedExpected = clipScreenPolylineToRect(projectedPath, {
      left: 0,
      top: 0,
      width: containerRect.width,
      height: containerRect.height,
    });
    const expectedDetailed = sampleScreenPolylineDetailed(clippedExpected, 256);
    const renderedResult = readRenderedPolyline(route.polyline, containerRect);
    if (projectionFailure || expectedDetailed.points.length < 2 || renderedResult.points.length < 2) {
      appendFrame(state, startedAt, {
        routeVisible: false,
        routeErrorPx: null,
        destinationErrorPx: null,
        rendererErrorPx: null,
        expectedSampleCount: expectedDetailed.points.length,
        renderedSampleCount: renderedResult.points.length,
        failure: projectionFailure ?? expectedDetailed.failure ?? renderedResult.failure ?? "missing-route-geometry",
      });
      return;
    }
    const comparisonCount = Math.min(256, Math.max(expectedDetailed.points.length, renderedResult.points.length));
    if (comparisonCount < 2) {
      appendFrame(state, startedAt, {
        routeVisible: false,
        routeErrorPx: null,
        destinationErrorPx: null,
        rendererErrorPx: null,
        expectedSampleCount: expectedDetailed.points.length,
        renderedSampleCount: renderedResult.points.length,
        failure: "incompatible-sample-count",
      });
      return;
    }
    const expected = resamplePolylineByNormalizedLength(expectedDetailed.points, comparisonCount);
    const rendered = resamplePolylineByNormalizedLength(renderedResult.points, comparisonCount);

    let sampleFailure: MapFrameSampleFailure | null = expectedDetailed.failure ?? renderedResult.failure;
    let destinationErrorPx: number | null = null;
    let rendererErrorPx: number | null = null;
    const destination = state.destination;
    if (!destination) {
      sampleFailure ??= "missing-destination";
    } else {
      const markerElement = destination.marker.getElement?.();
      const markerRect = markerElement?.getBoundingClientRect?.();
      if (
        !markerElement ||
        !markerRect ||
        ![markerRect.left, markerRect.top, markerRect.width, markerRect.height]
          .every((value) => Number.isFinite(value)) ||
        markerRect.width <= 0 ||
        markerRect.height <= 0
      ) {
        sampleFailure ??= "missing-destination-element";
      } else {
        const expectedDestination = projectCoordinate(state, map, containerRect, destination.coordinate, rasterProjectionResult.projection);
        sampleFailure ??= expectedDestination.failure;
        if (!expectedDestination.failure) {
          const renderedDestination = getConfiguredMarkerAnchorPoint(
            markerRect,
            destination.iconSize,
            destination.iconAnchor,
            containerRect,
          );
          destinationErrorPx = distance(expectedDestination.point, renderedDestination);
          if (state.mapLibreMap) {
            const leafletDestination = projectCoordinate({ ...state, mapLibreMap: null }, map, containerRect, destination.coordinate);
            if (!leafletDestination.failure) rendererErrorPx = distance(expectedDestination.point, leafletDestination.point);
          }
        }
      }
    }
    appendFrame(state, startedAt, {
      routeVisible: sampleFailure === null,
      routeErrorPx: getOrderedPolylineError(expected, rendered),
      destinationErrorPx,
      rendererErrorPx,
      expectedSampleCount: expected.length,
      renderedSampleCount: rendered.length,
      visualRouteScale: renderedResult.visualRouteScale,
      visualRouteSpanPx: rendered.length >= 2
        ? rendered.slice(1).reduce((total, point, index) => total + distance(rendered[index], point), 0)
        : null,
      failure: sampleFailure,
    });
  } catch {
    appendFrame(state, startedAt, {
      routeVisible: false,
      routeErrorPx: null,
      destinationErrorPx: null,
      rendererErrorPx: null,
      expectedSampleCount: 0,
      renderedSampleCount: 0,
      failure: "missing-route-geometry",
    });
  }
}

function scheduleFrame(state: ProbeState) {
  if (state.frameCount >= 600 || state.totalFrameCount >= 600) {
    stopFrameProbeForState(state, "max-frames");
    return;
  }
  const callback = () => {
    state.frameId = null;
    state.frameTimeout = null;
    if (!isStateActive(state)) return;
    if (
      state.frameProbeStartedAt !== null &&
      (typeof performance === "undefined" ? Date.now() : performance.now()) - state.frameProbeStartedAt >= 10_000
    ) {
      stopFrameProbeForState(state, "wall-clock-timeout");
      return;
    }
    // Route registration settles on its own animation frame. Do not spend a
    // sample on that transient state; the first stored frame must be a
    // comparison against a committed, authoritative path.
    if (state.route && !state.route.readinessSettled) {
      scheduleFrame(state);
      return;
    }
    if (state.route && state.route.readinessSettled && !state.route.ready) {
      state.frameCount += 1;
      state.totalFrameCount += 1;
      recordFrame(state);
      stopFrameProbeForState(state, "route-readiness-timeout");
      return;
    }
    if (state.frameAwaitingRendererFrame) {
      if (!hasRendererAdvancedSinceInput(state)) {
        scheduleFrame(state);
        return;
      }
      state.frameAwaitingRendererFrame = false;
      if (state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
      state.frameAwaitingRendererTimeout = null;
    }
    if (state.totalFrameCount >= 600) {
      stopFrameProbeForState(state, "max-frames");
      return;
    }
    state.frameCount += 1;
    state.totalFrameCount += 1;
    recordFrame(state);
    scheduleFrame(state);
  };
  if (typeof requestAnimationFrame === "function") {
    state.frameId = requestAnimationFrame(callback);
  } else {
    state.frameTimeout = setTimeout(callback, 16);
  }
}

function stopFrameProbeForState(
  state: ProbeState,
  reason: MapEvidenceSnapshot["frameProbe"]["stopReason"] = "explicit",
) {
  if (state.frameId !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(state.frameId);
  }
  if (state.frameTimeout !== null) clearTimeout(state.frameTimeout);
  if (state.wallClockTimeout !== null) clearTimeout(state.wallClockTimeout);
  if (state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
  state.frameId = null;
  state.frameTimeout = null;
  state.wallClockTimeout = null;
  state.frameAwaitingRendererTimeout = null;
  if (state.frameProbeStartedAt !== null && state.frameProbeStoppedAt === null) {
    state.frameProbeStoppedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    state.frameProbeStopReason = reason;
  }
}

function detachMapLibreRenderListener(state: ProbeState) {
  if (state.mapLibreRenderMap && state.mapLibreRenderListener) {
    const mapWithEvents = state.mapLibreRenderMap as MapLibreMap & {
      off?: (type: string, listener: () => void) => void;
    };
    try {
      mapWithEvents.off?.("render", state.mapLibreRenderListener);
    } catch {
      // A non-conforming renderer must not prevent the probe from clearing its
      // own listener and frame state. The evidence surface fails closed.
    }
  }
  state.mapLibreRenderMap = null;
  state.mapLibreRenderListener = null;
  state.mapLibreRenderToken = null;
  state.mapLibreRenderSnapshot = null;
  state.frameTransitionRendererToken = null;
  state.frameTransitionRendererGeneration = null;
  state.frameTransitionRendererSnapshot = null;
  state.frameAwaitingRendererFrame = false;
  if (state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
  state.frameAwaitingRendererTimeout = null;
}

function cancelPendingDelays(state: ProbeState, error = new DOMException("Route request was cancelled", "AbortError")) {
  for (const pending of [...state.pendingDelays]) pending.onAbort(error);
}

function cloneMapLibreRenderSnapshot(snapshot: MapLibreRenderSnapshot | null) {
  return snapshot
    ? {
        ...snapshot,
        canvasRect: { ...snapshot.canvasRect },
        projectedAnchor: { ...snapshot.projectedAnchor },
      }
    : null;
}

function hasRendererAdvancedSinceInput(state: ProbeState) {
  if (!state.mapLibreMap) return true;
  const snapshot = state.mapLibreRenderSnapshot;
  if (!snapshot || snapshot.generation !== state.mapLibreRenderGeneration) return false;
  const boundary = state.frameTransitionRendererSnapshot;
  if (!boundary) return snapshot.token > 0;
  return snapshot.generation !== boundary.generation || snapshot.token > boundary.token;
}

function failAwaitingRendererFrame(state: ProbeState) {
  if (!isStateActive(state) || !state.frameAwaitingRendererFrame) return;
  state.frameAwaitingRendererFrame = false;
  state.frameAwaitingRendererTimeout = null;
  if (state.totalFrameCount >= 600) {
    stopFrameProbeForState(state, "max-frames");
    return;
  }
  state.frameCount += 1;
  state.totalFrameCount += 1;
  const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
  appendFrame(state, startedAt, {
    routeVisible: false,
    routeErrorPx: null,
    destinationErrorPx: null,
    rendererErrorPx: null,
    expectedSampleCount: 0,
    renderedSampleCount: 0,
    failure: "missing-renderer-frame",
  });
  stopFrameProbeForState(state, "wall-clock-timeout");
}

function failRendererReplacement(state: ProbeState) {
  if (
    !isStateActive(state) ||
    state.frameProbeStartedAt === null ||
    state.frameProbeStoppedAt !== null ||
    state.frameTransitionRendererGeneration === null
  ) return;
  state.frameAwaitingRendererFrame = false;
  if (state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
  state.frameAwaitingRendererTimeout = null;
  if (state.totalFrameCount < 600) {
    state.frameCount += 1;
    state.totalFrameCount += 1;
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    appendFrame(state, startedAt, {
      routeVisible: false,
      routeErrorPx: null,
      destinationErrorPx: null,
      rendererErrorPx: null,
      expectedSampleCount: 0,
      renderedSampleCount: 0,
      rendererGeneration: state.frameTransitionRendererGeneration,
      failure: "missing-renderer-frame",
    });
  }
  stopFrameProbeForState(state, "renderer-replacement");
}

function armFrameProbeForInputState(state: ProbeState): MapFrameProbeBoundary {
  if (state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
  state.frames = [];
  state.frameCount = 0;
  state.frameProbeCostMs = 0;
  state.frameProbeStoppedAt = null;
  state.frameProbeStopReason = null;
  state.frameTransitionRendererToken = state.mapLibreRenderToken;
  state.frameTransitionRendererGeneration = state.mapLibreRenderGeneration;
  state.frameTransitionRendererSnapshot = cloneMapLibreRenderSnapshot(state.mapLibreRenderSnapshot);
  state.frameAwaitingRendererFrame = Boolean(state.mapLibreMap);
  state.frameAwaitingRendererTimeout = state.mapLibreMap
    ? setTimeout(() => failAwaitingRendererFrame(state), 1_000)
    : null;
  return {
    generation: state.mapLibreRenderGeneration,
    token: state.mapLibreRenderToken,
  };
}

function createApi(state: ProbeState): MapEvidenceApi {
  const isActive = () => isStateActive(state);
  return {
    snapshot: () => isActive()
      ? {
          events: state.events.map((event) => ({ ...event })),
          frames: state.frames.map((frame) => ({ ...frame })),
          routeDelayMs: state.routeDelayMs,
          frameProbeRunning: state.frameId !== null || state.frameTimeout !== null,
          frameProbe: {
            startedAt: state.frameProbeStartedAt,
            stoppedAt: state.frameProbeStoppedAt,
            frameCount: state.frameCount,
            stopReason: state.frameProbeStopReason,
            totalCostMs: state.frameProbeCostMs,
          },
        }
      : {
          events: [],
          frames: [],
          routeDelayMs: 0,
          frameProbeRunning: false,
          frameProbe: {
            startedAt: null,
            stoppedAt: null,
            frameCount: 0,
            stopReason: "cleanup",
            totalCostMs: 0,
          },
        },
    events: () => isActive() ? state.events.map((event) => ({ ...event })) : [],
    reset: () => {
      if (!isActive()) return;
      stopFrameProbeForState(state, "explicit");
      cancelPendingDelays(state);
      state.events = [];
      state.frames = [];
      state.nextEventSequence = 1;
      state.nextCorrelationOrdinal = 1;
      state.correlationOrdinals.clear();
      state.correlationAliases.clear();
      state.routeDelayMs = 0;
      state.failNextRoute = false;
      state.frameCount = 0;
      state.frameProbeStartedAt = null;
      state.frameProbeStoppedAt = null;
      state.frameProbeStopReason = null;
      state.frameProbeCostMs = 0;
      state.frameTransitionRendererToken = null;
      state.frameTransitionRendererGeneration = null;
      state.frameTransitionRendererSnapshot = null;
      state.frameAwaitingRendererFrame = false;
      state.frameAwaitingRendererTimeout = null;
    },
    startFrameProbe: () => {
      if (!isActive()) return;
      if (state.frameId !== null || state.frameTimeout !== null) return;
      state.frameProbeStartedAt = typeof performance === "undefined" ? Date.now() : performance.now();
      state.frameProbeStoppedAt = null;
      state.frameProbeStopReason = null;
      state.frameProbeCostMs = 0;
      state.frameCount = 0;
      state.frameTransitionRendererToken = null;
      state.frameTransitionRendererGeneration = null;
      state.frameTransitionRendererSnapshot = null;
      state.frameAwaitingRendererFrame = false;
      state.frameAwaitingRendererTimeout = null;
      state.wallClockTimeout = setTimeout(() => {
        if (!isStateActive(state)) return;
        stopFrameProbeForState(state, "wall-clock-timeout");
      }, 10_000);
      scheduleFrame(state);
    },
    armFrameProbeForInput: () => {
      if (!isActive()) return { generation: 0, token: null };
      return armFrameProbeForInputState(state);
    },
    markFrameProbeBoundary: () => {
      if (!isActive()) return;
      armFrameProbeForInputState(state);
    },
    stopFrameProbe: () => {
      if (!isActive()) return;
      stopFrameProbeForState(state);
    },
    setRouteDelayMs: (delayMs) => {
      if (!isActive()) return;
      state.routeDelayMs = Number.isFinite(delayMs) ? Math.max(0, Math.min(10_000, delayMs)) : 0;
    },
    failNextRoute: () => {
      if (!isActive()) return;
      state.failNextRoute = true;
    },
    zoomTo: (zoom) => {
      if (!isActive()) return;
      if (Number.isFinite(zoom)) state.leafletMap?.setZoom(zoom);
    },
    panBy: (x, y) => {
      if (!isActive() || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const boundedX = Math.max(-2_000, Math.min(2_000, x));
      const boundedY = Math.max(-2_000, Math.min(2_000, y));
      state.leafletMap?.panBy([boundedX, boundedY], { animate: false });
    },
  };
}

function disposeState(state: ProbeState) {
  stopFrameProbeForState(state, "cleanup");
  detachMapLibreRenderListener(state);
  if (state.visibilityChangeHandler) {
    state.visibilityDocument?.removeEventListener("visibilitychange", state.visibilityChangeHandler);
    state.visibilityChangeHandler = null;
  }
  cancelPendingDelays(state, new DOMException("Map evidence probe was disposed", "AbortError"));
  if (state.route) cancelRouteReadiness(state.route);
  state.leafletMap = null;
  state.mapLibreMap = null;
  state.route = null;
  state.destination = null;
  state.events = [];
  state.frames = [];
  state.correlationOrdinals.clear();
  state.correlationAliases.clear();
  if (state.window.__VSU_MAP_E2E__ === state.api) delete state.window.__VSU_MAP_E2E__;
  if (activeState === state) activeState = null;
}

export function isMapEvidenceEnabled(url: string) {
  try {
    const parsed = new URL(url);
    const allowedOrigin = new Set([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app",
    ]);
    const evidenceValues = parsed.searchParams.getAll("mapEvidence");
    return (
      allowedOrigin.has(parsed.origin) &&
      parsed.username === "" &&
      parsed.password === "" &&
      evidenceValues.length === 1 &&
      evidenceValues[0] === "1"
    );
  } catch {
    return false;
  }
}

export function initializeMapEvidence(url: string): () => void {
  if (!isMapEvidenceEnabled(url) || typeof window === "undefined") return () => undefined;
  const hostWindow = window;
  if (
    hostWindow.__VSU_MAP_E2E__ !== undefined &&
    (!activeState || activeState.window !== hostWindow || hostWindow.__VSU_MAP_E2E__ !== activeState.api)
  ) {
    return () => undefined;
  }
  if (activeState && activeState.window === hostWindow && hostWindow.__VSU_MAP_E2E__ === activeState.api) {
    const state = activeState;
    state.ownerCount += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      state.ownerCount -= 1;
      if (state.ownerCount === 0) disposeState(state);
    };
  }

  const state = {
    ownerCount: 1,
    api: null as unknown as MapEvidenceApi,
    window: hostWindow,
    leafletMap: null,
    mapLibreMap: null,
    route: null,
    destination: null,
    events: [],
    frames: [],
    correlationOrdinals: new Map<string, number>(),
    correlationAliases: new Map<string, number>(),
    nextCorrelationOrdinal: 1,
    nextEventSequence: 1,
    routeDelayMs: 0,
    failNextRoute: false,
    frameId: null,
    frameTimeout: null,
    frameCount: 0,
    pendingDelays: new Set<PendingDelay>(),
    wallClockTimeout: null,
    frameProbeStartedAt: null,
    frameProbeStoppedAt: null,
    frameProbeStopReason: null,
    frameProbeCostMs: 0,
    totalFrameCount: 0,
    mapLibreRenderGeneration: 0,
    mapLibreRenderSequence: 0,
    mapLibreRenderToken: null,
    mapLibreRenderMap: null,
    mapLibreRenderListener: null,
    mapLibreRenderSnapshot: null,
    frameTransitionRendererToken: null,
    frameTransitionRendererGeneration: null,
    frameTransitionRendererSnapshot: null,
    frameAwaitingRendererFrame: false,
    frameAwaitingRendererTimeout: null,
    visibilityDocument: null,
    visibilityChangeHandler: null,
  } as ProbeState;
  state.api = createApi(state);
  activeState = state;
  hostWindow.__VSU_MAP_E2E__ = state.api;
  state.visibilityChangeHandler = () => {
    if (!isStateActive(state)) return;
    if (state.visibilityDocument?.visibilityState === "hidden") {
      stopFrameProbeForState(state, "visibilitychange");
    }
  };
  state.visibilityDocument = hostWindow.document ?? null;
  state.visibilityDocument?.addEventListener("visibilitychange", state.visibilityChangeHandler);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.ownerCount -= 1;
    if (state.ownerCount === 0) disposeState(state);
  };
}

export function registerLeafletMapForEvidence(map: LeafletMap): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  state.leafletMap = map;
  return () => {
    if (isStateActive(state) && state.leafletMap === map) state.leafletMap = null;
  };
}

export function registerMapLibreForEvidence(map: MapLibreMap): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  if (state.mapLibreMap) failRendererReplacement(state);
  detachMapLibreRenderListener(state);
  state.mapLibreMap = map;
  state.mapLibreRenderGeneration += 1;
  const mapWithEvents = map as MapLibreMap & {
    on?: (type: string, listener: () => void) => void;
    off?: (type: string, listener: () => void) => void;
  };
  if (typeof mapWithEvents.on !== "function" || typeof mapWithEvents.off !== "function") {
    state.mapLibreRenderToken = null;
    return () => {
      if (isStateActive(state) && state.mapLibreMap === map) {
        state.mapLibreMap = null;
        state.mapLibreRenderToken = null;
      }
    };
  }
  state.mapLibreRenderToken = null;
  const generation = state.mapLibreRenderGeneration;
  const onRender = () => {
    if (!isStateActive(state) || state.mapLibreMap !== map || state.mapLibreRenderGeneration !== generation) return;
    const token = state.mapLibreRenderSequence + 1;
    state.mapLibreRenderSequence = token;
    state.mapLibreRenderToken = token;
    const snapshot = captureMapLibreRenderSnapshot(map, state.mapLibreRenderGeneration, token);
    state.mapLibreRenderSnapshot = snapshot;
    if (snapshot && state.frameAwaitingRendererTimeout !== null) clearTimeout(state.frameAwaitingRendererTimeout);
    if (snapshot) state.frameAwaitingRendererTimeout = null;
  };
  mapWithEvents.on("render", onRender);
  state.mapLibreRenderMap = map;
  state.mapLibreRenderListener = onRender;
  return () => {
    if (isStateActive(state) && state.mapLibreMap === map) {
      failRendererReplacement(state);
      detachMapLibreRenderListener(state);
      state.mapLibreMap = null;
    }
  };
}

export function registerRouteForEvidence(input: {
  map: LeafletMap;
  polyline: LeafletPolyline;
  path: readonly { lat: number; lng: number }[];
}): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  if (state.route) cancelRouteReadiness(state.route);
  const inputFailure: MapFrameSampleFailure | null = input.path.length > 256 ? "sampling-capped" : null;
  const route: RegisteredRoute = {
    ...input,
    path: inputFailure ? input.path.slice(0, 256) : input.path.slice(),
    ready: false,
    readinessSettled: false,
    readinessFailure: inputFailure,
    settleFrameId: null,
    settleTimeout: null,
    readinessRetryTimeout: null,
    readinessDeadlineTimeout: null,
    readinessAttempts: 0,
    readinessDeadlineAt: evidenceNow() + ROUTE_READINESS_DEADLINE_MS,
  };
  state.route = route;
  route.readinessDeadlineTimeout = setTimeout(() => {
    route.readinessDeadlineTimeout = null;
    if (!isStateActive(state) || state.route !== route || route.readinessSettled) return;
    finishRouteReadiness(
      state,
      route,
      routeReadinessFailure(state, route) ?? route.readinessFailure ?? "missing-route-baseline",
    );
  }, ROUTE_READINESS_DEADLINE_MS);
  scheduleRouteReadiness(state, route);
  return () => {
    if (isStateActive(state) && state.route === route) {
      cancelRouteReadiness(route);
      state.route = null;
    }
  };
}

export function registerDestinationMarkerForEvidence(input: {
  marker: LeafletMarker;
  coordinate: { lat: number; lng: number };
  iconAnchor: readonly [number, number];
  iconSize: readonly [number, number];
}): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  const destination: RegisteredDestination = {
    marker: input.marker,
    coordinate: input.coordinate,
    iconAnchor: { x: input.iconAnchor[0], y: input.iconAnchor[1] },
    iconSize: { x: input.iconSize[0], y: input.iconSize[1] },
  };
  state.destination = destination;
  if (
    state.route &&
    !state.route.readinessSettled &&
    state.route.settleFrameId === null &&
    state.route.settleTimeout === null &&
    state.route.readinessRetryTimeout === null
  ) {
    scheduleRouteReadiness(state, state.route);
  }
  return () => {
    if (isStateActive(state) && state.destination === destination) state.destination = null;
  };
}

export function recordMapEvidenceEvent(
  name: MapEvidenceEventName,
  correlation?: string | number,
  modality?: MapEvidenceModality,
): void {
  if (!isStateActive(activeState)) return;
  if (
    !MAP_EVIDENCE_EVENT_NAMES.has(name) ||
    (modality !== undefined && !MAP_EVIDENCE_MODALITIES.has(modality))
  ) return;
  pushEvent(activeState, name, correlation, modality);
}

/**
 * Correlates the page's accepted intent token with the coordinator's distinct
 * calculation request only after requestStarted has established the mapping.
 */
export function establishMapEvidenceCorrelation(
  sessionToken: string | number | undefined,
  requestId: string | number,
): void {
  if (!isStateActive(activeState)) return;
  const state = activeState;
  const ordinal = sessionToken === undefined
    ? getOrdinal(state, requestId)
    : getOrdinal(state, sessionToken);
  if (ordinal === null) return;
  state.correlationAliases.set(correlationKey(requestId), ordinal);
  if (state.correlationAliases.size > 100) {
    const oldest = state.correlationAliases.keys().next().value;
    if (oldest !== undefined) state.correlationAliases.delete(oldest);
  }
}

export function throwIfMapEvidenceRouteFailureRequested(signal: AbortSignal): void {
  const state = activeState;
  if (signal.aborted) throw new DOMException("Route request was cancelled", "AbortError");
  if (!isStateActive(state)) return;
  if (state.failNextRoute) {
    state.failNextRoute = false;
    throw new Error("Map evidence route failure");
  }
}

export async function waitForMapEvidenceRouteDelay(signal: AbortSignal): Promise<void> {
  const state = activeState;
  if (!isStateActive(state)) return;
  if (signal.aborted) throw new DOMException("Route request was cancelled", "AbortError");
  if (state.routeDelayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    let pending: PendingDelay;
    const settle = (error?: unknown) => {
      state.pendingDelays.delete(pending);
      clearTimeout(pending.timer);
      signal.removeEventListener("abort", pending.onAbort);
      if (error) reject(error);
      else resolve();
    };
    pending = {
      timer: setTimeout(() => settle(), state.routeDelayMs),
      signal,
      onAbort: (error = new DOMException("Route request was cancelled", "AbortError")) => {
        state.failNextRoute = false;
        const candidate = error as { name?: unknown } | null;
        settle(candidate?.name === "AbortError" ? error : new DOMException("Route request was cancelled", "AbortError"));
      },
      resolve,
      reject,
    };
    state.pendingDelays.add(pending);
    signal.addEventListener("abort", pending.onAbort, { once: true });
  });
}
