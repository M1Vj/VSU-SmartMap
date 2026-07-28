import assert from "node:assert/strict";
import test from "node:test";

import { resolveNavigationRoute } from "./navigation-route-resolver.ts";
import { createRouteRequestCoordinator } from "./route-request-coordinator.ts";
import type { PathResult } from "@/lib/types/graph";

const route = (id: string): PathResult => ({
  path: [{ id, lat: 1, lng: 1, type: "node" }],
  totalDistance: 10,
  estimatedTime: 1,
});

function dependencies(startInside: boolean, endInside: boolean) {
  const signals: AbortSignal[] = [];
  return {
    signals,
    dependencies: {
      isInside: (point: { lat: number }) => point.lat === 1 ? startInside : endInside,
      findGate: () => ({ id: "gate", lat: 3, lng: 3, type: "node" as const }),
      buildInternalRoute: () => route("internal"),
      straightRoute: () => route("straight"),
      externalPath: async (_start: unknown, _end: unknown, _mode: unknown, signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return route("external");
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
    return route("new-geolocation-route");
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
  resolveOld(route("old-schedule-route"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(oldSignal?.aborted, true);
  assert.deepEqual(published, ["new-geolocation-route"]);
});
