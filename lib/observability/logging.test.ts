import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIncidentExport,
  classifyLogEvent,
  createIncidentFingerprint,
  redactSensitiveText,
  sanitizeLogEventInput,
  serializeIncidentsToCsv,
} from "./logging.ts";

test("sanitizeLogEventInput redacts secrets and bounds noisy values", () => {
  const sanitized = sanitizeLogEventInput({
    source: "client",
    level: "error",
    eventName: "client.error",
    message: "Failed with token abc123",
    route: "/admin/login?token=secret&next=/admin",
    userAgent: "Mozilla/5.0",
    metadata: {
      password: "secret-password",
      nested: {
        authorization: "Bearer token",
        safe: "visible",
      },
      huge: "x".repeat(3000),
      list: [{ cookie: "session=abc" }, "ok"],
    },
    breadcrumbs: Array.from({ length: 40 }, (_, index) => ({
      timestamp: `2026-07-06T00:00:${String(index).padStart(2, "0")}Z`,
      category: "ui",
      message: `clicked ${index}`,
    })),
  });

  assert.equal(sanitized.route, "/admin/login");
  assert.equal(sanitized.metadata.password, "[REDACTED]");
  assert.equal((sanitized.metadata.nested as Record<string, unknown>).authorization, "[REDACTED]");
  assert.equal(((sanitized.metadata.list as unknown[])[0] as Record<string, unknown>).cookie, "[REDACTED]");
  assert.equal((sanitized.metadata.nested as Record<string, unknown>).safe, "visible");
  assert.match(sanitized.metadata.huge as string, /\[truncated\]$/);
  assert.equal(sanitized.breadcrumbs.length, 25);
  assert.equal(sanitized.breadcrumbs[0]?.message, "clicked 15");
});

