import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  establishMapEvidenceCorrelation,
  getSymmetricPolylineError,
  clipScreenPolylineToRect,
  getConfiguredMarkerAnchorPoint,
  initializeMapEvidence,
  isMapEvidenceEnabled,
  normalizeMapLibreProjection,
  normalizeLeafletPaneProjection,
  registerDestinationMarkerForEvidence,
  registerLeafletMapForEvidence,
  registerRouteForEvidence,
  recordMapEvidenceEvent,
  sampleScreenPolyline,
  sampleScreenPolylineDetailed,
  throwIfMapEvidenceRouteFailureRequested,
  waitForMapEvidenceRouteDelay,
} from "./e2e-probe.ts";

type FakeWindow = {
  __VSU_MAP_E2E__?: unknown;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
  matchMedia: (query: string) => MediaQueryList;
};

const originalWindow = (globalThis as { window?: unknown }).window;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

let fakeWindow: FakeWindow;
let rafCallbacks: Map<number, FrameRequestCallback>;
let timerCallbacks: Map<number, () => void>;
let listenerCounts: Map<string, number>;
let nextFrameId: number;
let nextTimerId: number;

function installFakeBrowser() {
  rafCallbacks = new Map();
  timerCallbacks = new Map();
  listenerCounts = new Map();
  nextFrameId = 1;
  nextTimerId = 1;
  const listeners = new Map<string, Set<EventListener>>();

  fakeWindow = {
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set<EventListener>();
      bucket.add(listener);
      listeners.set(type, bucket);
      listenerCounts.set(type, bucket.size);
    },
    removeEventListener(type, listener) {
      const bucket = listeners.get(type);
      bucket?.delete(listener);
      listenerCounts.set(type, bucket?.size ?? 0);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    matchMedia() {
      return {
        matches: false,
        media: "",
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      } as MediaQueryList;
    },
  };

  (globalThis as { window?: unknown }).window = fakeWindow;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    rafCallbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafCallbacks.delete(id);
  };
  globalThis.setTimeout = ((callback: TimerHandler, _delay?: number, ...args: unknown[]) => {
    const id = nextTimerId++;
    timerCallbacks.set(id, () => {
      if (typeof callback === "function") callback(...args);
      else originalSetTimeout(callback, 0);
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
    if (id !== undefined) timerCallbacks.delete(Number(id));
    originalClearTimeout(id);
  }) as unknown as typeof clearTimeout;
}

test.afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

test("evidence is strict opt-in for local and exact broad preview hosts", () => {
  assert.equal(isMapEvidenceEnabled("https://example.com/?mapEvidence=1"), false);
  assert.equal(isMapEvidenceEnabled("http://localhost:3000/?mapEvidence=1"), true);
  assert.equal(
    isMapEvidenceEnabled(
      "https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06.vercel.app/?mapEvidence=1",
    ),
    false,
  );
  assert.equal(
    isMapEvidenceEnabled(
      "https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1",
    ),
    true,
  );
  assert.equal(
    isMapEvidenceEnabled(
      "https://vsu-smartmap-git-perf-map-broad-rewrite.example.vercel.app/?mapEvidence=1",
    ),
    false,
  );
  assert.equal(
    isMapEvidenceEnabled(
      "https://vsu-smartmap-git-perf-map-broad-rewrite-attacker.vercel.app/?mapEvidence=1",
    ),
    false,
  );
  assert.equal(isMapEvidenceEnabled("http://localhost:3000/"), false);
  assert.equal(isMapEvidenceEnabled("http://localhost:3000/?mapEvidence=0"), false);
  assert.equal(isMapEvidenceEnabled("http://127.0.0.1:3000/?mapEvidence=1"), true);
  assert.equal(isMapEvidenceEnabled("http://localhost:3001/?mapEvidence=1"), false);
  assert.equal(isMapEvidenceEnabled("http://localhost:3000/?mapEvidence=1&mapEvidence=1"), false);
  assert.equal(isMapEvidenceEnabled("http://user:pass@localhost:3000/?mapEvidence=1"), false);
  assert.equal(isMapEvidenceEnabled("https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1&foo=bar"), true);
});

test("production map components cross the lazy bridge instead of statically loading the probe core", () => {
  const bridge = readFileSync(new URL("./e2e-probe-bridge.ts", import.meta.url), "utf8");
  assert.match(bridge, /import\(["']\.\/e2e-probe["']\)/);
  for (const component of [
    "../../components/map/leaflet-react.tsx",
    "../../components/map/map-wrapper.tsx",
    "../../components/map/navigation-layer.tsx",
    "../../components/map/map-marker.tsx",
    "../../components/map/map-selection-layer.tsx",
  ]) {
    const source = readFileSync(new URL(component, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*e2e-probe["']/);
  }
});

test("event storage is bounded and strips raw correlation and user data", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");

  for (let index = 0; index < 105; index += 1) {
    recordMapEvidenceEvent(
      index % 2 === 0 ? "marker-activation" : "popup-open",
      `private-item-${index}`,
      index % 2 === 0 ? "touch" : "mouse",
    );
  }

  const events = (fakeWindow.__VSU_MAP_E2E__ as { events: () => unknown[] }).events();
  assert.equal(events.length, 100);
  assert.equal((events[0] as { sequence: number }).sequence, 6);
  assert.equal((events.at(-1) as { sequence: number }).sequence, 105);
  assert.deepEqual(
    Object.keys(events[0] as object).sort(),
    ["correlationOrdinal", "modality", "name", "sequence"],
  );
  assert.equal(JSON.stringify(events).includes("private-item"), false);
  cleanup();
});

test("runtime-invalid event values are rejected and public snapshots are detached", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    events: () => Array<{ name: string; sequence: number }>;
    snapshot: () => { events: Array<{ name: string; sequence: number }> };
  };
  recordMapEvidenceEvent("not-an-event" as never, "raw-id", "mouse");
  recordMapEvidenceEvent("popup-open", "raw-id", "not-a-modality" as never);
  recordMapEvidenceEvent("popup-open", "raw-id", "keyboard");
  const detached = api.events();
  detached[0].name = "navigate";
  detached[0].sequence = 999;
  assert.deepEqual(api.events(), [{ sequence: 1, name: "popup-open", correlationOrdinal: 1, modality: "keyboard" }]);
  const snapshotEvents = api.snapshot().events;
  snapshotEvents[0].name = "details";
  assert.equal(api.snapshot().events[0].name, "popup-open");
  cleanup();
});

test("polyline sampling stays bounded and includes every segment", () => {
  const sampled = sampleScreenPolyline(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    8,
  );
  assert.ok(sampled.length <= 8);
  assert.deepEqual(sampled[0], { x: 0, y: 0 });
  assert.deepEqual(sampled.at(-1), { x: 100, y: 100 });
  assert.ok(sampled.some((point) => point.x === 100 && point.y === 0));
});

test("symmetric polyline error is zero for identical multi-segment paths", () => {
  const path = sampleScreenPolyline([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);
  assert.equal(getSymmetricPolylineError(path, path), 0);
});

test("symmetric polyline error catches a three-pixel translation", () => {
  const expected = sampleScreenPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  const translated = expected.map((point) => ({ x: point.x + 3, y: point.y }));
  assert.equal(getSymmetricPolylineError(expected, translated), 3);
});

test("symmetric polyline error catches a middle bow even when endpoints match", () => {
  const expected = sampleScreenPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  const bowed = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
  assert.ok(getSymmetricPolylineError(expected, bowed) >= 5);
});

test("MapLibre projection normalization applies source offset, scale, and target padding", () => {
  assert.deepEqual(
    normalizeMapLibreProjection(
      { x: 520, y: 360 },
      { width: 800, height: 600 },
      { left: 100, top: 60, width: 800, height: 600 },
      { left: 10, top: 20, width: 400, height: 300 },
      { left: 8, top: 12 },
    ),
    { x: 618, y: 412 },
  );
});

test("MapLibre projection preserves rendered canvas translation and scale", () => {
  const translated = normalizeMapLibreProjection(
    { x: 100, y: 80 },
    { width: 400, height: 300 },
    { left: 113, top: 67, width: 420, height: 330 },
    { left: 10, top: 20, width: 400, height: 300 },
    { left: 8, top: 12 },
  );
  const shifted = normalizeMapLibreProjection(
    { x: 100, y: 80 },
    { width: 400, height: 300 },
    { left: 118, top: 72, width: 420, height: 330 },
    { left: 10, top: 20, width: 400, height: 300 },
    { left: 8, top: 12 },
  );
  assert.deepEqual(translated, { x: 216.4, y: 148.2 });
  assert.deepEqual(shifted, { x: 221.4, y: 153.2 });
  assert.equal(shifted.x - translated.x, 5);
  assert.equal(shifted.y - translated.y, 5);
});

test("Leaflet pane projection includes its live rendered offset and scale", () => {
  assert.deepEqual(
    normalizeLeafletPaneProjection(
      { x: 20, y: 30 },
      { left: 110, top: 75, width: 600, height: 450 },
      { width: 400, height: 300 },
      { left: 10, top: 15, width: 800, height: 600 },
    ),
    { x: 130, y: 105 },
  );
});

test("route clipping keeps visible intersections and interior vertices", () => {
  assert.deepEqual(
    clipScreenPolylineToRect(
      [
        { x: -20, y: 20 },
        { x: 50, y: 50 },
        { x: 120, y: 80 },
      ],
      { left: 0, top: 0, width: 100, height: 100 },
    ),
    [
      { x: 0, y: 28.57142857142857 },
      { x: 50, y: 50 },
      { x: 100, y: 71.42857142857143 },
    ],
  );
});

test("sampling reports a typed cap failure instead of silently exceeding the spacing budget", () => {
  const detailed = sampleScreenPolylineDetailed(
    Array.from({ length: 20 }, (_, index) => ({ x: index, y: 0 })),
    4,
  );
  assert.equal(detailed.points.length, 4);
  assert.equal(detailed.failure, "sampling-capped");
});

test("destination evidence uses the configured icon anchor rather than a generic bottom center", () => {
  assert.deepEqual(
    getConfiguredMarkerAnchorPoint(
      { left: 200, top: 100, width: 32, height: 48 },
      { x: 16, y: 24 },
      { x: 8, y: 21 },
      { left: 10, top: 20, width: 400, height: 300 },
    ),
    { x: 206, y: 122 },
  );
});

test("strict opt-in cleanup removes global state, frame work, delayed route work, and listeners", async () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    setRouteDelayMs: (delay: number) => void;
  };
  api.setRouteDelayMs(50);
  api.startFrameProbe();
  const delayedRoute = waitForMapEvidenceRouteDelay(new AbortController().signal).catch(() => undefined);

  assert.ok(rafCallbacks.size > 0);
  assert.ok(timerCallbacks.size > 0);
  cleanup();
  await delayedRoute;

  assert.equal(fakeWindow.__VSU_MAP_E2E__, undefined);
  assert.equal(rafCallbacks.size, 0);
  assert.equal(timerCallbacks.size, 0);
  assert.ok([...listenerCounts.values()].every((count) => count === 0));
});

test("initialization is safe across a Strict Mode setup and cleanup pair", () => {
  installFakeBrowser();
  const firstCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const firstApi = fakeWindow.__VSU_MAP_E2E__;
  const secondCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  assert.equal(fakeWindow.__VSU_MAP_E2E__, firstApi);

  firstCleanup();
  assert.equal(fakeWindow.__VSU_MAP_E2E__, firstApi);
  secondCleanup();
  assert.equal(fakeWindow.__VSU_MAP_E2E__, undefined);
});

test("foreign globals are never overwritten and a disposed API becomes inert", () => {
  installFakeBrowser();
  const foreign = { foreign: true };
  fakeWindow.__VSU_MAP_E2E__ = foreign;
  const blockedCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  assert.equal(fakeWindow.__VSU_MAP_E2E__, foreign);
  blockedCleanup();

  delete fakeWindow.__VSU_MAP_E2E__;
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    events: () => unknown[];
    record?: () => void;
    reset: () => void;
    setRouteDelayMs: (delay: number) => void;
    failNextRoute: () => void;
  };
  cleanup();
  api.setRouteDelayMs(500);
  api.failNextRoute();
  api.reset();
  assert.deepEqual(api.events(), []);
  assert.equal(fakeWindow.__VSU_MAP_E2E__, undefined);
});

test("foreign global replacement makes retained registrations and events inert", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as { events: () => unknown[] };
  const foreign = { foreign: true };
  fakeWindow.__VSU_MAP_E2E__ = foreign;
  const unregister = registerLeafletMapForEvidence({} as never);
  recordMapEvidenceEvent("popup-open", "stale");
  establishMapEvidenceCorrelation(17, 9001);
  assert.deepEqual(api.events(), []);
  unregister();
  fakeWindow.__VSU_MAP_E2E__ = undefined;
  cleanup();
});

test("stale disposer and stale API cannot affect a replacement probe", () => {
  installFakeBrowser();
  const firstCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const firstApi = fakeWindow.__VSU_MAP_E2E__ as { events: () => unknown[]; reset: () => void };
  firstCleanup();
  const secondCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const secondApi = fakeWindow.__VSU_MAP_E2E__ as { events: () => unknown[] };
  assert.notEqual(firstApi, secondApi);
  firstCleanup();
  firstApi.reset();
  recordMapEvidenceEvent("popup-open", "replacement");
  assert.equal(secondApi.events().length, 1);
  secondCleanup();
});

test("opt-in panBy delegates bounded evidence panning to the registered map", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const pans: Array<[number, number]> = [];
  const map = {
    panBy: ([x, y]: [number, number]) => pans.push([x, y]),
  };
  const unregisterMap = registerLeafletMapForEvidence(map as never);
  const api = fakeWindow.__VSU_MAP_E2E__ as { panBy: (x: number, y: number) => void };
  api.panBy(40, -20);
  api.panBy(Number.NaN, 10);
  api.panBy(5000, -5000);
  assert.deepEqual(pans, [[40, -20], [2000, -2000]]);
  unregisterMap();
  cleanup();
});

