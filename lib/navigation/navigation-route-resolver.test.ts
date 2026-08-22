import assert from "node:assert/strict";
import test from "node:test";

import { resolveNavigationRoute } from "./navigation-route-resolver.ts";
import { createRouteRequestCoordinator } from "./route-request-coordinator.ts";
import {
  createInitialMapRuntimeState,
  mapRuntimeReducer,
} from "@/lib/map/map-runtime";
import type { PathResult } from "@/lib/types/graph";

const route = (
  id: string,
  start = { lat: 1, lng: 1 },
  end = { lat: 1.001, lng: 1.001 },
): PathResult => ({
  path: [
    { id, ...start, type: "node" },
    { id: `${id}-end`, ...end, type: "node" },
  ],
  totalDistance: 10,
  estimatedTime: 1,
});

function dependencies(startInside: boolean, endInside: boolean) {
  const signals: AbortSignal[] = [];
  return {
    signals,
    dependencies: {
      isInside: (point: { lat: number }) =>
        point.lat === 1 ? startInside : point.lat === 2 ? endInside : false,
      findGate: () => ({ id: "gate", lat: 3, lng: 3, type: "node" as const }),
      buildInternalRoute: (
        _from: { lat: number; lng: number },
        _to: { lat: number; lng: number },
        _destinationId?: string,
        _signal?: AbortSignal,
      ): PathResult | null | Promise<PathResult | null> => route("internal"),
      externalPath: async (
        start: { lat: number; lng: number },
        end: { lat: number; lng: number },
        _mode: unknown,
        signal?: AbortSignal,
      ): Promise<PathResult | null> => {
        if (signal) signals.push(signal);
        return route("external", start, end);
      },
      mergeAtGate: (first: PathResult["path"], _gate: unknown, second: PathResult["path"]) => ({
        ...route("merged"),
        path: [...first, ...second],
      }),
      calculateTime: () => 1,
    },
  };
}

for (const branch of [
  { name: "outside to inside", startInside: false, endInside: true },
  { name: "inside to outside", startInside: true, endInside: false },
  { name: "outside to outside", startInside: false, endInside: false },
]) {
  test(`${branch.name} forwards the supplied signal to external routing`, async () => {
    const { dependencies: deps, signals } = dependencies(branch.startInside, branch.endInside);
    const controller = new AbortController();

    await resolveNavigationRoute({
      start: { lat: 1, lng: 1 },
      end: { lat: 2, lng: 2 },
      mode: "walking",
      signal: controller.signal,
      dependencies: deps,
    });

    assert.deepEqual(signals, [controller.signal]);
  });
}

