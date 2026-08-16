import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  establishMapEvidenceCorrelation,
  getAffineTransformScale,
  hasInFlightVisualScale,
  getSymmetricPolylineError,
  clipScreenPolylineToRect,
  getConfiguredMarkerAnchorPoint,
  initializeMapEvidence,
  resamplePolylineByNormalizedLength,
  isMapEvidenceEnabled,
  normalizeMapLibreProjection,
  normalizeLeafletPaneProjection,
  registerDestinationMarkerForEvidence,
  registerLeafletMapForEvidence,
  registerMapLibreForEvidence,
  registerRouteForEvidence,
  recordMapEvidenceEvent,
  sampleScreenPolyline,
  sampleScreenPolylineDetailed,
  sampleRenderedPolylineScreenSpace,
  parseLeafletRasterTileUrl,
  throwIfMapEvidenceRouteFailureRequested,
  waitForMapEvidenceRouteDelay,
} from "./e2e-probe.ts";
import {
  initializeMapEvidence as initializeBridgeMapEvidence,
  recordMapEvidenceEvent as recordBridgeMapEvidenceEvent,
} from "./e2e-probe-bridge.ts";

type FakeWindow = {
  __VSU_MAP_E2E__?: unknown;
  document?: {
    visibilityState: DocumentVisibilityState;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
    dispatchEvent: (event: Event) => boolean;
  };
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
  matchMedia: (query: string) => MediaQueryList;
};

const originalWindow = (globalThis as { window?: unknown }).window;
const originalDocument = (globalThis as { document?: unknown }).document;
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
  fakeWindow.document = {
    visibilityState: "visible",
    addEventListener: fakeWindow.addEventListener,
    removeEventListener: fakeWindow.removeEventListener,
    dispatchEvent: fakeWindow.dispatchEvent,
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

async function flushBridgeImport() {
  await new Promise<void>((resolve) => originalSetTimeout(resolve, 0));
  await Promise.resolve();
}

async function waitForBridgeGlobalPresence(expected: boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((fakeWindow.__VSU_MAP_E2E__ !== undefined) === expected) return;
    await new Promise<void>((resolve) => originalSetTimeout(resolve, 10));
  }
  assert.equal(fakeWindow.__VSU_MAP_E2E__ !== undefined, expected);
}

function rasterTileFixture(
  rect: { left: number; top: number; width: number; height: number } = { left: 0, top: 0, width: 200, height: 100 },
  source = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0",
) {
  return {
    src: source,
    getAttribute: (name: string) => (name === "src" ? source : null),
    getBoundingClientRect: () => rect,
    offsetWidth: 200,
    offsetHeight: 100,
    naturalWidth: 200,
    naturalHeight: 100,
  };
}