test("reset clears correlation ordinals, delay, failure control, and bounded buffers", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    events: () => Array<{ correlationOrdinal: number | null }>;
    reset: () => void;
    setRouteDelayMs: (delay: number) => void;
    failNextRoute: () => void;
    snapshot: () => { routeDelayMs: number };
  };
  for (let index = 0; index < 150; index += 1) {
    recordMapEvidenceEvent("navigate", `request-${index}`);
  }
  assert.equal(api.events().length, 100);
  api.setRouteDelayMs(250);
  api.failNextRoute();
  api.reset();
  assert.equal(api.events().length, 0);
  assert.equal(api.snapshot().routeDelayMs, 0);
  api.setRouteDelayMs(Number.NaN);
  assert.equal(api.snapshot().routeDelayMs, 0);
  api.setRouteDelayMs(-10);
  assert.equal(api.snapshot().routeDelayMs, 0);
  api.setRouteDelayMs(Number.POSITIVE_INFINITY);
  assert.equal(api.snapshot().routeDelayMs, 0);
  recordMapEvidenceEvent("navigate", "after-reset");
  assert.equal(api.events()[0].correlationOrdinal, 1);
  cleanup();
});

test("reset cancels a running frame probe and clears all frame metadata", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    reset: () => void;
    snapshot: () => { frames: unknown[]; frameProbeRunning: boolean; frameProbe: { frameCount: number; startedAt: number | null; stoppedAt: number | null; stopReason: string | null; totalCostMs: number } };
  };
  api.startFrameProbe();
  assert.ok(rafCallbacks.size > 0 || timerCallbacks.size > 0);
  api.reset();
  const snapshot = api.snapshot();
  assert.equal(snapshot.frameProbeRunning, false);
  assert.deepEqual(snapshot.frames, []);
  assert.deepEqual(snapshot.frameProbe, { frameCount: 0, startedAt: null, stoppedAt: null, stopReason: null, totalCostMs: 0 });
  assert.equal(rafCallbacks.size, 0);
  assert.equal(timerCallbacks.size, 0);
  cleanup();
});