test("inside to inside stays internal without calling an external provider", async () => {
  const { dependencies: deps, signals } = dependencies(true, true);
  const result = await resolveNavigationRoute({
    start: { lat: 1, lng: 1 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: new AbortController().signal,
    dependencies: deps,
  });

  assert.equal(result.path[0].id, "internal");
  assert.deepEqual(signals, []);
});

test("internal route building receives the request signal for cancellation", async () => {
  const { dependencies: deps } = dependencies(true, true);
  let receivedSignal: AbortSignal | undefined;
  deps.buildInternalRoute = async (
    _from: { lat: number; lng: number },
    _to: { lat: number; lng: number },
    _destinationId: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<PathResult | null> => {
    receivedSignal = signal;
    return route("internal");
  };
  const controller = new AbortController();

  await resolveNavigationRoute({
    start: { lat: 1, lng: 1 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: controller.signal,
    dependencies: deps,
  });

  assert.equal(receivedSignal, controller.signal);
});

test("an aborted internal route build cannot publish after cancellation", async () => {
  const { dependencies: deps } = dependencies(true, true);
  deps.buildInternalRoute = (
    _from: { lat: number; lng: number },
    _to: { lat: number; lng: number },
    _destinationId: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<PathResult | null> => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
  });
  const controller = new AbortController();
  const pending = resolveNavigationRoute({
    start: { lat: 1, lng: 1 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: controller.signal,
    dependencies: deps,
  });
  controller.abort();

  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("an internal graph miss uses an actual external route instead of a straight line", async () => {
  const { dependencies: deps, signals } = dependencies(true, true);
  deps.buildInternalRoute = () => null;
  const controller = new AbortController();

  const result = await resolveNavigationRoute({
    start: { lat: 1, lng: 1 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: controller.signal,
    dependencies: deps,
  });

  assert.equal(result.path[0].id, "external");
  assert.deepEqual(signals, [controller.signal]);
});

test("an internal graph miss reports failure when no real route provider succeeds", async () => {
  const { dependencies: deps } = dependencies(true, true);
  deps.buildInternalRoute = () => null;
  deps.externalPath = async () => null;

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 1, lng: 1 },
      end: { lat: 2, lng: 2 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("external-only routing rejects a provider route with the wrong origin", async () => {
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async () => route("wrong-origin", { lat: 7, lng: 7 }, { lat: 5, lng: 5.001 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 5, lng: 5 },
      end: { lat: 5, lng: 5.001 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("external-only routing rejects a provider route with the wrong destination", async () => {
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async () => route("wrong-destination", { lat: 5, lng: 5 }, { lat: 7, lng: 7 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 5, lng: 5 },
      end: { lat: 5, lng: 5.001 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("external-only routing rejects reversed provider geometry", async () => {
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async () => route("reversed", { lat: 5, lng: 5.001 }, { lat: 5, lng: 5 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 5, lng: 5 },
      end: { lat: 5, lng: 5.001 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("external-only routing rejects a repeated zero-length provider path", async () => {
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async () => route("zero-length", { lat: 5, lng: 5 }, { lat: 5, lng: 5 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 5, lng: 5 },
      end: { lat: 5, lng: 5 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("outside-to-inside routing rejects an external segment that misses its gate", async () => {
  const { dependencies: deps } = dependencies(false, true);
  deps.externalPath = async () => route("gate-discontinuity", { lat: 5, lng: 5 }, { lat: 7, lng: 7 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 5, lng: 5 },
      end: { lat: 2, lng: 2 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("external-only routing accepts provider snapping within the road tolerance", async () => {
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async () => route(
    "snapped",
    { lat: 5.0005, lng: 5.0005 },
    { lat: 5.0015, lng: 5.0015 },
  );

  const result = await resolveNavigationRoute({
    start: { lat: 5, lng: 5 },
    end: { lat: 5.001, lng: 5.001 },
    mode: "walking",
    signal: new AbortController().signal,
    dependencies: deps,
  });

  assert.equal(result.path[0]?.id, "snapped");
  assert.deepEqual(
    { lat: result.path[0]?.lat, lng: result.path[0]?.lng },
    { lat: 5, lng: 5 },
  );
  assert.deepEqual(
    { lat: result.path.at(-1)?.lat, lng: result.path.at(-1)?.lng },
    { lat: 5.001, lng: 5.001 },
  );
});

test("outside-to-inside routing normalizes an accepted provider snap at the gate", async () => {
  const { dependencies: deps } = dependencies(false, true);
  deps.externalPath = async () => route(
    "gate-snapped",
    { lat: 5.0005, lng: 5.0005 },
    { lat: 3.0005, lng: 3.0005 },
  );

  const result = await resolveNavigationRoute({
    start: { lat: 5, lng: 5 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: new AbortController().signal,
    dependencies: deps,
  });

  assert.deepEqual(
    { lat: result.path[0]?.lat, lng: result.path[0]?.lng },
    { lat: 5, lng: 5 },
  );
  assert.deepEqual(
    { lat: result.path[1]?.lat, lng: result.path[1]?.lng },
    { lat: 3, lng: 3 },
  );
});

test("invalid external geometry fails the replacement without returning a publishable route", async () => {
  const { dependencies: deps } = dependencies(true, true);
  deps.buildInternalRoute = () => null;
  deps.externalPath = async () => ({ path: [], totalDistance: 0, estimatedTime: 0 });

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 1, lng: 1 },
      end: { lat: 2, lng: 2 },
      mode: "walking",
      signal: new AbortController().signal,
      dependencies: deps,
    }),
    /could not resolve/i,
  );
});

test("cancellation remains authoritative when an external provider returns invalid geometry", async () => {
  const { dependencies: deps } = dependencies(true, true);
  deps.buildInternalRoute = () => null;
  const controller = new AbortController();
  deps.externalPath = async () => {
    controller.abort();
    return { path: [], totalDistance: 0, estimatedTime: 0 };
  };

  await assert.rejects(
    resolveNavigationRoute({
      start: { lat: 1, lng: 1 },
      end: { lat: 2, lng: 2 },
      mode: "walking",
      signal: controller.signal,
      dependencies: deps,
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("a failed invalid replacement keeps the committed route destination-owned and reportable", async () => {
  const committedRoute = route("committed");
  let state = createInitialMapRuntimeState();
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    end: { lat: 2, lng: 2 },
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/committed",
    requestId: 1,
    route: committedRoute,
  });
  state = mapRuntimeReducer(state, {
    type: "navigation/requested",
    requestId: 2,
    destinationId: "facility-b",
    origin: "manual",
    end: { lat: 3, lng: 3 },
  });

  const { dependencies: deps } = dependencies(true, true);
  deps.buildInternalRoute = () => null;
  deps.externalPath = async () => ({ path: [], totalDistance: 0, estimatedTime: 0 });
  const failure = await resolveNavigationRoute({
    start: { lat: 1, lng: 1 },
    end: { lat: 2, lng: 2 },
    mode: "walking",
    signal: new AbortController().signal,
    dependencies: deps,
  }).catch((error: unknown) => error);

  assert.match(failure instanceof Error ? failure.message : "", /could not resolve/i);
  state = mapRuntimeReducer(state, {
    type: "navigation/failed",
    requestId: 2,
    message: failure instanceof Error ? failure.message : "provider unavailable",
  });

  assert.strictEqual(state.navigation.committed?.route, committedRoute);
  assert.equal(state.navigation.committed?.destinationId, "facility-a");
  assert.equal(state.presentation.controls.primaryAction, "clear");
  assert.equal(state.presentation.controls.canReportRoute, true);
});

test("a geolocation update supersedes a delayed schedule handoff route", async () => {
  const published: string[] = [];
  let resolveOld!: (value: PathResult) => void;
  const oldProvider = new Promise<PathResult>((resolve) => {
    resolveOld = resolve;
  });
  let providerCall = 0;
  let oldSignal: AbortSignal | undefined;
  const { dependencies: deps } = dependencies(false, false);
  deps.externalPath = async (_start, _end, _mode, signal) => {
    providerCall += 1;
    if (providerCall === 1) {
      oldSignal = signal;
      return oldProvider;
    }
    return route("new-geolocation-route", { lat: 4, lng: 4 }, { lat: 2, lng: 2 });
  };
  const coordinator = createRouteRequestCoordinator<PathResult>({
    clear: () => undefined,
    publish: (result) => published.push(result.path[0].id),
    loading: () => undefined,
    success: () => undefined,
    error: () => undefined,
    dismiss: () => undefined,
  });

  coordinator.start({
    resolve: (signal) =>
      resolveNavigationRoute({
        start: { lat: 1, lng: 1 },
        end: { lat: 2, lng: 2 },
        mode: "walking",
        signal,
        dependencies: deps,
      }),
  });
  await Promise.resolve();
  coordinator.start({
    resolve: (signal) =>
      resolveNavigationRoute({
        start: { lat: 4, lng: 4 },
        end: { lat: 2, lng: 2 },
        mode: "walking",
        signal,
        dependencies: deps,
      }),
  });
  resolveOld(route("old-schedule-route", { lat: 1, lng: 1 }, { lat: 2, lng: 2 }));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(oldSignal?.aborted, true);
  assert.deepEqual(published, ["new-geolocation-route"]);
});