function rasterPanes(tile: ReturnType<typeof rasterTileFixture>) {
  return { tilePane: { querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [tile] : [] } };
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
  const navigationLayer = readFileSync(new URL("../../components/map/navigation-layer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(navigationLayer, /smoothFactor=\{0\}/);
  const probeSource = readFileSync(new URL("./e2e-probe.ts", import.meta.url), "utf8");
  assert.doesNotMatch(probeSource, /getPadding/);
  assert.match(probeSource, /getPanes\?\.\(\)\.tilePane/);
  assert.match(probeSource, /\.leaflet-tile/);
  assert.match(probeSource, /parseLeafletRasterTileUrl/);
  assert.match(probeSource, /map as LeafletMap & \{[\s\S]*project/);
  assert.match(probeSource, /mapWithProject\.project\(/);
  assert.match(probeSource, /naturalWidth/);
  assert.match(probeSource, /inconsistent-raster-projection/);
  assert.match(probeSource, /visualRouteSpanPx/);
  assert.match(probeSource, /visualRouteScale/);
  assert.match(probeSource, /getAffineTransformScale/);
  assert.match(probeSource, /sampleRenderedPolylineScreenSpace/);
  assert.match(probeSource, /rendererFrameToken/);
  assert.match(probeSource, /rendererGeneration/);
  assert.match(probeSource, /armFrameProbeForInput/);
  assert.match(probeSource, /mapLibreRenderSnapshot/);
  assert.match(probeSource, /mapLibreRenderGeneration/);
  assert.match(probeSource, /totalFrameCount/);
  assert.match(probeSource, /frameAwaitingRendererTimeout/);
  assert.match(probeSource, /failAwaitingRendererFrame/);
  assert.match(probeSource, /project\.call\(/);
  assert.match(probeSource, /markFrameProbeBoundary/);
  assert.doesNotMatch(probeSource, /rendererTransform[\s\S]*getScreenCTM/);
  const browserSpec = readFileSync(new URL("../../e2e/map-broad-route-popup.spec.ts", import.meta.url), "utf8");
  assert.match(browserSpec, /await expect\(mainGate\)\.toBeVisible/);
  assert.match(browserSpec, /await expect\(navigate\)\.toBeVisible/);
  assert.match(browserSpec, /evidenceOnlyChunks/);
  assert.match(browserSpec, /browser\.newContext/);
  assert.match(browserSpec, /MAP_E2E_ROUTE_A_LABEL/);
  assert.match(browserSpec, /MAP_E2E_ROUTE_B_LABEL/);
  assert.match(browserSpec, /data-map-route-destination/);
  assert.match(browserSpec, /rapid repeated native zoom/);
  assert.match(browserSpec, /LATE_TAIL_OBSERVATION_MS\s*=\s*10_500/);
  assert.match(browserSpec, /tailSignatures/);
  assert.match(browserSpec, /settledFrameCount/);
  assert.match(browserSpec, /postTail/);
  assert.match(browserSpec, /synthetic.*pinch/i);
  assert.match(browserSpec, /frames\.length\)\.toBeGreaterThanOrEqual\(2\)/);
  assert.match(browserSpec, /hasInFlightVisualScale\)\.toBe\(true\)/);
  assert.match(browserSpec, /visualRouteScales/);
  assert.match(browserSpec, /armFrameProbeForInput/);
  assert.match(browserSpec, /rendererFrameTokens/);
  assert.match(browserSpec, /rendererGenerations/);
  assert.match(browserSpec, /boundary\.generation/);
  assert.match(browserSpec, /boundaryToken/);
  assert.match(browserSpec, /getComputedStyle/);
  assert.match(browserSpec, /getScreenCTM/);
  assert.match(browserSpec, /transform:\s*computed\.transform/);
  assert.match(browserSpec, /new Set\(tailSignatures\)\.size\)\.toBe\(1\)/);
  assert.match(browserSpec, /naturalWidth\s*>\s*0/);
  assert.match(browserSpec, /leaflet-tile.*evaluateAll[\s\S]*naturalWidth/);
  assert.match(browserSpec, /assertVisibleMapControls/);
  assert.match(browserSpec, /data-map-control\], \.leaflet-control-zoom a/);
  assert.match(browserSpec, /case "programmatic"[\s\S]*zoomTo\(18\)/);
  assert.doesNotMatch(browserSpec, /zoomTo\(12\)[\s\S]*zoomTo\(19\)/);
  assert.match(browserSpec, /naturalWidth\s*>\s*0/);
  assert.match(browserSpec, /basemaps\.cartocdn\.com/);
  const mapWrapperSource = readFileSync(new URL("../../components/map/map-wrapper.tsx", import.meta.url), "utf8");
  assert.match(mapWrapperSource, /satelliteFallbackUrl/);
  const playwrightConfig = readFileSync(new URL("../../playwright.config.ts", import.meta.url), "utf8");
  assert.match(playwrightConfig, /channel:\s*["']chrome["']/);
  const markerSource = readFileSync(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  assert.match(markerSource, /dataset\.mapRouteDestination/);
  const runnerSource = readFileSync(new URL("../../tools/run-map-e2e.mjs", import.meta.url), "utf8");
  assert.match(runnerSource, /selectionFlags/);
  assert.match(runnerSource, /extraArgs\.length\s*>\s*0/);
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

test("normalized resampling always returns the requested bounded comparison count", () => {
  const expected = resamplePolylineByNormalizedLength(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    5,
  );
  const rendered = resamplePolylineByNormalizedLength(
    [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
    5,
  );
  assert.equal(expected.length, 5);
  assert.equal(rendered.length, 5);
  assert.deepEqual(expected, rendered);
});

test("MapLibre projection normalization applies source offset, scale, and already-padded coordinates", () => {
  assert.deepEqual(
    normalizeMapLibreProjection(
      { x: 520, y: 360 },
      { width: 800, height: 600 },
      { left: 100, top: 60, width: 800, height: 600 },
      { left: 10, top: 20, width: 400, height: 300 },
    ),
    { x: 610, y: 400 },
  );
});

test("MapLibre projection preserves rendered canvas translation and scale", () => {
  const translated = normalizeMapLibreProjection(
    { x: 100, y: 80 },
    { width: 400, height: 300 },
    { left: 113, top: 67, width: 420, height: 330 },
    { left: 10, top: 20, width: 400, height: 300 },
  );
  const shifted = normalizeMapLibreProjection(
    { x: 100, y: 80 },
    { width: 400, height: 300 },
    { left: 118, top: 72, width: 420, height: 330 },
    { left: 10, top: 20, width: 400, height: 300 },
  );
  assert.deepEqual(translated, { x: 208, y: 135 });
  assert.deepEqual(shifted, { x: 213, y: 140 });
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

test("Leaflet pane projection applies the independent tile-pane scale and translation", () => {
  assert.deepEqual(
    normalizeLeafletPaneProjection(
      { x: 10, y: 20 },
      { left: 105, top: 53, width: 250, height: 125 },
      { width: 200, height: 100 },
      { left: 20, top: 10, width: 400, height: 200 },
    ),
    { x: 97.5, y: 68 },
  );
});

test("Leaflet raster URL parsing accepts only configured ArcGIS and Carto tile forms", () => {
  assert.deepEqual(
    parseLeafletRasterTileUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/12/13"),
    { zoom: 7, x: 13, y: 12 },
  );
  assert.deepEqual(
    parseLeafletRasterTileUrl("https://a.basemaps.cartocdn.com/light_all/4/5/6@2x.png"),
    { zoom: 4, x: 5, y: 6 },
  );
  assert.equal(parseLeafletRasterTileUrl("https://attacker.example/tile/7/12/13"), null);
  assert.equal(parseLeafletRasterTileUrl("not a URL"), null);
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

test("rendered SVG sampling adapts to transformed screen space for a high-scale bent route", () => {
  const sampled = sampleRenderedPolylineScreenSpace(
    200,
    (length) => length <= 100
      ? { x: length, y: 0 }
      : { x: 100, y: length - 100 },
    { a: 4, b: 0, c: 0, d: 4, e: 0, f: 0 },
    { left: 0, top: 0, width: 1_000, height: 1_000 },
  );
  assert.equal(sampled.failure, null);
  assert.ok(sampled.points.length > Math.ceil(200 / 16) + 1);
  const maxSpacing = sampled.points.slice(1).reduce((maximum, point, index) =>
    Math.max(maximum, Math.hypot(point.x - sampled.points[index].x, point.y - sampled.points[index].y)), 0);
  assert.ok(maxSpacing <= 16 + 1e-9);
  const capped = sampleRenderedPolylineScreenSpace(
    5_000,
    (length) => ({ x: length, y: length / 2 }),
    { a: 4, b: 0, c: 0, d: 4, e: 0, f: 0 },
    { left: 0, top: 0, width: 30_000, height: 30_000 },
  );
  assert.equal(capped.points.length, 256);
  assert.equal(capped.failure, "sampling-capped");
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

test("renderer CTM scale is finite, sanitized, and detects an in-flight visual transition", () => {
  assert.equal(getAffineTransformScale({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), 1);
  assert.equal(getAffineTransformScale({ a: 2, b: 0, c: 0, d: 2, e: 5, f: -3 }), 2);
  assert.equal(getAffineTransformScale({ a: Number.NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }), null);
  assert.equal(getAffineTransformScale(null), null);
  assert.equal(hasInFlightVisualScale([1, 1.25, 1.5]), true);
  assert.equal(hasInFlightVisualScale([1, 1.5, 1]), true);
  assert.equal(hasInFlightVisualScale([1, 1, 1]), false);
  assert.equal(hasInFlightVisualScale([1, null, 1.5]), false);
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

test("visibilitychange cancels active frame work without claiming a background pass", () => {
  installFakeBrowser();
  const visibilityDocument = fakeWindow.document!;
  visibilityDocument.visibilityState = "visible";
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frameProbeRunning: boolean; frameProbe: { stopReason: string | null } };
  };
  api.startFrameProbe();
  assert.equal(rafCallbacks.size, 1);
  visibilityDocument.visibilityState = "hidden";
  visibilityDocument.dispatchEvent(new Event("visibilitychange"));
  assert.equal(api.snapshot().frameProbeRunning, false);
  assert.equal(api.snapshot().frameProbe.stopReason, "visibilitychange");
  assert.equal(rafCallbacks.size, 0);
  cleanup();
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

test("foreign global replacement stops scheduled readiness and frame callbacks", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: unknown[]; frameProbe: { frameCount: number } };
  };
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const map = { getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }) };
  const polyline = { getLatLngs: () => path };
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readinessEntry = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  assert.ok(readinessEntry);
  rafCallbacks.delete(readinessEntry[0]);
  const foreign = { foreign: true };
  fakeWindow.__VSU_MAP_E2E__ = foreign;
  readinessEntry[1](0);
  fakeWindow.__VSU_MAP_E2E__ = api;

  api.startFrameProbe();
  const frameEntry = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  assert.ok(frameEntry);
  rafCallbacks.delete(frameEntry[0]);
  fakeWindow.__VSU_MAP_E2E__ = foreign;
  frameEntry[1](16);
  fakeWindow.__VSU_MAP_E2E__ = api;
  assert.deepEqual(api.snapshot().frames, []);
  assert.equal(api.snapshot().frameProbe.frameCount, 0);
  cleanup();

  const secondCleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const secondApi = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: unknown[]; frameProbe: { frameCount: number } };
  };
  secondApi.startFrameProbe();
  const deletedEntry = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  assert.ok(deletedEntry);
  rafCallbacks.delete(deletedEntry[0]);
  delete fakeWindow.__VSU_MAP_E2E__;
  deletedEntry[1](32);
  fakeWindow.__VSU_MAP_E2E__ = secondApi;
  assert.deepEqual(secondApi.snapshot().frames, []);
  assert.equal(secondApi.snapshot().frameProbe.frameCount, 0);
  secondCleanup();
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

test("reset cancels pending route delays, removes abort work, and clears armed failure", async () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    reset: () => void;
    setRouteDelayMs: (delay: number) => void;
    failNextRoute: () => void;
  };
  api.setRouteDelayMs(500);
  api.failNextRoute();
  const controller = new AbortController();
  let abortListenerRemovals = 0;
  const signal = controller.signal as AbortSignal & {
    removeEventListener: AbortSignal["removeEventListener"];
  };
  const removeAbortListener = signal.removeEventListener.bind(signal);
  signal.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    if (type === "abort") abortListenerRemovals += 1;
    return removeAbortListener(type, listener, options);
  }) as AbortSignal["removeEventListener"];
  const delayed = waitForMapEvidenceRouteDelay(signal);
  assert.equal(timerCallbacks.size, 1);
  api.reset();
  assert.equal(timerCallbacks.size, 0);
  assert.equal(abortListenerRemovals, 1);
  await assert.rejects(delayed, /Route request was cancelled/);
  assert.doesNotThrow(() => throwIfMapEvidenceRouteFailureRequested(new AbortController().signal));
  cleanup();
});

test("aborting a delayed route consumes the armed one-shot failure", async () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    setRouteDelayMs: (delay: number) => void;
    failNextRoute: () => void;
  };
  api.setRouteDelayMs(500);
  api.failNextRoute();
  const controller = new AbortController();
  const delayed = waitForMapEvidenceRouteDelay(controller.signal);
  controller.abort();
  await assert.rejects(delayed, /Route request was cancelled/);
  api.setRouteDelayMs(0);
  assert.doesNotThrow(() => throwIfMapEvidenceRouteFailureRequested(new AbortController().signal));
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
  const tile = rasterTileFixture(mapRect);
  const mapPrototype = {
    project(this: { options: { scale: number } }, [lat, lng]: [number, number]) {
      return { x: lng * this.options.scale, y: lat * this.options.scale };
    },
  };
  const map = Object.assign(Object.create(mapPrototype), {
    options: { scale: 10 },
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    setZoom: () => undefined,
  });
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
    snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; destinationErrorPx: number | null; failure: string | null; probeCostMs: number; expectedSampleCount: number; renderedSampleCount: number; visualRouteSpanPx: number | null }> };
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
  assert.ok((frame.visualRouteSpanPx ?? 0) > 0);
  cleanup();
});

test("route readiness rejects a rendered SVG that does not match the authoritative projection", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(mapRect);
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length + 20, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-route-baseline");
  assert.equal(api.snapshot().frames[0]?.routeVisible, false);
  cleanup();
});

test("frame probe records independent SVG scale when a clipped full-width route keeps constant span", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: -10 }, { lat: 0, lng: 30 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(mapRect);
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 400,
      getPointAtLength: (length: number) => ({ x: -100 + length, y: 0 }),
      getScreenCTM: () => transform,
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 295, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; visualRouteSpanPx: number | null; visualRouteScale: number | null; failure: string | null }> };
  };
  api.startFrameProbe();
  const firstFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(firstFrame[0]);
  firstFrame[1](16);
  transform = { a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 };
  const secondFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(secondFrame[0]);
  secondFrame[1](32);
  const frames = api.snapshot().frames;
  assert.equal(frames.length, 2);
  assert.ok(frames.every((frame) => frame.routeVisible && frame.failure === null));
  assert.ok(frames.every((frame) => (frame.routeErrorPx ?? Infinity) <= 2));
  assert.ok(frames.every((frame) => Math.abs((frame.visualRouteSpanPx ?? 0) - 200) < 1e-9));
  assert.deepEqual(frames.map((frame) => frame.visualRouteScale), [1, 1.5]);
  assert.equal(hasInFlightVisualScale([1, 1.25, 1.5]), true);
  cleanup();
});

