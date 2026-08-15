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
  | "missing-route-element"
  | "missing-route-geometry"
  | "missing-overlay-transform"
  | "incompatible-sample-count"
  | "sampling-capped"
  | "missing-destination"
  | "missing-destination-element"
  | "missing-destination-geometry"
  | "missing-renderer-projection";

export type MapFrameSample = {
  frameIndex: number;
  at: number;
  routeVisible: boolean;
  routeErrorPx: number | null;
  destinationErrorPx: number | null;
  rendererErrorPx: number | null;
  expectedSampleCount: number;
  renderedSampleCount: number;
  probeCostMs: number;
  zoom: number | null;
  animatingZoom: boolean;
  failure: MapFrameSampleFailure | null;
};

type ScreenPoint = { x: number; y: number };

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
    stopReason: "explicit" | "max-frames" | "wall-clock-timeout" | "cleanup" | null;
    totalCostMs: number;
  };
};

export type MapEvidenceApi = {
  snapshot: () => MapEvidenceSnapshot;
  events: () => readonly MapEvidenceEvent[];
  reset: () => void;
  startFrameProbe: () => void;
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
  settleFrameId: number | null;
  settleTimeout: ReturnType<typeof setTimeout> | null;
};

type RegisteredDestination = {
  marker: LeafletMarker;
  coordinate: { lat: number; lng: number };
  iconAnchor: { x: number; y: number };
  iconSize: { x: number; y: number };
};

type PendingDelay = {
  timer: ReturnType<typeof setTimeout>;
  signal: AbortSignal;
  onAbort: () => void;
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

function resamplePolylineByNormalizedLength(
  points: readonly ScreenPoint[],
  sampleCount: number,
) {
  if (points.length <= 1 || sampleCount >= points.length) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }
  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const cumulative = [0];
  for (const length of lengths) cumulative.push(cumulative.at(-1)! + length);
  const total = cumulative.at(-1)!;
  if (total === 0) return [{ x: points[0].x, y: points[0].y }];
  const result: ScreenPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const target = (total * index) / (sampleCount - 1);
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
  padding: { left: number; top: number } = { left: 0, top: 0 },
): ScreenPoint {
  const scaleX = renderedRect.width / clientSize.width;
  const scaleY = renderedRect.height / clientSize.height;
  return {
    x: renderedRect.left - targetRect.left + (point.x + padding.left) * scaleX,
    y: renderedRect.top - targetRect.top + (point.y + padding.top) * scaleY,
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

function transformScreenPoint(
  x: number,
  y: number,
  transform: { a: number; b: number; c: number; d: number; e: number; f: number },
  containerRect: DOMRect,
): ScreenPoint {
  return {
    x: transform.a * x + transform.c * y + transform.e - containerRect.left,
    y: transform.b * x + transform.d * y + transform.f - containerRect.top,
  };
}

function readRenderedPolyline(
  polyline: LeafletPolyline,
  containerRect: DOMRect,
): { points: ScreenPoint[]; failure: MapFrameSampleFailure | null } {
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
  if (!element) return { points: [], failure: "missing-route-element" };
  const totalLength = element.getTotalLength?.();
  const transform = element.getScreenCTM?.();
  if (!totalLength || !transform) return { points: [], failure: "missing-route-geometry" };
  const requestedSampleCount = Math.max(2, Math.ceil(totalLength / 16) + 1);
  const sampleCount = Math.min(256, requestedSampleCount);
  const samplingCapped = requestedSampleCount > 256;
  const result: ScreenPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const point = element.getPointAtLength?.(
      (totalLength * index) / (sampleCount - 1),
    );
    if (!point) return { points: [], failure: "missing-route-geometry" };
    result.push(transformScreenPoint(point.x, point.y, transform, containerRect));
  }
  const clipped = clipScreenPolylineToRect(result, {
    left: 0,
    top: 0,
    width: containerRect.width,
    height: containerRect.height,
  });
  return clipped.length > 0
    ? { points: clipped, failure: samplingCapped ? "sampling-capped" : null }
    : { points: [], failure: "missing-route-geometry" };
}

function projectCoordinate(
  state: ProbeState,
  map: LeafletMap,
  containerRect: DOMRect,
  coordinate: { lat: number; lng: number },
): { point: ScreenPoint; failure: MapFrameSampleFailure | null } {
  if (state.mapLibreMap) {
    const mapLibre = state.mapLibreMap;
    const mapLibreContainer = mapLibre.getContainer?.();
    if (!mapLibreContainer || typeof mapLibre.project !== "function") {
      return { point: { x: 0, y: 0 }, failure: "missing-renderer-projection" };
    }
    const mapLibreRect = mapLibreContainer.getBoundingClientRect();
    const projected = mapLibre.project([coordinate.lng, coordinate.lat]);
    const clientSize = {
      width: mapLibreContainer.clientWidth || mapLibreRect.width,
      height: mapLibreContainer.clientHeight || mapLibreRect.height,
    };
    const padding = typeof mapLibre.getPadding === "function" ? mapLibre.getPadding() : { left: 0, top: 0 };
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
        { left: padding.left ?? 0, top: padding.top ?? 0 },
      ),
      failure: null,
    };
  }

  const overlayPane = map.getPanes?.().overlayPane;
  const overlayRect = overlayPane?.getBoundingClientRect?.();
  if (!overlayRect || typeof map.latLngToLayerPoint !== "function") {
    return { point: { x: 0, y: 0 }, failure: "missing-overlay-transform" };
  }
  const projected = map.latLngToLayerPoint([coordinate.lat, coordinate.lng]);
  const pane = overlayPane as typeof overlayPane & {
    offsetWidth?: number;
    offsetHeight?: number;
  };
  const paneSize = {
    width: pane.offsetWidth && pane.offsetWidth > 0 ? pane.offsetWidth : overlayRect.width,
    height: pane.offsetHeight && pane.offsetHeight > 0 ? pane.offsetHeight : overlayRect.height,
  };
  return {
    point: normalizeLeafletPaneProjection(
      projected,
      overlayRect,
      paneSize,
      containerRect,
    ),
    failure: null,
  };
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

