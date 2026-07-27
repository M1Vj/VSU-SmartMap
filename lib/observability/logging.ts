export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export const LOG_SOURCES = ["client", "server"] as const;
export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogSource = (typeof LOG_SOURCES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type LogBreadcrumb = {
  timestamp: string;
  category: string;
  message: string;
  level?: LogLevel;
  metadata?: Record<string, unknown>;
};

export type LogEventInput = {
  id?: string;
  source: LogSource;
  level: LogLevel;
  eventName: string;
  message?: string;
  sessionId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
  release?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
  breadcrumbs?: LogBreadcrumb[];
  occurredAt?: string;
};

export type SanitizedLogEvent = Required<Pick<LogEventInput, "source" | "level" | "eventName">> &
  Omit<LogEventInput, "source" | "level" | "eventName" | "metadata" | "breadcrumbs"> & {
    metadata: Record<string, unknown>;
    breadcrumbs: LogBreadcrumb[];
  };

export type IncidentRecord = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  route: string | null;
  source: LogSource;
  fingerprint: string;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  summary: string | null;
};

export type ExportLogEvent = {
  id: string;
  occurredAt: string;
  level: LogLevel;
  eventName: string;
  message?: string;
  route?: string;
  metadata?: Record<string, unknown>;
  breadcrumbs?: LogBreadcrumb[];
};

