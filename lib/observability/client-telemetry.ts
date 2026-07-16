import {
  redactSensitiveText,
  type LogBreadcrumb,
  type LogEventInput,
  type LogLevel,
} from "./logging.ts";

export const MAX_CLIENT_TELEMETRY_EVENTS = 10;

const MAX_STRING_LENGTH = 512;
const MAX_ROUTE_LENGTH = 250;
const MAX_OBJECT_DEPTH = 3;
const MAX_OBJECT_KEYS = 15;
const MAX_ARRAY_ITEMS = 10;
const MAX_BREADCRUMBS = 10;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_EVENT_FUTURE_MS = 5 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_KEY_PATTERN = /password|passwd|secret|token|authorization|auth|cookie|session|api[_-]?key|access[_-]?key|refresh/i;

export const CLIENT_EVENT_LEVELS = {
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
} as const satisfies Record<string, LogLevel>;

type ClientEventName = keyof typeof CLIENT_EVENT_LEVELS;

export type ClientTelemetryServerContext = {
  environment?: string;
  release?: string;
  requestId?: string;
  userAgent?: string;
  receivedAt?: Date;
};

export type ClientTelemetryParseResult =
  | { ok: true; events: LogEventInput[] }
  | { ok: false; error: "Invalid telemetry payload." };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: string, maximum = MAX_STRING_LENGTH): string {
  const redacted = redactSensitiveText(value);
  return redacted.length <= maximum ? redacted : `${redacted.slice(0, maximum)}[truncated]`;
}

function boundedValue(value: unknown, depth = 0, keyHint = ""): unknown {
  if (SECRET_KEY_PATTERN.test(keyHint)) return "[REDACTED]";
  if (typeof value === "string") return boundedText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (depth >= MAX_OBJECT_DEPTH) return "[Max depth reached]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => boundedValue(item, depth + 1, keyHint));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, nested]) => [boundedText(key, 64), boundedValue(nested, depth + 1, key)]),
    );
  }
  return boundedText(String(value));
}

function pathnameOnly(value: string): string | null {
  try {
    const parsed = new URL(value, "https://vsu-smartmap.local");
    if (!parsed.pathname.startsWith("/")) return null;
    return boundedText(parsed.pathname, MAX_ROUTE_LENGTH);
  } catch {
    return null;
  }
}

function reasonableTimestamp(value: unknown, now: Date): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const delta = milliseconds - now.getTime();
  if (delta > MAX_EVENT_FUTURE_MS || delta < -MAX_EVENT_AGE_MS) return null;
  return new Date(milliseconds).toISOString();
}

function normalizeBreadcrumbs(value: unknown, now: Date): LogBreadcrumb[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: LogBreadcrumb[] = [];
  for (const candidate of value.slice(-MAX_BREADCRUMBS)) {
    if (!isRecord(candidate)) return null;
    const timestamp = reasonableTimestamp(candidate.timestamp, now);
    if (timestamp === null) return null;
    if (candidate.category !== undefined && typeof candidate.category !== "string") return null;
    if (candidate.message !== undefined && typeof candidate.message !== "string") return null;
    if (candidate.metadata !== undefined && !isRecord(candidate.metadata)) return null;
    normalized.push({
      timestamp: timestamp ?? now.toISOString(),
      category: boundedText(typeof candidate.category === "string" ? candidate.category : "event", 64),
      message: boundedText(typeof candidate.message === "string" ? candidate.message : ""),
      metadata: isRecord(candidate.metadata)
        ? boundedValue(candidate.metadata) as Record<string, unknown>
        : undefined,
    });
  }
  return normalized;
}

function normalizeEvent(
  candidate: unknown,
  context: ClientTelemetryServerContext,
  now: Date,
): LogEventInput | null {
  if (!isRecord(candidate) || typeof candidate.eventName !== "string") return null;
  if (!(candidate.eventName in CLIENT_EVENT_LEVELS)) return null;
  const eventName = candidate.eventName as ClientEventName;
  if (candidate.message !== undefined && typeof candidate.message !== "string") return null;
  if (candidate.sessionId !== undefined && (
    typeof candidate.sessionId !== "string" || !UUID_PATTERN.test(candidate.sessionId)
  )) return null;
  if (candidate.route !== undefined && typeof candidate.route !== "string") return null;
  if (candidate.metadata !== undefined && !isRecord(candidate.metadata)) return null;
  const occurredAt = reasonableTimestamp(candidate.occurredAt, now);
  const breadcrumbs = normalizeBreadcrumbs(candidate.breadcrumbs, now);
  const route = typeof candidate.route === "string" ? pathnameOnly(candidate.route) : undefined;
  if (occurredAt === null || breadcrumbs === null || route === null) return null;

  return {
    source: "client",
    level: CLIENT_EVENT_LEVELS[eventName],
    eventName,
    ...(typeof candidate.message === "string" ? { message: boundedText(candidate.message) } : {}),
    ...(typeof candidate.sessionId === "string" ? { sessionId: candidate.sessionId } : {}),
    ...(context.requestId ? { requestId: boundedText(context.requestId, 128) } : {}),
    ...(route ? { route } : {}),
    ...(context.userAgent ? { userAgent: boundedText(context.userAgent, 512) } : {}),
    ...(context.release ? { release: boundedText(context.release, 128) } : {}),
    ...(context.environment ? { environment: boundedText(context.environment, 64) } : {}),
    metadata: isRecord(candidate.metadata)
      ? boundedValue(candidate.metadata) as Record<string, unknown>
      : {},
    breadcrumbs,
    ...(occurredAt ? { occurredAt } : {}),
  };
}

export function parseClientTelemetryPayload(
  payload: unknown,
  context: ClientTelemetryServerContext,
): ClientTelemetryParseResult {
  const now = context.receivedAt ?? new Date();
  let candidates: unknown[];
  if (isRecord(payload) && "events" in payload) {
    if (!Array.isArray(payload.events)) return { ok: false, error: "Invalid telemetry payload." };
    candidates = payload.events;
  } else {
    candidates = [payload];
  }

  if (candidates.length < 1 || candidates.length > MAX_CLIENT_TELEMETRY_EVENTS) {
    return { ok: false, error: "Invalid telemetry payload." };
  }

  const events = candidates.map((candidate) => normalizeEvent(candidate, context, now));
  if (events.some((event) => event === null)) {
    return { ok: false, error: "Invalid telemetry payload." };
  }
  return { ok: true, events: events as LogEventInput[] };
}