test("distinct accepted intent and coordinator IDs correlate only after requestStarted", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as { events: () => Array<{ name: string; correlationOrdinal: number | null }> };
  recordMapEvidenceEvent("navigate", 17, "touch");
  establishMapEvidenceCorrelation(17, 9001);
  recordMapEvidenceEvent("route-request", 9001);
  recordMapEvidenceEvent("navigation-feedback", 9001);
  const events = api.events();
  assert.equal(new Set(events.map((event) => event.correlationOrdinal)).size, 1);
  assert.deepEqual(events.map((event) => event.name), ["navigate", "route-request", "navigation-feedback"]);
  cleanup();
});

test("frame probe uses authoritative route and destination geometry with bounded metadata", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({ overlayPane: { getBoundingClientRect: () => mapRect } }),
    latLngToLayerPoint: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }),
    getLatLng: () => ({ lat: 0, lng: 99 }),
  };
  // The probe API accepts Leaflet objects; these fixtures intentionally model only the methods it reads.
  const unregisterMap = registerLeafletMapForEvidence(map as never);
  const unregisterRoute = registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const unregisterMarker = registerDestinationMarkerForEvidence({ marker: marker as never,
    coordinate: path[1],
    iconAnchor: [5, 20],
    iconSize: [10, 20],
  });
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; destinationErrorPx: number | null; failure: string | null; probeCostMs: number; expectedSampleCount: number; renderedSampleCount: number }> };
  };
  // First callback settles the registered polyline; the next one captures a frame.
  api.startFrameProbe();
  for (const callback of [...rafCallbacks.values()]) callback(16);
  for (const callback of [...rafCallbacks.values()]) callback(32);
  const frame = api.snapshot().frames[0];
  assert.equal(frame.routeVisible, true);
  assert.ok((frame.routeErrorPx ?? Infinity) < 1e-9);
  assert.ok((frame.destinationErrorPx ?? Infinity) < 1e-9);
  assert.equal(frame.failure, null);
  assert.ok(frame.probeCostMs >= 0);
  assert.ok(frame.expectedSampleCount >= 2);
  assert.ok(frame.renderedSampleCount >= 2);
  cleanup();
});

test("one-shot route failure is opt-in, abort-safe, and consumed once", async () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    failNextRoute: () => void;
    setRouteDelayMs: (delay: number) => void;
  };
  api.failNextRoute();
  const failureSignal = new AbortController().signal;
  await waitForMapEvidenceRouteDelay(failureSignal);
  assert.throws(() => throwIfMapEvidenceRouteFailureRequested(failureSignal), /Map evidence route failure/);
  throwIfMapEvidenceRouteFailureRequested(new AbortController().signal);
  await waitForMapEvidenceRouteDelay(new AbortController().signal);
  api.setRouteDelayMs(20);
  const controller = new AbortController();
  const delayed = waitForMapEvidenceRouteDelay(controller.signal);
  controller.abort();
  await assert.rejects(delayed, /Route request was cancelled/);
  cleanup();
});
