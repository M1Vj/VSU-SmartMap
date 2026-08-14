import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const receivedRequests: NextRequest[] = [];

mock.module("@/lib/supabase/middleware", {
  namedExports: {
    async updateSession(request: NextRequest) {
      receivedRequests.push(request);
      return NextResponse.next();
    },
  },
});

const proxyModule = import("./proxy.ts");

test("proxy replaces client request IDs and propagates a fresh server ID", async () => {
  const { proxy } = await proxyModule;
  const firstRequest = new NextRequest("https://example.test/map", {
    headers: {
      "x-request-id": "client-controlled-id",
      "x-existing-header": "preserved",
    },
  });
  const secondRequest = new NextRequest("https://example.test/map", {
    headers: { "x-request-id": "another-client-id" },
  });

  const firstResponse = await proxy(firstRequest);
  const secondResponse = await proxy(secondRequest);
  const firstRequestId = receivedRequests[0]?.headers.get("x-request-id");
  const secondRequestId = receivedRequests[1]?.headers.get("x-request-id");

  assert.notEqual(receivedRequests[0], firstRequest);
  assert.match(firstRequestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(secondRequestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(firstRequestId, "client-controlled-id");
  assert.notEqual(secondRequestId, "another-client-id");
  assert.notEqual(firstRequestId, secondRequestId);
  assert.equal(receivedRequests[0]?.headers.get("x-existing-header"), "preserved");
  assert.equal(firstResponse.headers.get("x-request-id"), firstRequestId);
  assert.equal(secondResponse.headers.get("x-request-id"), secondRequestId);
});

test("proxy applies browser security headers to dynamic responses", async () => {
  const { proxy } = await proxyModule;
  const response = await proxy(new NextRequest("https://example.test/map"));
  const policy = response.headers.get("content-security-policy") ?? "";

  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.match(response.headers.get("permissions-policy") ?? "", /geolocation=\(self\)/);
});

test("proxy CSP permits the map style, imagery, raster, and fallback tile hosts", async () => {
  const { proxy } = await proxyModule;
  const response = await proxy(new NextRequest("https://example.test/map"));
  const policy = response.headers.get("content-security-policy") ?? "";
  const connectSource = policy
    .split("; ")
    .find((directive) => directive.startsWith("connect-src "));

  assert.match(policy, /img-src 'self' blob: data: https:/);
  assert.match(connectSource ?? "", /https:\/\/server\.arcgisonline\.com/);
  assert.match(connectSource ?? "", /https:\/\/tiles\.openfreemap\.org/);
  assert.match(connectSource ?? "", /https:\/\/tile\.openstreetmap\.org/);
  assert.match(connectSource ?? "", /https:\/\/\*\.openstreetmap\.org/);
  assert.match(connectSource ?? "", /https:\/\/\*\.basemaps\.cartocdn\.com/);
});