test("frame probe clips an offscreen route endpoint after projecting through visible raster imagery", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: -100 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(mapRect);
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  const sample = api.snapshot().frames[0];
  assert.equal(sample?.routeVisible, true);
  assert.equal(sample?.failure, null);
  assert.ok((sample?.routeErrorPx ?? Infinity) <= 2);
  cleanup();
});

test("frame probe supports mixed offscreen and visible route vertices before clipping", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: -100 }, { lat: 0, lng: 5 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(mapRect);
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[2], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  const sample = api.snapshot().frames[0];
  assert.equal(sample?.routeVisible, true);
  assert.equal(sample?.failure, null);
  assert.ok((sample?.routeErrorPx ?? Infinity) <= 2);
  cleanup();
});

test("validated raster frames reconcile cross-provider and cross-zoom tiles for offscreen routes", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: -100 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const arcgisTile = rasterTileFixture(
    mapRect,
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0",
  );
  const cartoTile = rasterTileFixture(
    { left: 0, top: 0, width: 100, height: 50 },
    "https://a.basemaps.cartocdn.com/light_all/1/0/0.png",
  );
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({ tilePane: { querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [arcgisTile, cartoTile] : [] } }),
    project: ([lat, lng]: [number, number], zoom = 0) => ({ x: lng * 10 * 2 ** zoom, y: lat * 10 * 2 ** zoom }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  const sample = api.snapshot().frames[0];
  assert.equal(sample?.routeVisible, true);
  assert.equal(sample?.failure, null);
  cleanup();
});

