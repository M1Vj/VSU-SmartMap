import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalRoutingUrl,
  buildGeoapifyRoutingUrl,
  buildOrsRoutingUrl,
  getExternalPath,
  resolveExternalRouteProviders,
} from "./external.ts";
import type { MapNode } from "@/lib/types/graph";

test("external routing URL requests one definitive foot route (keyless OSRM)", () => {
  const url = new URL(
    buildExternalRoutingUrl({ lat: 10.74, lng: 124.78 }, { lat: 10.75, lng: 124.79 }, "walking"),
  );

  assert.ok(url.pathname.includes("/routed-foot/route/v1/foot/"));
  assert.equal(url.searchParams.get("alternatives"), "false");
  assert.equal(url.searchParams.get("steps"), "false");
  assert.equal(url.searchParams.get("geometries"), "geojson");
  assert.equal(url.searchParams.get("overview"), "full");
});

test("geoapify routing URL uses walk mode and lat,lng waypoints", () => {
  const url = new URL(
    buildGeoapifyRoutingUrl({ lat: 10.74, lng: 124.78 }, { lat: 10.75, lng: 124.79 }, "walking", "test-key"),
  );

  assert.equal(url.searchParams.get("mode"), "walk");
  assert.equal(url.searchParams.get("waypoints"), "10.74,124.78|10.75,124.79");
  assert.equal(url.searchParams.get("apiKey"), "test-key");
});

test("openrouteservice routing URL uses foot-walking and lng,lat start/end", () => {
  const url = new URL(
    buildOrsRoutingUrl({ lat: 10.74, lng: 124.78 }, { lat: 10.75, lng: 124.79 }, "walking", "test-key"),
  );

  assert.ok(url.pathname.endsWith("/directions/foot-walking"));
  assert.equal(url.searchParams.get("start"), "124.78,10.74");
  assert.equal(url.searchParams.get("end"), "124.79,10.75");
  assert.equal(url.searchParams.get("api_key"), "test-key");
});

test("an already-aborted external route performs no provider fetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, "onLine");
  let fetchCalls = 0;
  Object.defineProperty(globalThis.navigator, "onLine", {
    configurable: true,
    value: true,
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };

  try {
    const controller = new AbortController();
    controller.abort();
    const result = await getExternalPath(
      { lat: 10.74, lng: 124.78 },
      { lat: 10.75, lng: 124.79 },
      "walking",
      controller.signal,
    );

    assert.equal(result, null);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOnLine) {
      Object.defineProperty(globalThis.navigator, "onLine", originalOnLine);
    } else {
      Reflect.deleteProperty(globalThis.navigator, "onLine");
    }
  }
});

test("provider resolver falls back after a keyed provider returns no route", async () => {
  const calls: string[] = [];
  const result = await resolveExternalRouteProviders(
    [
      async () => {
        calls.push("keyed");
        return null;
      },
      async () => {
        calls.push("public");
        return {
          path: [
            { id: "public-start", lat: 10, lng: 20, type: "node" as const },
            { id: "public-end", lat: 10.001, lng: 20.001, type: "node" as const },
          ],
          totalDistance: 1,
          estimatedTime: 1,
        };
      },
    ],
    new AbortController().signal,
  );

  assert.deepEqual(calls, ["keyed", "public"]);
  assert.equal(result?.totalDistance, 1);
});

test("provider resolver rejects an empty geometry before it can replace a valid fallback", async () => {
  const calls: string[] = [];
  const result = await resolveExternalRouteProviders(
    [
      async () => {
        calls.push("invalid");
        return { path: [], totalDistance: 1, estimatedTime: 1 };
      },
      async () => {
        calls.push("fallback");
        return {
          path: [
            { id: "fallback-start", lat: 10, lng: 20, type: "node" as const },
            { id: "fallback-end", lat: 10.001, lng: 20.001, type: "node" as const },
          ],
          totalDistance: 10,
          estimatedTime: 1,
        };
      },
    ],
    new AbortController().signal,
  );

  assert.deepEqual(calls, ["invalid", "fallback"]);
  assert.equal(result?.path.length, 2);
  assert.equal(result?.path[0]?.id, "fallback-start");
});

test("provider resolver skips endpoint-mismatched geometry and normalizes accepted snapping", async () => {
  const start = { lat: 10, lng: 20 };
  const end = { lat: 10.001, lng: 20.001 };
  const result = await resolveExternalRouteProviders(
    [
      async () => ({
        path: [
          { id: "wrong-start", lat: 12, lng: 22, type: "node" as const },
          { id: "wrong-end", lat: 12.001, lng: 22.001, type: "node" as const },
        ],
        totalDistance: 1,
        estimatedTime: 1,
      }),
      async () => ({
        path: [
          { id: "snapped-start", lat: 10.0005, lng: 20.0005, type: "node" as const },
          { id: "snapped-end", lat: 10.0015, lng: 20.0015, type: "node" as const },
        ],
        totalDistance: 10,
        estimatedTime: 1,
      }),
    ],
    new AbortController().signal,
    start,
    end,
  );

  assert.equal(result?.path[0]?.id, "snapped-start");
  assert.deepEqual(
    { lat: result?.path[0]?.lat, lng: result?.path[0]?.lng },
    start,
  );
  assert.deepEqual(
    { lat: result?.path.at(-1)?.lat, lng: result?.path.at(-1)?.lng },
    end,
  );
});

const invalidProviderGeometries: Array<[string, MapNode[]]> = [
  ["one point", [{ id: "invalid", lat: 10, lng: 20, type: "node" as const }]],
  [
    "NaN latitude",
    [
      { id: "invalid-start", lat: Number.NaN, lng: 20, type: "node" as const },
      { id: "invalid-end", lat: 10.001, lng: 20.001, type: "node" as const },
    ],
  ],
  [
    "Infinity longitude",
    [
      { id: "invalid-start", lat: 10, lng: Number.POSITIVE_INFINITY, type: "node" as const },
      { id: "invalid-end", lat: 10.001, lng: 20.001, type: "node" as const },
    ],
  ],
  [
    "out-of-range coordinates",
    [
      { id: "invalid-start", lat: 91, lng: 20, type: "node" as const },
      { id: "invalid-end", lat: 10.001, lng: 181, type: "node" as const },
    ],
  ],
];

for (const [label, invalidPath] of invalidProviderGeometries) {
  test(`provider resolver skips ${label} geometry`, async () => {
    const result = await resolveExternalRouteProviders([
      async () => ({ path: invalidPath, totalDistance: 1, estimatedTime: 1 }),
      async () => ({
        path: [
          { id: "fallback-start", lat: 10, lng: 20, type: "node" as const },
          { id: "fallback-end", lat: 10.001, lng: 20.001, type: "node" as const },
        ],
        totalDistance: 10,
        estimatedTime: 1,
      }),
    ], new AbortController().signal);

    assert.equal(result?.path[0]?.id, "fallback-start");
  });
}

test("mid-flight abort prevents provider fallback", async () => {
  const controller = new AbortController();
  let fallbackCalls = 0;
  let resolveFirst!: (value: null) => void;
  const first = new Promise<null>((resolve) => {
    resolveFirst = resolve;
  });
  const resultPromise = resolveExternalRouteProviders(
    [
      () => first,
      async () => {
        fallbackCalls += 1;
        return null;
      },
    ],
    controller.signal,
  );

  controller.abort();
  resolveFirst(null);

  assert.equal(await resultPromise, null);
  assert.equal(fallbackCalls, 0);
});