const MAX_STRING_LENGTH = 1024;
const MAX_OBJECT_DEPTH = 5;
const MAX_OBJECT_KEYS = 40;
const MAX_ARRAY_ITEMS = 25;
const MAX_BREADCRUMBS = 25;
const REDACTED = "[REDACTED]";
const SECRET_KEY_PATTERN =
  /password|passwd|secret|token|authorization|auth|cookie|session|api[_-]?key|access[_-]?key|refresh/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}[truncated]`;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => {
      try {
        const url = new URL(candidate);
        return `${url.origin}${url.pathname}${url.search || url.hash ? "?[REDACTED]" : ""}`;
      } catch {
        return "[REDACTED URL]";
      }
    })
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]")
    .replace(/(?<!\w)(?:\+?\d[\s().-]*){10,15}(?!\w)/g, "[REDACTED PHONE]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\s,;]+/gi, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      return `${match.split(/[:=]/, 1)[0]}${separator}[REDACTED]`;
    })
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]")
    .replace(/\b(?:sk-(?:proj-)?|gh[pousr]_|github_pat_|AIza|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/g, "[REDACTED TOKEN]")
    .replace(/\b(password|passwd|secret|token|api[_-]?key|access[_-]?key|refresh[_-]?token)\s*[:=]\s*[^\s,;|]+/gi, "$1=[REDACTED]")
    .replace(/\/(?:Users|home)\/[^/\s]+/g, (match) => `${match.split("/").slice(0, 2).join("/")}/[REDACTED USER]`);
}

function cleanString(value: string): string {
  return truncateString(redactSensitiveText(value));
}

function sanitizeValue(value: unknown, depth = 0, keyHint = ""): unknown {
  if (SECRET_KEY_PATTERN.test(keyHint)) return REDACTED;

  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (value instanceof Error) {
    return {
      name: cleanString(value.name),
      message: cleanString(value.message),
      stack: value.stack ? cleanString(value.stack) : undefined,
    };
  }

  if (depth >= MAX_OBJECT_DEPTH) return "[Max depth reached]";

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, keyHint));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, nested]) => [key, sanitizeValue(nested, depth + 1, key)]),
    );
  }

  return cleanString(String(value));
}

function cleanRoute(route?: string): string | undefined {
  if (!route) return undefined;

  try {
    const parsed = new URL(route, "https://vsu-smartmap.local");
    return cleanString(parsed.pathname).slice(0, 250);
  } catch {
    const pathname = route.split(/[?#]/, 1)[0];
    return pathname ? cleanString(pathname).slice(0, 250) : undefined;
  }
}

function normalizeLevel(level: unknown): LogLevel {
  return LOG_LEVELS.includes(level as LogLevel) ? (level as LogLevel) : "info";
}

function normalizeSource(source: unknown): LogSource {
  return LOG_SOURCES.includes(source as LogSource) ? (source as LogSource) : "client";
}

function normalizeBreadcrumbs(breadcrumbs: unknown): LogBreadcrumb[] {
  if (!Array.isArray(breadcrumbs)) return [];

  return breadcrumbs.slice(-MAX_BREADCRUMBS).map((breadcrumb) => {
    const row = isRecord(breadcrumb) ? breadcrumb : {};
    return {
      timestamp:
        typeof row.timestamp === "string" && row.timestamp
          ? cleanString(row.timestamp)
          : new Date().toISOString(),
      category: typeof row.category === "string" ? cleanString(row.category) : "event",
      message: typeof row.message === "string" ? cleanString(row.message) : "",
      level: LOG_LEVELS.includes(row.level as LogLevel) ? (row.level as LogLevel) : undefined,
      metadata: isRecord(row.metadata) ? (sanitizeValue(row.metadata) as Record<string, unknown>) : undefined,
    };
  });
}

export function sanitizeLogEventInput(input: LogEventInput): SanitizedLogEvent {
  return {
    ...input,
    source: normalizeSource(input.source),
    level: normalizeLevel(input.level),
    eventName: cleanString(input.eventName || "app.event"),
    message: input.message ? cleanString(input.message) : undefined,
    sessionId: input.sessionId ? cleanString(input.sessionId) : undefined,
    requestId: input.requestId ? cleanString(input.requestId) : undefined,
    route: cleanRoute(input.route),
    method: input.method ? cleanString(input.method.toUpperCase()) : undefined,
    statusCode: typeof input.statusCode === "number" ? input.statusCode : undefined,
    durationMs: typeof input.durationMs === "number" ? Math.max(0, Math.round(input.durationMs)) : undefined,
    userAgent: input.userAgent ? cleanString(input.userAgent) : undefined,
    release: input.release ? cleanString(input.release) : undefined,
    environment: input.environment ? cleanString(input.environment) : undefined,
    metadata: isRecord(input.metadata) ? (sanitizeValue(input.metadata) as Record<string, unknown>) : {},
    breadcrumbs: normalizeBreadcrumbs(input.breadcrumbs),
    occurredAt: input.occurredAt ? cleanString(input.occurredAt) : undefined,
  };
}

// Conditions that describe the user's environment rather than a defect in the
// app. They are still worth logging - connectivity gaps explain later failures -
// but each one used to open a MEDIUM incident, so a student walking into a dead
// spot filed a bug report. These names are exempt from incident creation at any
// level.
const ENVIRONMENT_EVENT_NAMES = new Set([
  "browser.offline",
  "browser.online",
  "pwa.service_worker_unavailable",
]);

export function classifyLogEvent(
  event: Pick<LogEventInput, "source" | "level" | "eventName" | "statusCode" | "route">,
): { shouldCreateIncident: boolean; severity: IncidentSeverity } {
  if (ENVIRONMENT_EVENT_NAMES.has(event.eventName)) {
    return { shouldCreateIncident: false, severity: "LOW" };
  }

  if (event.level === "fatal") {
    return { shouldCreateIncident: true, severity: "CRITICAL" };
  }

  if (typeof event.statusCode === "number" && event.statusCode >= 500) {
    return { shouldCreateIncident: true, severity: event.statusCode >= 503 ? "CRITICAL" : "HIGH" };
  }

  if (event.level === "error") {
    return { shouldCreateIncident: true, severity: "HIGH" };
  }

  if (event.level === "warn" && /failed|timeout|offline|denied|quota/i.test(event.eventName)) {
    return { shouldCreateIncident: true, severity: "MEDIUM" };
  }

  return { shouldCreateIncident: false, severity: "LOW" };
}

function normalizeFingerprintMessage(message?: string): string {
  return (message ?? "")
    .replace(/chunk[-_.a-z0-9]+/gi, "chunk")
    .replace(/:\d+:\d+/g, ":line:column")
    .replace(/:\d+/g, ":line")
    .replace(/[a-f0-9]{8,}/gi, "hash")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function createIncidentFingerprint(
  event: Pick<LogEventInput, "source" | "eventName" | "route" | "message" | "statusCode">,
): string {
  const stablePayload = [
    event.source,
    event.eventName,
    cleanRoute(event.route) ?? "",
    event.statusCode ?? "",
    normalizeFingerprintMessage(event.message),
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < stablePayload.length; index += 1) {
    hash ^= stablePayload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fp_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function getIncidentTitle(event: Pick<LogEventInput, "eventName" | "route" | "message">): string {
  const route = cleanRoute(event.route) ?? "unknown route";
  const message = event.message ? `: ${event.message}` : "";
  return cleanString(`${event.eventName} on ${route}${message}`);
}

export function buildIncidentExport(input: {
  incident: IncidentRecord;
  sampleEvent: ExportLogEvent;
  relatedEvents: ExportLogEvent[];
}) {
  return {
    exportedAt: new Date().toISOString(),
    incident: input.incident,
    fixingContext: {
      sampleEvent: input.sampleEvent,
      breadcrumbs: input.sampleEvent.breadcrumbs ?? [],
      relatedEvents: input.relatedEvents,
    },
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeIncidentsToCsv(incidents: IncidentRecord[]): string {
  const headers = [
    "id",
    "title",
    "severity",
    "status",
    "source",
    "route",
    "event_count",
    "first_seen_at",
    "last_seen_at",
    "fingerprint",
    "summary",
  ];

  const rows = incidents.map((incident) =>
    [
      incident.id,
      incident.title,
      incident.severity,
      incident.status,
      incident.source,
      incident.route ?? "",
      incident.eventCount,
      incident.firstSeenAt,
      incident.lastSeenAt,
      incident.fingerprint,
      incident.summary ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}`;
}