test("frame probe applies the live satellite tile-image scale and translation", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture({ left: 5, top: 3, width: 220, height: 95 });
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const transform = { a: 1.1, b: 0, c: 0, d: 0.95, e: 5, f: 3 };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => transform,
    }),
  };
  const marker = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 109.5, top: -16, width: 11, height: 19 }) }),
  };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; routeErrorPx: number | null; destinationErrorPx: number | null; failure: string | null }> } };
  api.startFrameProbe();
  for (const callback of [...rafCallbacks.values()]) callback(16);
  for (const callback of [...rafCallbacks.values()]) callback(32);
  const frame = api.snapshot().frames[0];
  assert.equal(frame.routeVisible, true);
  assert.equal(frame.failure, null);
  assert.ok((frame.routeErrorPx ?? Infinity) < 1e-9);
  assert.ok((frame.destinationErrorPx ?? Infinity) < 1e-9);
  cleanup();
});

test("satellite oracle rejects a route and marker shifted from the independent tile image", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(mapRect);
  const staleLevel = { getBoundingClientRect: () => ({ left: 40, top: 0, width: 200, height: 100 }) };
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({
      tilePane: {
        querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [tile] : [staleLevel],
      },
    }),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 40, f: 0 }),
    }),
  };
  const marker = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 135, top: -20, width: 10, height: 20 }) }),
  };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeErrorPx: number | null; destinationErrorPx: number | null; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  const sample = api.snapshot().frames[0];
  assert.equal(sample?.failure, "missing-route-baseline");
  assert.equal(sample?.routeErrorPx, null);
  assert.equal(sample?.destinationErrorPx, null);
  cleanup();
});