test("redactSensitiveText removes credential and personal data values before truncation", () => {
  const openAiStyleToken = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
  const githubStyleToken = ["ghp", "abcdefghijklmnopqrstuvwxyz1234567890"].join("_");
  const jwtStyleToken = [
    "eyJhbGciOiJIUzI1NiJ9",
    "eyJzdWIiOiIxMjMifQ",
    "signaturevalue",
  ].join(".");
  const secrets = [
    "person@example.com",
    "+63 917 123 4567",
    "Bearer secret-access-value",
    jwtStyleToken,
    openAiStyleToken,
    githubStyleToken,
    "password=hunter2",
    "/Users/private-owner/project/file.ts",
    "/home/private-owner/project/file.ts",
    "https://example.test/map?token=secret#private",
  ];
  const source = `Useful TypeError at map.ts:42 ${secrets.join(" | ")}`;
  const redacted = redactSensitiveText(source);

  assert.match(redacted, /Useful TypeError at map\.ts:42/);
  for (const secret of secrets) {
    assert.equal(redacted.includes(secret), false, `secret survived: ${secret}`);
  }
  assert.match(redacted, /\[REDACTED/);
});

test("sanitizeLogEventInput recursively redacts nested strings, errors, and breadcrumbs", () => {
  const token = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
  const sanitized = sanitizeLogEventInput({
    source: "client",
    level: "error",
    eventName: "browser.error",
    message: `${"x".repeat(1500)} ${token}`,
    metadata: {
      nested: {
        error: new Error(`failed for person@example.com using ${token}`),
        referrer: "https://example.test/private?q=secret#fragment",
      },
    },
    breadcrumbs: [{
      timestamp: new Date().toISOString(),
      category: "navigation",
      message: `opened /Users/private-owner/file.ts with ${token}`,
      metadata: { detail: `Authorization: Bearer ${token}` },
    }],
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(serialized.includes("private-owner"), false);
  assert.equal(serialized.includes("q=secret"), false);
  assert.equal(serialized.includes("#fragment"), false);
});

test("classifyLogEvent separates important events into actionable incidents", () => {
  assert.deepEqual(
    classifyLogEvent({ source: "client", level: "info", eventName: "page.view", route: "/" }),
    { shouldCreateIncident: false, severity: "LOW" },
  );

  assert.deepEqual(
    classifyLogEvent({
      source: "server",
      level: "error",
      eventName: "api.request_failed",
      route: "/api/chat",
      statusCode: 500,
    }),
    { shouldCreateIncident: true, severity: "HIGH" },
  );

  assert.deepEqual(
    classifyLogEvent({
      source: "client",
      level: "fatal",
      eventName: "react.render_error",
      route: "/",
    }),
    { shouldCreateIncident: true, severity: "CRITICAL" },
  );
});

test("classifyLogEvent does not open incidents for environment conditions", () => {
  // A phone losing signal on campus is not a defect. These used to match the
  // warn + /offline/ rule and opened a MEDIUM incident every time.
  for (const eventName of ["browser.offline", "browser.online", "pwa.service_worker_unavailable"]) {
    assert.deepEqual(
      classifyLogEvent({ source: "client", level: "warn", eventName, route: "/" }),
      { shouldCreateIncident: false, severity: "LOW" },
      `${eventName} should not open an incident`,
    );
  }

  // The rule it is exempted from still applies to genuine failures.
  assert.deepEqual(
    classifyLogEvent({
      source: "client",
      level: "warn",
      eventName: "upload.request_timeout",
      route: "/",
    }),
    { shouldCreateIncident: true, severity: "MEDIUM" },
  );

  // A service worker the browser refused is exempt, but a worker script we
  // failed to ship is a broken deploy affecting everyone and must stay loud.
  assert.deepEqual(
    classifyLogEvent({
      source: "client",
      level: "error",
      eventName: "pwa.service_worker_registration_failed",
      route: "/",
    }),
    { shouldCreateIncident: true, severity: "HIGH" },
  );
});

test("createIncidentFingerprint is stable while ignoring volatile context", () => {
  const first = createIncidentFingerprint({
    source: "client",
    eventName: "unhandledrejection",
    route: "/boarding-houses/abc",
    message: "Cannot read properties of undefined (reading 'name') at chunk-123.js:1",
  });
  const second = createIncidentFingerprint({
    source: "client",
    eventName: "unhandledrejection",
    route: "/boarding-houses/abc",
    message: "Cannot read properties of undefined (reading 'name') at chunk-456.js:99",
  });

  assert.equal(first, second);
});

test("buildIncidentExport includes fixing context without leaking internal fields", () => {
  const exported = buildIncidentExport({
    incident: {
      id: "incident-1",
      title: "Unhandled rejection on /",
      severity: "HIGH",
      status: "OPEN",
      route: "/",
      source: "client",
      fingerprint: "abc",
      eventCount: 3,
      firstSeenAt: "2026-07-06T00:00:00Z",
      lastSeenAt: "2026-07-06T00:05:00Z",
      summary: "A promise rejected during map load.",
    },
    sampleEvent: {
      id: "event-1",
      occurredAt: "2026-07-06T00:05:00Z",
      level: "error",
      eventName: "unhandledrejection",
      message: "Map failed",
      route: "/",
      metadata: { component: "CampusMap" },
      breadcrumbs: [
        { timestamp: "2026-07-06T00:04:58Z", category: "navigation", message: "page.view /" },
      ],
    },
    relatedEvents: [
      {
        id: "event-2",
        occurredAt: "2026-07-06T00:04:58Z",
        level: "info",
        eventName: "page.view",
        route: "/",
      },
    ],
  });

  assert.equal(exported.incident.id, "incident-1");
  assert.equal(exported.fixingContext.sampleEvent.id, "event-1");
  assert.equal(exported.fixingContext.breadcrumbs.length, 1);
  assert.equal(exported.fixingContext.relatedEvents.length, 1);
  assert.equal("rawCookie" in exported.fixingContext, false);
});

test("serializeIncidentsToCsv escapes incident fields for spreadsheet export", () => {
  const csv = serializeIncidentsToCsv([
    {
      id: "incident-1",
      title: 'Map "blank", after click',
      severity: "CRITICAL",
      status: "OPEN",
      route: "/",
      source: "client",
      fingerprint: "abc",
      eventCount: 2,
      firstSeenAt: "2026-07-06T00:00:00Z",
      lastSeenAt: "2026-07-06T00:01:00Z",
      summary: "Map failed\nNeeds fix",
    },
  ]);

  assert.match(csv, /^id,title,severity,status,source,route,event_count,first_seen_at,last_seen_at,fingerprint,summary\n/);
  assert.match(csv, /"Map ""blank"", after click"/);
  assert.match(csv, /"Map failed\nNeeds fix"/);
});
