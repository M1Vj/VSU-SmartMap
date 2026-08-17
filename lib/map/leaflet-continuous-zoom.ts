import type {
  LatLng,
  Map as LeafletMap,
  Point,
} from "leaflet";

type LeafletPrivateZoomApi = {
  _limitZoom: (zoom: number) => number;
  _limitCenter: (center: LatLng, zoom: number, bounds?: unknown) => LatLng;
  _moveStart: (zoomChanged: boolean, noMoveStart?: boolean) => LeafletMap;
  _move: (center: LatLng, zoom: number, data?: Record<string, unknown>, suppressEvent?: boolean) => LeafletMap;
  _moveEnd: (zoomChanged?: boolean) => LeafletMap;
  _stop: () => LeafletMap;
  _panAnim?: { stop: () => void };
};

export type ContinuousZoomMap = LeafletMap & LeafletPrivateZoomApi;

export type ContinuousZoomEngineOptions = {
  wheelDelta: (event: WheelEvent) => number;
  now?: () => number;
  requestFrame?: (callback: (timestamp: number) => void) => number;
  cancelFrame?: (frameId: number) => void;
};

const sensitivity = 0.0048;
const easing = 0.32;
const quietDelay = 140;
const minDelta = 0.001;
const FRAME_MS = 1000 / 60;
const LONG_GAP_MS = 250;

export function toContinuousZoomMap(map: LeafletMap): ContinuousZoomMap {
  for (const method of ["_limitZoom", "_limitCenter", "_moveStart", "_move", "_moveEnd", "_stop"] as const) {
    if (typeof (map as unknown as Record<string, unknown>)[method] !== "function") {
      throw new Error(`Leaflet continuous zoom requires ${method}.`);
    }
  }
  return map as ContinuousZoomMap;
}

export function createLeafletContinuousZoom(
  inputMap: LeafletMap,
  options: ContinuousZoomEngineOptions,
) {
  const map = toContinuousZoomMap(inputMap);
  const { wheelDelta } = options;
  const now = options.now ?? (() => performance.now());
  const requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((frameId) => cancelAnimationFrame(frameId));

  type State = "idle" | "active" | "finishing" | "disposed";
  let state: State = "idle";
  let targetZoom = map._limitZoom(map.getZoom());
  let anchorPoint: Point = map.getSize().divideBy(2);
  let anchorLatLng: LatLng = map.getCenter();
  let frameId = 0;
  let lastInputAt = 0;
  let lastFrameAt: number | null = null;
  let applying = false;

  const clearFrame = () => {
    if (frameId) cancelFrame(frameId);
    frameId = 0;
  };

  const finish = () => {
    if (state === "disposed" || state === "finishing") return;
    const wasActive = state === "active";
    state = "finishing";
    clearFrame();
    if (wasActive) {
      applying = true;
      map._moveEnd(true);
      applying = false;
    }
    lastFrameAt = null;
    state = "idle";
  };

  const cancelExternal = () => {
    if (!applying && (state === "active" || state === "finishing")) finish();
  };

  const anchoredCenter = (zoom: number) => {
    const center = map.unproject(
      map.project(anchorLatLng, zoom).subtract(anchorPoint.subtract(map.getSize().divideBy(2))),
      zoom,
    );
    return map._limitCenter(center, zoom, map.options.maxBounds);
  };

  const move = (zoom: number) => {
    applying = true;
    map._move(anchoredCenter(zoom), zoom, { continuousZoom: true });
    applying = false;
  };

  const step = (timestamp: number, snap = false) => {
    if (state !== "active") return;
    const currentZoom = map.getZoom();
    const target = map._limitZoom(targetZoom);
    const elapsed = lastFrameAt === null ? FRAME_MS : Math.max(0, timestamp - lastFrameAt);
    const longGap = elapsed >= LONG_GAP_MS && lastInputAt <= (lastFrameAt ?? 0);
    lastFrameAt = timestamp;
    const quiet = timestamp - lastInputAt >= quietDelay;
    const alpha = 1 - Math.pow(1 - easing, Math.min(LONG_GAP_MS, elapsed) / FRAME_MS);
    const nextZoom =
      snap || longGap || (quiet && Math.abs(target - currentZoom) <= minDelta)
        ? target
        : currentZoom + (target - currentZoom) * Math.min(1, alpha);

    if (Math.abs(nextZoom - currentZoom) > Number.EPSILON) move(nextZoom);

    if (longGap || (quiet && Math.abs(target - map.getZoom()) <= minDelta)) {
      if (Math.abs(target - map.getZoom()) > Number.EPSILON) {
        move(target);
      }
      finish();
      return;
    }

    frameId = requestFrame(step);
  };

  const schedule = () => {
    if (!frameId && state === "active") frameId = requestFrame(step);
  };

  const start = (point: Point) => {
    if (state !== "idle") return;
    map._stop();
    map._panAnim?.stop();
    anchorPoint = point;
    anchorLatLng = map.containerPointToLatLng(point);
    applying = true;
    map._moveStart(true, false);
    applying = false;
    state = "active";
    lastFrameAt = now() - FRAME_MS;
  };

  const addZoom = (delta: number, point = map.getSize().divideBy(2), immediateWheel = false) => {
    if (state === "disposed") return false;
    const wasIdle = state === "idle";
    if (wasIdle) targetZoom = map._limitZoom(map.getZoom());
    const nextTarget = map._limitZoom(targetZoom + delta);
    if (nextTarget === targetZoom && state === "idle") return false;
    targetZoom = nextTarget;
    if (wasIdle) start(point);
    else {
      anchorPoint = point;
      anchorLatLng = map.containerPointToLatLng(point);
    }
    const timestamp = now();
    lastInputAt = timestamp;
    if (wasIdle) step(timestamp, immediateWheel);
    schedule();
    return true;
  };

  const handleWheel = (event: WheelEvent) => {
    const delta = wheelDelta(event);
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    addZoom(delta * sensitivity, map.mouseEventToContainerPoint(event), true);
  };

  const container = map.getContainer();
  const wasWheelEnabled = map.scrollWheelZoom.enabled();
  if (wasWheelEnabled) map.scrollWheelZoom.disable();
  container.addEventListener("wheel", handleWheel, { passive: false });
  const externalEvents = ["movestart", "zoomstart", "dragstart", "touchstart", "dblclick"] as const;
  externalEvents.forEach((event) => map.on(event, cancelExternal));

  return {
    zoomBy: (delta: number) => addZoom(delta),
    getTargetZoom: () => targetZoom,
    isActive: () => state === "active",
    syncToMap: () => {
      finish();
      targetZoom = map._limitZoom(map.getZoom());
    },
    dispose: () => {
      if (state === "disposed") return;
      finish();
      container.removeEventListener("wheel", handleWheel);
      externalEvents.forEach((event) => map.off(event, cancelExternal));
      if (wasWheelEnabled) map.scrollWheelZoom.enable();
      state = "disposed";
    },
  };
}
