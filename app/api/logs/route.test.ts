import assert from "node:assert/strict";
import test, { mock } from "node:test";

process.env.VERCEL_ENV = "test";

let quotaResult = { allowed: true, retryAfterSeconds: 0 };
let quotaCalls: Array<Record<string, unknown>> = [];
let recordedBatches: unknown[][] = [];
let recordError: Error | null = null;
let quotaError: Error | null = null;

mock.module("@/lib/security/rate-limit", {
  namedExports: {
    async consumeRateLimit(input: Record<string, unknown>) {
      if (quotaError) throw quotaError;
      quotaCalls.push(input);
      return quotaResult;
    },
  },
});

mock.module("@/lib/observability/server", {
  namedExports: {
    async recordClientTelemetryEvents(events: unknown[]) {
      if (recordError) throw recordError;
      recordedBatches.push(events);
      return { accepted: events.length, failed: 0 };
    },
  },
});

const routeModule = import("./route.ts");

function reset() {
  quotaResult = { allowed: true, retryAfterSeconds: 0 };
  quotaCalls = [];
  recordedBatches = [];
  recordError = null;
  quotaError = null;
}

function requestWithBody(body: string, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/logs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Test Browser",
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      "x-request-id": "request-123",
      ...headers,
    },
    body,
  });
}

test.beforeEach(reset);

test("enforces the actual 32 KiB stream cap without trusting content-length", async () => {
  const { POST } = await routeModule;
  const response = await POST(requestWithBody(`{"padding":"${"x".repeat(33 * 1024)}"}`, {
    "content-length": "1",
  }));

  assert.equal(response.status, 413);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Telemetry payload is too large." });
  assert.equal(quotaCalls.length, 0);
  assert.equal(recordedBatches.length, 0);
});

test("rejects unknown events and batches larger than ten", async () => {
  const { POST } = await routeModule;
  for (const payload of [
    { eventName: "attacker.event" },
    { events: Array.from({ length: 11 }, () => ({ eventName: "page.view" })) },
  ]) {
    const response = await POST(requestWithBody(JSON.stringify(payload)));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Invalid telemetry payload." });
  }
  assert.equal(quotaCalls.length, 2, "bounded invalid bodies must still consume durable quota");
  assert.equal(recordedBatches.length, 0);
});

test("charges malformed JSON before returning a generic validation error", async () => {
  const { POST } = await routeModule;
  const response = await POST(requestWithBody("{not-json"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid telemetry payload." });
  assert.equal(quotaCalls.length, 1);
  assert.equal(quotaCalls[0]?.costBytes, Buffer.byteLength("{not-json"));
  assert.equal(recordedBatches.length, 0);
});

test("applies durable IP request and byte quotas before recording", async () => {
  quotaResult = { allowed: false, retryAfterSeconds: 73 };
  const body = JSON.stringify({ eventName: "page.view", route: "/map?secret=value#private" });
  const { POST } = await routeModule;
  const response = await POST(requestWithBody(body));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "73");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Too many telemetry requests. Please try again later." });
  assert.deepEqual(quotaCalls, [{
    scope: "public:client-logs",
    subject: "203.0.113.8",
    requestLimit: 60,
    byteLimit: 512 * 1024,
    windowSeconds: 15 * 60,
    costBytes: Buffer.byteLength(body),
  }]);
  assert.equal(recordedBatches.length, 0);
});

test("fails closed with no-store when the durable quota is unavailable", async () => {
  quotaError = new Error("quota backend unavailable");
  const { POST } = await routeModule;
  const response = await POST(requestWithBody(JSON.stringify({ eventName: "page.view" })));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
  assert.deepEqual(await response.json(), { error: "Too many telemetry requests. Please try again later." });
  assert.equal(recordedBatches.length, 0);
});

test("forces source, level, server context, and pathname before direct-batch recording", async () => {
  const body = JSON.stringify({
    eventName: "browser.error",
    source: "server",
    level: "fatal",
    environment: "spoofed",
    requestId: "spoofed",
    route: "https://example.test/map?token=secret#fragment",
  });
  const { POST } = await routeModule;
  const response = await POST(requestWithBody(body));

  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { accepted: 1, failed: 0 });
  assert.equal(recordedBatches.length, 1);
  const recorded = recordedBatches[0]?.[0] as Record<string, unknown>;
  assert.notEqual(recorded.requestId, "request-123");
  assert.match(String(recorded.requestId), /^[0-9a-f-]{36}$/);
  const { requestId: _serverRequestId, ...recordedWithoutRequestId } = recorded;
  assert.deepEqual(recordedWithoutRequestId, {
    source: "client",
    level: "error",
    eventName: "browser.error",
    route: "/map",
    userAgent: "Test Browser",
    environment: "test",
    metadata: {},
    breadcrumbs: [],
  });
});

test("returns generic no-store errors when persistence fails", async () => {
  recordError = new Error("database secret detail");
  const { POST } = await routeModule;
  const response = await POST(requestWithBody(JSON.stringify({ eventName: "page.view" })));

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const responseText = await response.text();
  assert.deepEqual(JSON.parse(responseText), { error: "Unable to record telemetry." });
  assert.equal(responseText.includes("database secret detail"), false);
});
