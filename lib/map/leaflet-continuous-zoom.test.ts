import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createLeafletContinuousZoom,
  type ContinuousZoomMap,
} from "./leaflet-continuous-zoom.ts";

type TestBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function makeHarness(priorWheelEnabled = true, maxBounds?: TestBounds) {
  const point = (x: number, y: number) => ({ x, y, subtract: (other: { x: number; y: number }) => point(x - other.x, y - other.y) });
  let time = 0;
  let zoom = 16;
  let center = { lat: 300, lng: 400 };
  let nextFrame = 1;
  let lastAnchor: { lat: number; lng: number } | undefined;
  const movedCenters: Array<{ lat: number; lng: number }> = [];
  let moveCountAtMoveEnd = 0;
  let containerAnchor: { lat: number; lng: number } | undefined;
  const frames = new Map<number, (timestamp: number) => void>();
  const listeners = new Map<string, Set<() => void>>();
  const wheelListeners = new Set<(event: WheelEvent) => void>();
  const events: Record<string, number> = {};
  const order: string[] = [];
  let wheelEnabled = priorWheelEnabled;
  let wheelDisableCount = 0;
  let wheelEnableCount = 0;
  const container = {
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: (_type: string, listener: EventListener) => wheelListeners.add(listener as (event: WheelEvent) => void),
    removeEventListener: (_type: string, listener: EventListener) => wheelListeners.delete(listener as (event: WheelEvent) => void),
  } as unknown as HTMLElement;
  const fire = (type: string) => {
    events[type] = (events[type] ?? 0) + 1;
    order.push(type);
    listeners.get(type)?.forEach((listener) => listener());
  };
  const map = {
    getContainer: () => container,
    mouseEventToContainerPoint: () => point(240, 180),
    containerPointToLatLng: (value: { x: number; y: number }) => {
      containerAnchor = { lat: value.y, lng: value.x };
      return containerAnchor;
    },
    latLngToContainerPoint: (value: { lat: number; lng: number }) => ({
      x: (value.lng - center.lng) * 2 ** zoom + 400,
      y: (value.lat - center.lat) * 2 ** zoom + 300,
    }),
    getSize: () => ({ divideBy: () => point(400, 300), subtract: (value: { x: number; y: number }) => point(400 - value.x, 300 - value.y) }),
    getCenter: () => center,
    project: (latLng: { lat: number; lng: number }, level = zoom) => point(latLng.lng * 2 ** level, latLng.lat * 2 ** level),
    unproject: (value: { x: number; y: number }, level = zoom) => ({ lat: value.y / 2 ** level, lng: value.x / 2 ** level }),
    getZoom: () => zoom,
    getMinZoom: () => 14,
    getMaxZoom: () => 20,
    options: { maxBounds },
    scrollWheelZoom: {
      enabled: () => wheelEnabled,
      disable: () => { wheelEnabled = false; wheelDisableCount += 1; },
      enable: () => { wheelEnabled = true; wheelEnableCount += 1; },
    },
    on: (type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(type, set);
    },
    off: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
    fire,
    _limitZoom: (value: number) => Math.min(20, Math.max(14, value)),
    _stop: () => map,
    _panAnim: { stop: () => undefined },
    _moveStart: () => {
      fire("zoomstart");
      fire("movestart");
      return map;
    },
    _move: (nextCenter: { lat: number; lng: number }, nextZoom: number) => {
      zoom = nextZoom;
      center = nextCenter;
      lastAnchor = nextCenter;
      movedCenters.push(nextCenter);
      fire("zoom");
      fire("move");
      return map;
    },
    _moveEnd: () => {
      moveCountAtMoveEnd = movedCenters.length;
      fire("zoomend");
      fire("moveend");
      return map;
    },
    _limitCenter: (nextCenter: { lat: number; lng: number }, _nextZoom: number, bounds?: TestBounds) => {
      if (!bounds) return nextCenter;
      return {
        lat: Math.min(bounds.north, Math.max(bounds.south, nextCenter.lat)),
        lng: Math.min(bounds.east, Math.max(bounds.west, nextCenter.lng)),
      };
    },
  } as unknown as ContinuousZoomMap;
  const engine = createLeafletContinuousZoom(map, {
    wheelDelta: (event) => -event.deltaY / 3,
    now: () => time,
    requestFrame: (callback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  const wheel = (deltaY = -40) => {
    const event = { deltaY, preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as WheelEvent;
    wheelListeners.forEach((listener) => listener(event));
  };
  const advance = (milliseconds: number) => {
    time += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  };
  return {
    engine,
    wheel,
    advance,
    events,
    order,
    frames,
    map,
    getZoom: () => zoom,
    getCenter: () => center,
    getLastAnchor: () => lastAnchor,
    getMovedCenters: () => movedCenters,
    getMoveCountAtMoveEnd: () => moveCountAtMoveEnd,
    getContainerAnchor: () => containerAnchor,
    getWheelState: () => ({ enabled: wheelEnabled, disable: wheelDisableCount, enable: wheelEnableCount }),
    setTime: (value: number) => { time = value; },
    getTime: () => time,
  };
}

test("continuous wheel retains sensitivity and cursor anchor", () => {
  const harness = makeHarness();
  harness.wheel();
  const firstZoom = harness.getZoom();
  assert.ok(firstZoom - 16 >= 0.06);
  assert.equal(harness.frames.size, 1);
  const samples = [firstZoom];
  for (let index = 1; index < 10; index += 1) {
    harness.wheel();
    assert.equal(harness.frames.size, 1);
    harness.advance(8);
    assert.ok(harness.frames.size <= 1);
    samples.push(harness.getZoom());
  }
  assert.ok(samples.every((sample, index) => index === 0 || sample >= samples[index - 1]));
  harness.advance(160);
  harness.advance(80);
  assert.ok(Math.abs(harness.getZoom() - 16.64) <= 0.03);
  assert.ok(harness.getTime() <= 400);
  assert.equal(harness.events.zoomend, 1);
  assert.equal(harness.events.moveend, 1);
  assert.deepEqual(harness.getContainerAnchor(), { lat: 180, lng: 240 });
  const anchorPixel = harness.map.latLngToContainerPoint({ lat: 180, lng: 240 });
  assert.ok(Math.abs(anchorPixel.x - 240) <= 1);
  assert.ok(Math.abs(anchorPixel.y - 180) <= 1);
});

test("rapid controls retain exact fractional steps and one lifecycle", () => {
  const harness = makeHarness();
  for (let index = 0; index < 4; index += 1) harness.engine.zoomBy(0.25);
  harness.advance(300);
  assert.equal(harness.getZoom(), 17);
  assert.equal(harness.events.zoomstart, 1);
  assert.equal(harness.events.zoomend, 1);
  assert.equal(harness.events.movestart, 1);
  assert.equal(harness.events.moveend, 1);
});

test("a long hidden-frame gap snaps and closes on that resumed frame", () => {
  const harness = makeHarness();
  harness.wheel();
  harness.advance(1000);
  assert.equal(harness.getZoom(), harness.engine.getTargetZoom());
  assert.equal(harness.frames.size, 0);
  assert.equal(harness.events.zoomend, 1);
});

test("external camera movement cancels the owned lifecycle once", () => {
  const harness = makeHarness();
  harness.engine.zoomBy(0.25);
  harness.map.fire("dragstart");
  assert.equal(harness.events.zoomstart, 1);
  assert.equal(harness.events.zoomend, 1);
  assert.equal(harness.events.moveend, 1);
  assert.deepEqual(harness.order.slice(-3), ["dragstart", "zoomend", "moveend"]);
});

test("touch and double-click arbitration also closes once without overwriting the external action", () => {
  for (const event of ["touchstart", "dblclick"]) {
    const harness = makeHarness();
    harness.engine.zoomBy(0.25);
    harness.map.fire(event);
    assert.equal(harness.events.zoomend, 1, event);
    assert.equal(harness.events.moveend, 1, event);
    assert.equal(harness.engine.isActive(), false, event);
  }
});

test("non-owned move and zoom starts close the owned lifecycle before the external camera continues", () => {
  for (const event of ["movestart", "zoomstart"]) {
    const harness = makeHarness();
    harness.engine.zoomBy(0.25);
    harness.map.fire(event);
    assert.equal(harness.events.zoomend, 1, event);
    assert.equal(harness.events.moveend, 1, event);
    assert.equal(harness.engine.isActive(), false, event);
  }
});

test("a newer input prevents a stale long-gap snap", () => {
  const harness = makeHarness();
  harness.wheel();
  harness.advance(100);
  harness.setTime(1000);
  harness.wheel();
  assert.equal(harness.events.zoomend, undefined);
  harness.engine.dispose();
});

test("maxBounds clamps every continuous center before the owned lifecycle ends", () => {
  const harness = makeHarness(true, {
    north: 180,
    south: 180,
    east: 240,
    west: 240,
  });
  harness.wheel();
  harness.advance(16);
  harness.advance(160);
  harness.advance(80);

  const movedCenters = harness.getMovedCenters();
  assert.ok(movedCenters.length > 0);
  assert.ok(movedCenters.every((value) => value.lat === 180 && value.lng === 240));
  assert.equal(harness.getMoveCountAtMoveEnd(), movedCenters.length);
  assert.equal(harness.events.moveend, 1);
});

test("external zoomend becomes the next control baseline", () => {
  const harness = makeHarness();
  harness.engine.zoomBy(0.25);
  harness.map.fire("dragstart");
  (harness.map as unknown as { _move: (center: { lat: number; lng: number }, zoom: number) => unknown })._move(harness.getCenter(), 18);
  harness.map.fire("zoomend");
  harness.engine.syncToMap();
  harness.engine.zoomBy(0.25);
  assert.equal(harness.engine.getTargetZoom(), 18.25);
});

test("the adapter fails closed when Leaflet private methods are unavailable", () => {
  assert.throws(() => createLeafletContinuousZoom({} as ContinuousZoomMap, { wheelDelta: () => 0 }), /_limitZoom/);
});

test("cleanup is idempotent and restores the native wheel handler", () => {
  const harness = makeHarness();
  harness.wheel();
  harness.engine.dispose();
  harness.engine.dispose();
  assert.equal(harness.frames.size, 0);
  assert.deepEqual(harness.getWheelState(), { enabled: true, disable: 1, enable: 1 });
  assert.equal(harness.events.zoomend, 1);

  const alreadyDisabled = makeHarness(false);
  alreadyDisabled.engine.dispose();
  assert.deepEqual(alreadyDisabled.getWheelState(), { enabled: false, disable: 0, enable: 0 });
});

test("the pinned Leaflet runtime stays on the supported bridge version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(packageJson.dependencies?.leaflet, "1.9.4");

  const lockfile = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8")) as {
    packages?: { "": { dependencies?: Record<string, string> } };
  };
  assert.equal(lockfile.packages?.[""].dependencies?.leaflet, "1.9.4");
});

test("the private bridge is limited to the reviewed Leaflet methods", async () => {
  const source = await readFile(new URL("./leaflet-continuous-zoom.ts", import.meta.url), "utf8");
  for (const method of ["_limitZoom", "_limitCenter", "_moveStart", "_move", "_moveEnd", "_stop"]) {
    assert.match(source, new RegExp(method));
  }
  assert.match(source, /_panAnim\?\.stop/);
  assert.doesNotMatch(source, /_animatingZoom|_zoom/);
});
