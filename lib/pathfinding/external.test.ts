import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalRoutingUrl,
  buildGeoapifyRoutingUrl,
  buildOrsRoutingUrl,
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