test("satellite oracle follows independent tile-image offset and scale during a live zoom", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const tileRect = { left: 0, top: 0, width: 200, height: 100 };
  const tile = rasterTileFixture(tileRect);
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({
      tilePane: { querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [tile] : [] },
    }),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => transform,
    }),
  };
  let markerRect = { left: 95, top: -20, width: 10, height: 20 };
  const marker = { getElement: () => ({ getBoundingClientRect: () => markerRect }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeErrorPx: number | null; destinationErrorPx: number | null; failure: string | null }> } };
  api.startFrameProbe();
  const firstFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(firstFrame[0]);
  firstFrame[1](16);
  tileRect.left = 5;
  tileRect.top = 3;
  tileRect.width = 220;
  tileRect.height = 110;
  transform = { a: 1.1, b: 0, c: 0, d: 1.1, e: 5, f: 3 };
  markerRect = { left: 109.5, top: -19, width: 11, height: 22 };
  const secondFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(secondFrame[0]);
  secondFrame[1](32);
  const frames = api.snapshot().frames;
  assert.equal(frames.length, 2);
  assert.ok(frames.every((frame) => frame.failure === null));
  assert.ok(frames.every((frame) => (frame.routeErrorPx ?? Infinity) < 1e-9));
  assert.ok(frames.every((frame) => (frame.destinationErrorPx ?? Infinity) < 1e-9));
  cleanup();
});

test("satellite oracle rejects stale and target raster tiles with inconsistent frames", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const targetTile = rasterTileFixture(mapRect);
  const staleTile = rasterTileFixture({ left: 40, top: 0, width: 200, height: 100 });
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({
      tilePane: {
        querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [targetTile, staleTile] : [],
      },
    }),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "inconsistent-raster-projection");
  cleanup();
});

test("satellite oracle ignores disconnected stale raster tiles but preserves live consistency checks", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const targetTile = rasterTileFixture(mapRect);
  const disconnectedStaleTile = Object.assign(rasterTileFixture({ left: 40, top: 0, width: 200, height: 100 }), { isConnected: false });
  const hiddenStaleTile = Object.assign(rasterTileFixture({ left: 40, top: 0, width: 200, height: 100 }), {
    ownerDocument: { defaultView: { getComputedStyle: () => ({ display: "none", visibility: "visible", opacity: "1" }) } },
  });
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    getPanes: () => ({
      tilePane: {
        querySelectorAll: (selector: string) => selector === ".leaflet-tile" ? [targetTile, disconnectedStaleTile, hiddenStaleTile] : [],
      },
    }),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, null);
  assert.equal(api.snapshot().frames[0]?.routeVisible, true);
  cleanup();
});

test("frame probe projects through the live MapLibre canvas offset and scale", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => mapRect }),
    setZoom: () => undefined,
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 110,
      getPointAtLength: (length: number) => ({ x: length, y: 48 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 34, f: 4 }),
    }),
  };
  const marker = {
    getElement: () => ({ getBoundingClientRect: () => ({ left: 139, top: 32, width: 10, height: 20 }) }),
  };
  const canvas = {
    clientWidth: 0,
    clientHeight: 0,
    width: 400,
    height: 200,
    getBoundingClientRect: () => ({ left: 12, top: 8, width: 220, height: 110 }),
  };
  let renderListener: (() => void) | undefined;
  const mapLibre = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    getPadding: () => {
      throw new Error("MapLibre padding is already included in project coordinates");
    },
    on: (type: string, listener: () => void) => {
      if (type === "render") renderListener = listener;
    },
    off: () => undefined,
    project: ([lng]: [number, number]) => ({ x: 20 + lng * 10, y: 40 }),
  };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(mapLibre as never);
  renderListener?.();
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ routeVisible: boolean; failure: string | null; routeErrorPx: number | null; destinationErrorPx: number | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  const sample = api.snapshot().frames[0];
  assert.equal(sample.routeVisible, true);
  assert.equal(sample.failure, null);
  assert.ok((sample.routeErrorPx ?? Infinity) < 1e-9);
  assert.ok((sample.destinationErrorPx ?? Infinity) < 1e-9);
  cleanup();
});

test("route readiness fails closed when the live MapLibre canvas dimensions are invalid", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }) };
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  let renderListener: (() => void) | undefined;
  const mapLibre = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") renderListener = listener;
    },
    off: () => undefined,
    project: ([lng]: [number, number]) => ({ x: 20 + lng * 10, y: 40 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 40 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 20, f: 0 }),
    }),
  };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(mapLibre as never);
  renderListener?.();
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-route-baseline");
  cleanup();
});