function cancelRouteReadiness(route: RegisteredRoute) {
  if (route.settleFrameId !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(route.settleFrameId);
  }
  if (route.settleTimeout !== null) clearTimeout(route.settleTimeout);
  route.settleFrameId = null;
  route.settleTimeout = null;
}

function scheduleRouteReadiness(state: ProbeState, route: RegisteredRoute) {
  const settle = () => {
    route.settleFrameId = null;
    route.settleTimeout = null;
    if (activeState !== state || state.route !== route) return;
    route.ready = routeMatchesAuthoritativePath(route);
  };
  if (typeof requestAnimationFrame === "function") route.settleFrameId = requestAnimationFrame(settle);
  else route.settleTimeout = setTimeout(settle, 0);
}

function appendFrame(
  state: ProbeState,
  startedAt: number,
  sample: Omit<MapFrameSample, "frameIndex" | "at" | "probeCostMs" | "zoom" | "animatingZoom"> &
    Partial<Pick<MapFrameSample, "zoom" | "animatingZoom">>,
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
  });
}

function recordFrame(state: ProbeState) {
  const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
  const map = state.route?.map ?? state.leafletMap;
  if (!map) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-map" });
    return;
  }
  const route = state.route;
  if (!route) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route" });
    return;
  }
  if (!route.ready) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "route-not-synced" });
    return;
  }
  if (route.path.length < 2) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route-path" });
    return;
  }
  const containerRect = getMapContainerRect(map);
  if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
    appendFrame(state, startedAt, { routeVisible: false, routeErrorPx: null, destinationErrorPx: null, rendererErrorPx: null, expectedSampleCount: 0, renderedSampleCount: 0, failure: "missing-route-geometry" });
    return;
  }

  try {
    const projectedPath: ScreenPoint[] = [];
    let projectionFailure: MapFrameSampleFailure | null = null;
    for (const point of route.path) {
      const projected = projectCoordinate(state, map, containerRect, point);
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
      if (!markerElement || !markerRect) {
        sampleFailure ??= "missing-destination-element";
      } else {
        const expectedDestination = projectCoordinate(state, map, containerRect, destination.coordinate);
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
  if (state.frameCount >= 600) {
    stopFrameProbeForState(state, "max-frames");
    return;
  }
  const callback = () => {
    state.frameId = null;
    state.frameTimeout = null;
    if (activeState !== state) return;
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
    if (state.route && !state.route.ready) {
      scheduleFrame(state);
      return;
    }
    state.frameCount += 1;
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
  state.frameId = null;
  state.frameTimeout = null;
  state.wallClockTimeout = null;
  if (state.frameProbeStartedAt !== null && state.frameProbeStoppedAt === null) {
    state.frameProbeStoppedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    state.frameProbeStopReason = reason;
  }
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
    },
    startFrameProbe: () => {
      if (!isActive()) return;
      if (state.frameId !== null || state.frameTimeout !== null) return;
      state.frameProbeStartedAt = typeof performance === "undefined" ? Date.now() : performance.now();
      state.frameProbeStoppedAt = null;
      state.frameProbeStopReason = null;
      state.frameProbeCostMs = 0;
      state.frameCount = 0;
      state.wallClockTimeout = setTimeout(() => stopFrameProbeForState(state, "wall-clock-timeout"), 10_000);
      scheduleFrame(state);
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
  for (const pending of state.pendingDelays) {
    clearTimeout(pending.timer);
    pending.signal.removeEventListener("abort", pending.onAbort);
    pending.reject(new DOMException("Map evidence probe was disposed", "AbortError"));
  }
  state.pendingDelays.clear();
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
  } as ProbeState;
  state.api = createApi(state);
  activeState = state;
  hostWindow.__VSU_MAP_E2E__ = state.api;

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
    if (activeState === state && state.leafletMap === map) state.leafletMap = null;
  };
}

export function registerMapLibreForEvidence(map: MapLibreMap): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  state.mapLibreMap = map;
  return () => {
    if (activeState === state && state.mapLibreMap === map) state.mapLibreMap = null;
  };
}

export function registerRouteForEvidence(input: {
  map: LeafletMap;
  polyline: LeafletPolyline;
  path: readonly { lat: number; lng: number }[];
}): () => void {
  const state = activeState;
  if (!isStateActive(state)) return () => undefined;
  const route: RegisteredRoute = {
    ...input,
    ready: false,
    settleFrameId: null,
    settleTimeout: null,
  };
  state.route = route;
  scheduleRouteReadiness(state, route);
  return () => {
    if (activeState === state && state.route === route) {
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
  return () => {
    if (activeState === state && state.destination === destination) state.destination = null;
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
      onAbort: () => settle(new DOMException("Route request was cancelled", "AbortError")),
      resolve,
      reject,
    };
    state.pendingDelays.add(pending);
    signal.addEventListener("abort", pending.onAbort, { once: true });
  });
}
