import assert from "node:assert/strict";
import test from "node:test";

import {
  parseClientTelemetryPayload,
  type ClientTelemetryServerContext,
} from "./client-telemetry.ts";

const context: ClientTelemetryServerContext = {
  environment: "production",
  release: "release-123",
  requestId: "request-123",
  userAgent: "Test Browser",
  receivedAt: new Date("2026-07-16T10:00:00.000Z"),
};

test("maps every allowlisted event to a server-owned level and context", () => {
  const expected = {
    "browser.error": "error",
    "browser.unhandledrejection": "error",
    "browser.online": "info",
    "browser.offline": "warn",
    "console.error": "error",
    "console.warn": "warn",
    "app.logging_started": "info",
    "page.view": "info",
    "next.global_error": "error",
    "next.route_error": "error",
    "react.component_error": "error",
  } as const;

  for (const [eventName, level] of Object.entries(expected)) {
    const parsed = parseClientTelemetryPayload({
      eventName,
      source: "server",
      level: "fatal",
      statusCode: 500,
      method: "DELETE",
      environment: "spoofed",
      release: "spoofed",
      requestId: "spoofed",
      userAgent: "spoofed",
      route: "https://example.test/map?token=secret#fragment",
    }, context);

    assert.equal(parsed.ok, true);
    if (!parsed.ok) continue;
    const event = parsed.events[0]!;
    assert.equal(event.eventName, eventName);
    assert.equal(event.level, level);
    assert.equal(event.source, "client");
    assert.equal(event.route, "/map");
    assert.equal(event.environment, context.environment);
    assert.equal(event.release, context.release);
    assert.equal(event.requestId, context.requestId);
    assert.equal(event.userAgent, context.userAgent);
    assert.equal(event.statusCode, undefined);
    assert.equal(event.method, undefined);
  }
});

test("rejects empty, oversized, unknown, and malformed event batches", () => {
  const invalidPayloads: unknown[] = [
    { events: [] },
    { events: Array.from({ length: 11 }, () => ({ eventName: "page.view" })) },
    { eventName: "unknown.event" },
    { eventName: "page.view", sessionId: "not-a-uuid" },
    { eventName: "page.view", occurredAt: "not-a-date" },
    { eventName: "page.view", occurredAt: "2026-07-18T10:00:00.000Z" },
    { eventName: "page.view", metadata: "not-an-object" },
    { events: [{ eventName: "page.view" }, "malformed"] },
  ];

  for (const payload of invalidPayloads) {
    assert.equal(parseClientTelemetryPayload(payload, context).ok, false);
  }
});

test("strictly bounds and recursively redacts client-controlled context", () => {
  const token = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
  const parsed = parseClientTelemetryPayload({
    eventName: "browser.error",
    message: `TypeError for person@example.com ${token}`,
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    occurredAt: "2026-07-16T09:59:00.000Z",
    metadata: {
      safe: "map render failed at line 42",
      nested: {
        authorization: `Bearer ${token}`,
        referrer: "https://example.test/map?email=person@example.com#secret",
      },
      extra: Array.from({ length: 30 }, (_, index) => `item-${index}`),
    },
    breadcrumbs: Array.from({ length: 20 }, (_, index) => ({
      timestamp: "2026-07-16T09:58:00.000Z",
      category: "ui.click",
      message: `button.activate ${token}`,
      metadata: { path: `/Users/private-owner/project/${index}.tsx` },
    })),
  }, context);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const event = parsed.events[0]!;
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(serialized.includes("private-owner"), false);
  assert.equal(serialized.includes("#secret"), false);
  assert.equal(event.breadcrumbs?.length, 10);
  assert.equal((event.metadata?.extra as unknown[]).length, 10);
  assert.equal(event.metadata?.safe, "map render failed at line 42");
});