test("route readiness requires a rendered MapLibre frame token before arming", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }) };
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => mapRect,
  };
  const mapLibre = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: () => undefined,
    off: () => undefined,
    project: ([lng]: [number]) => ({ x: 20 + lng * 10, y: 40 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 40 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 20, f: 0 }),
    }),
  };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(mapLibre as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const deadline = timerCallbacks.entries().next().value as [number, () => void] | undefined;
  assert.ok(deadline);
  timerCallbacks.delete(deadline[0]);
  deadline[1]();
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames.at(-1)?.failure, "missing-renderer-frame");
  cleanup();
});

test("route readiness retries a late destination baseline and cleans its retry work", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => mapRect,
  };
  const listeners = new Set<() => void>();
  const map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }) };
  const renderer = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") listeners.add(listener);
    },
    off: (type: string, listener: () => void) => {
      if (type === "render") listeners.delete(listener);
    },
    project: function ([lng]: [number]) {
      if (!this) throw new Error("renderer receiver missing");
      return { x: 20 + lng * 10, y: 40 };
    },
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 40 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 20, f: 0 }),
    }),
  };
  let markerElement: object | null = null;
  const marker = { getElement: () => markerElement };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(renderer as never);
  for (const listener of listeners) listener();
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  assert.ok(timerCallbacks.size >= 2);
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  markerElement = { getBoundingClientRect: () => ({ left: 115, top: 20, width: 10, height: 20 }) };
  const retry = [...timerCallbacks.entries()].at(-1);
  assert.ok(retry);
  timerCallbacks.delete(retry[0]);
  retry[1]();
  const settled = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(settled[0]);
  settled[1](16);
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: Array<{ failure: string | null; routeVisible: boolean }> };
  };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](32);
  assert.equal(api.snapshot().frames[0]?.failure, null);
  assert.equal(api.snapshot().frames[0]?.routeVisible, true);
  cleanup();
  assert.equal(rafCallbacks.size, 0);
  assert.equal(timerCallbacks.size, 0);
});

test("MapLibre frame token rejects logical project and SVG advances without a new render", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  };
  let logicalOffset = 0;
  let renderListener: (() => void) | undefined;
  const map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }) };
  const mapLibre = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") renderListener = listener;
    },
    off: () => undefined,
    project: ([lng]: [number]) => ({ x: 20 + lng * 10 + logicalOffset, y: 40 }),
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 40 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 20 + logicalOffset, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 115 + logicalOffset, top: 30, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(mapLibre as never);
  renderListener?.();
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    stopFrameProbe: () => void;
    snapshot: () => { frames: Array<{ failure: string | null; rendererFrameToken: number | null }> };
  };
  api.startFrameProbe();
  const alignedFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(alignedFrame[0]);
  alignedFrame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, null);
  api.stopFrameProbe();
  logicalOffset = 20;
  api.startFrameProbe();
  const staleFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(staleFrame[0]);
  staleFrame[1](32);
  assert.equal(api.snapshot().frames.at(-1)?.failure, "missing-renderer-frame");
  cleanup();
});

test("MapLibre arming rejects stale logical and SVG state after the first render", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const mapRect = { left: 0, top: 0, width: 200, height: 100 };
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => mapRect,
  };
  let logicalOffset = 0;
  let renderListener: (() => void) | undefined;
  const map = { getContainer: () => ({ getBoundingClientRect: () => mapRect }) };
  const mapLibre = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") renderListener = listener;
    },
    off: () => undefined,
    project: function ([lng]: [number]) {
      return { x: 20 + lng * 10 + logicalOffset + (this ? 0 : 0), y: 40 };
    },
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length + logicalOffset, y: 40 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 20 + logicalOffset, f: 0 }),
    }),
  };
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 115 + logicalOffset, top: 30, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerMapLibreForEvidence(mapLibre as never);
  renderListener?.();
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    armFrameProbeForInput: () => void;
    snapshot: () => { frames: Array<{ failure: string | null }> };
  };
  api.startFrameProbe();
  api.armFrameProbeForInput();
  logicalOffset = 20;
  const staleFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(staleFrame[0]);
  staleFrame[1](16);
  assert.equal(api.snapshot().frames.length, 0);
  renderListener?.();
  const liveFrame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(liveFrame[0]);
  liveFrame[1](32);
  assert.equal(api.snapshot().frames[0]?.failure, null);
  cleanup();
});

