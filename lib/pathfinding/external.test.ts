import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalRoutingUrl,
  buildGeoapifyRoutingUrl,
  buildOrsRoutingUrl,
  getExternalPath,
  resolveExternalRouteProviders,
} from "./external.ts";

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
        return { path: [], totalDistance: 1, estimatedTime: 1 };
      },
    ],
    new AbortController().signal,
  );

  assert.deepEqual(calls, ["keyed", "public"]);
  assert.equal(result?.totalDistance, 1);
});

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