test("MapLibre arming stops with one typed failure when no post-input render arrives", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    armFrameProbeForInput: () => void;
    snapshot: () => { frames: Array<{ failure: string | null }>; frameProbeRunning: boolean; frameProbe: { stopReason: string | null } };
  };
  const listeners = new Set<() => void>();
  const canvas = {
    clientWidth: 200,
    clientHeight: 100,
    width: 200,
    height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  };
  const renderer = {
    getCanvas: () => canvas,
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") listeners.add(listener);
    },
    off: (type: string, listener: () => void) => {
      if (type === "render") listeners.delete(listener);
    },
    project: ([lng]: [number]) => ({ x: 20 + lng * 10, y: 40 }),
  };
  registerLeafletMapForEvidence({} as never);
  registerMapLibreForEvidence(renderer as never);
  for (const listener of listeners) listener();
  api.startFrameProbe();
  api.armFrameProbeForInput();
  const preInput = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(preInput[0]);
  preInput[1](16);
  assert.equal(api.snapshot().frames.length, 0);
  const timeout = [...timerCallbacks.entries()].at(-1);
  assert.ok(timeout);
  timerCallbacks.delete(timeout[0]);
  timeout[1]();
  assert.equal(api.snapshot().frames.length, 1);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-renderer-frame");
  assert.equal(api.snapshot().frameProbeRunning, false);
  assert.equal(api.snapshot().frameProbe.stopReason, "wall-clock-timeout");
  cleanup();
});

test("MapLibre renderer generations require a fresh render and clean up accepted listeners", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    armFrameProbeForInput: () => { generation: number; token: number | null };
    stopFrameProbe: () => void;
    snapshot: () => { frames: Array<{ failure: string | null; rendererFrameToken: number | null; rendererGeneration: number | null }> };
  };
  const listeners = new Set<() => void>();
  let offCalls = 0;
  const makeRenderer = () => ({
    getCanvas: () => ({
      clientWidth: 200,
      clientHeight: 100,
      width: 200,
      height: 100,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    }),
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") listeners.add(listener);
    },
    off: (type: string, listener: () => void) => {
      if (type === "render") {
        offCalls += 1;
        listeners.delete(listener);
      }
    },
    options: { crs: {} },
    project: function ([lng]: [number]) {
      if (!this?.options) throw new Error("MapLibre project lost its receiver");
      return { x: 20 + lng * 10, y: 40 };
    },
  });
  const emitRender = () => {
    for (const listener of listeners) listener();
  };
  registerLeafletMapForEvidence({} as never);
  registerMapLibreForEvidence(makeRenderer() as never);
  emitRender();
  api.startFrameProbe();
  const firstBoundary = api.armFrameProbeForInput();
  assert.deepEqual(firstBoundary, { generation: 1, token: 1 });
  emitRender();
  const first = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(first[0]);
  first[1](0);
  api.stopFrameProbe();
  const firstToken = api.snapshot().frames[0]?.rendererFrameToken;
  const firstGeneration = api.snapshot().frames[0]?.rendererGeneration;
  assert.equal(firstToken, 2);
  assert.equal(firstGeneration, firstBoundary.generation);

  registerMapLibreForEvidence(makeRenderer() as never);
  assert.equal(offCalls, 1);
  api.startFrameProbe();
  const secondBoundary = api.armFrameProbeForInput();
  assert.deepEqual(secondBoundary, { generation: 2, token: null });
  const stale = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(stale[0]);
  stale[1](16);
  assert.equal(api.snapshot().frames.length, 0);
  emitRender();
  const live = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(live[0]);
  live[1](32);
  assert.equal(api.snapshot().frames.at(-1)?.rendererFrameToken, 3);
  assert.equal(api.snapshot().frames.at(-1)?.rendererGeneration, secondBoundary.generation);
  assert.ok((api.snapshot().frames.at(-1)?.rendererFrameToken ?? 0) > (firstToken ?? 0));
  api.stopFrameProbe();
  cleanup();
  assert.equal(offCalls, 2);
});

test("MapLibre frame sampling fails closed when the renderer cannot remove a listener", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    snapshot: () => { frames: Array<{ failure: string | null }> };
  };
  const listeners = new Set<() => void>();
  const renderer = {
    getCanvas: () => ({
      clientWidth: 200,
      clientHeight: 100,
      width: 200,
      height: 100,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    }),
    getContainer: () => ({ clientWidth: 200, clientHeight: 100 }),
    on: (type: string, listener: () => void) => {
      if (type === "render") listeners.add(listener);
    },
    off: () => {
      throw new Error("renderer listener teardown failed");
    },
    project: ([lng]: [number]) => ({ x: 20 + lng * 10, y: 40 }),
  };
  registerLeafletMapForEvidence({} as never);
  registerMapLibreForEvidence(renderer as never);
  for (const listener of listeners) listener();
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](0);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-route");
  assert.doesNotThrow(cleanup);
});

test("MapLibre frame sampling stays bounded across repeated probe sessions", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const api = fakeWindow.__VSU_MAP_E2E__ as {
    startFrameProbe: () => void;
    stopFrameProbe: () => void;
    reset: () => void;
    snapshot: () => { frames: unknown[] };
  };
  for (let index = 0; index <= 600; index += 1) {
    api.startFrameProbe();
    const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!frame) break;
    rafCallbacks.delete(frame[0]);
    frame[1](index);
    api.stopFrameProbe();
  }
  assert.equal(api.snapshot().frames.length, 600);
  api.reset();
  api.startFrameProbe();
  const afterReset = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (afterReset) {
    rafCallbacks.delete(afterReset[0]);
    afterReset[1](700);
  }
  assert.equal(api.snapshot().frames.length, 0);
  cleanup();
});

test("route readiness reports typed sampling-capped failure before frame projection", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = Array.from({ length: 300 }, (_, index) => ({ lat: 0, lng: index }));
  const map = { getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }), setZoom: () => undefined };
  const polyline = { getLatLngs: () => path };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null; expectedSampleCount: number }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "sampling-capped");
  assert.equal(api.snapshot().frames[0]?.expectedSampleCount, 0);
  cleanup();
});

test("settled but mismatched route reports route-not-synced instead of generic timeout", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const expectedPath = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const renderedPath = [{ lat: 0, lng: 0 }, { lat: 0, lng: 9 }];
  const map = { getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }), setZoom: () => undefined };
  const polyline = { getLatLngs: () => renderedPath };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path: expectedPath });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "route-not-synced");
  cleanup();
});

test("vector canvas without a registered renderer fails with a typed registration error", () => {
  installFakeBrowser();
  (globalThis as { document?: unknown }).document = { querySelector: () => ({}) };
  try {
    const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
    const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
    const map = { getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }), setZoom: () => undefined };
    const polyline = { getLatLngs: () => path };
    registerLeafletMapForEvidence(map as never);
    registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
    const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
    rafCallbacks.delete(readiness[0]);
    readiness[1](0);
    const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
    api.startFrameProbe();
    const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
    rafCallbacks.delete(frame[0]);
    frame[1](16);
    assert.equal(api.snapshot().frames[0]?.failure, "missing-renderer-registration");
    cleanup();
  } finally {
    (globalThis as { document?: unknown }).document = originalDocument;
  }
});

test("invalid rendered geometry fails with a typed route geometry error", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const tile = rasterTileFixture();
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const polyline = {
    getLatLngs: () => path,
    getElement: () => ({
      getTotalLength: () => 100,
      getPointAtLength: (length: number) => ({ x: length, y: 0 }),
      getScreenCTM: () => ({ a: Number.NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-route-geometry");
  cleanup();
});

test("route readiness reports a typed baseline failure when the rendered path is not ready", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const tile = rasterTileFixture();
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }),
    getPanes: () => rasterPanes(tile),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
    setZoom: () => undefined,
  };
  const polyline = { getLatLngs: () => path };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-route-baseline");
  cleanup();
});

test("satellite readiness reports a typed raster-tile failure when no live tile is present", () => {
  installFakeBrowser();
  const cleanup = initializeMapEvidence("http://localhost:3000/?mapEvidence=1");
  const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
  const map = {
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }),
    getPanes: () => ({
      tilePane: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
        querySelectorAll: () => [],
      },
    }),
    project: ([lat, lng]: [number, number]) => ({ x: lng * 10, y: lat * 10 }),
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
  const marker = { getElement: () => ({ getBoundingClientRect: () => ({ left: 95, top: -20, width: 10, height: 20 }) }) };
  registerLeafletMapForEvidence(map as never);
  registerRouteForEvidence({ map: map as never, polyline: polyline as never, path });
  registerDestinationMarkerForEvidence({ marker: marker as never, coordinate: path[1], iconAnchor: [5, 20], iconSize: [10, 20] });
  const readiness = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(readiness[0]);
  readiness[1](0);
  const api = fakeWindow.__VSU_MAP_E2E__ as { startFrameProbe: () => void; snapshot: () => { frames: Array<{ failure: string | null }> } };
  api.startFrameProbe();
  const frame = rafCallbacks.entries().next().value as [number, FrameRequestCallback];
  rafCallbacks.delete(frame[0]);
  frame[1](16);
  assert.equal(api.snapshot().frames[0]?.failure, "missing-raster-tile");
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

test("the lazy bridge gates exact trusted URLs and cleans up owners without touching foreign globals", async () => {
  installFakeBrowser();
  const invalidUrls = [
    "http://localhost:3000/",
    "http://localhost:3000/?mapEvidence=0",
    "http://localhost:3000/?mapEvidence=1&mapEvidence=1",
    "http://user:pass@localhost:3000/?mapEvidence=1",
    "https://attacker.example/?mapEvidence=1",
  ];
  for (const url of invalidUrls) {
    const dispose = initializeBridgeMapEvidence(url);
    await flushBridgeImport();
    assert.equal(fakeWindow.__VSU_MAP_E2E__, undefined);
    dispose();
  }

  const trusted = "http://localhost:3000/?mapEvidence=1";
  const firstDispose = initializeBridgeMapEvidence(trusted);
  const secondDispose = initializeBridgeMapEvidence(trusted);
  try {
    await waitForBridgeGlobalPresence(true);
    assert.ok(fakeWindow.__VSU_MAP_E2E__);
    recordBridgeMapEvidenceEvent("popup-open", "raw-private-id", "mouse");
    firstDispose();
    assert.ok(fakeWindow.__VSU_MAP_E2E__);
  } finally {
    firstDispose();
    secondDispose();
    await waitForBridgeGlobalPresence(false);
  }

  const foreign = { foreign: true };
  fakeWindow.__VSU_MAP_E2E__ = foreign;
  const blockedDispose = initializeBridgeMapEvidence(trusted);
  try {
    await flushBridgeImport();
    assert.equal(fakeWindow.__VSU_MAP_E2E__, foreign);
  } finally {
    blockedDispose();
    assert.equal(fakeWindow.__VSU_MAP_E2E__, foreign);
    delete fakeWindow.__VSU_MAP_E2E__;
  }
});
