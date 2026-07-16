import { unstable_noStore as noStore } from "next/cache";

import {
  buildIncidentExport,
  classifyLogEvent,
  createIncidentFingerprint,
  getIncidentTitle,
  sanitizeLogEventInput,
  serializeIncidentsToCsv,
  type ExportLogEvent,
  type IncidentRecord,
  type IncidentSeverity,
  type IncidentStatus,
  type LogEventInput,
  type SanitizedLogEvent,
} from "@/lib/observability/logging";
import { CLIENT_EVENT_LEVELS } from "@/lib/observability/client-telemetry";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

type AppLogEventRow = {
  id: string;
  incident_id: string | null;
  source: "client" | "server";
  level: "debug" | "info" | "warn" | "error" | "fatal";
  event_name: string;
  message: string | null;
  session_id: string | null;
  request_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  user_agent: string | null;
  release: string | null;
  environment: string | null;
  metadata: Record<string, unknown>;
  breadcrumbs: unknown;
  fingerprint: string | null;
  occurred_at: string;
  received_at: string;
  created_at: string;
};

type AppBugIncidentRow = {
  id: string;
  fingerprint: string;
  title: string;
  summary: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: "client" | "server";
  route: string | null;
  sample_event_id: string | null;
  event_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type IncidentWithSample = IncidentRecord & {
  sampleEventId: string | null;
  sampleMessage: string | null;
  updatedAt: string;
};

function toIncidentRecord(row: AppBugIncidentRow): IncidentRecord {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    route: row.route,
    source: row.source,
    fingerprint: row.fingerprint,
    eventCount: row.event_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    summary: row.summary,
  };
}

function toIncidentWithSample(row: AppBugIncidentRow & { sample_event?: AppLogEventRow | null }): IncidentWithSample {
  return {
    ...toIncidentRecord(row),
    sampleEventId: row.sample_event_id,
    sampleMessage: row.sample_event?.message ?? null,
    updatedAt: row.updated_at,
  };
}

function toExportLogEvent(row: AppLogEventRow): ExportLogEvent {
  const breadcrumbs = Array.isArray(row.breadcrumbs) ? row.breadcrumbs : [];
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    level: row.level,
    eventName: row.event_name,
    message: row.message ?? undefined,
    route: row.route ?? undefined,
    metadata: row.metadata ?? {},
    breadcrumbs: breadcrumbs as ExportLogEvent["breadcrumbs"],
  };
}

function toInsertPayload(event: SanitizedLogEvent, fingerprint?: string, incidentId?: string) {
  return {
    id: event.id,
    incident_id: incidentId,
    source: event.source,
    level: event.level,
    event_name: event.eventName,
    message: event.message,
    session_id: event.sessionId,
    request_id: event.requestId,
    route: event.route,
    method: event.method,
    status_code: event.statusCode,
    duration_ms: event.durationMs,
    user_agent: event.userAgent,
    release: event.release,
    environment: event.environment,
    metadata: event.metadata,
    breadcrumbs: event.breadcrumbs,
    fingerprint,
    occurred_at: event.occurredAt,
  };
}

async function upsertIncident(
  event: SanitizedLogEvent,
  fingerprint: string,
  severity: IncidentSeverity,
): Promise<AppBugIncidentRow | null> {
  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const summary = event.message ?? `${event.eventName} on ${event.route ?? "unknown route"}`;

  const existing = await supabase
    .from("app_bug_incidents")
    .select("*")
    .eq("fingerprint", fingerprint)
    .maybeSingle<AppBugIncidentRow>();

  if (existing.error) {
    console.error("[observability] incident lookup failed", existing.error.message);
    return null;
  }

  if (existing.data) {
    const { data, error } = await supabase
      .from("app_bug_incidents")
      .update({
        severity,
        summary,
        route: event.route ?? existing.data.route,
        last_seen_at: now,
        event_count: existing.data.event_count + 1,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single<AppBugIncidentRow>();

    if (error) {
      console.error("[observability] incident update failed", error.message);
      return existing.data;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("app_bug_incidents")
    .insert({
      fingerprint,
      title: getIncidentTitle(event),
      summary,
      severity,
      status: "OPEN",
      source: event.source,
      route: event.route,
      first_seen_at: event.occurredAt ?? now,
      last_seen_at: event.occurredAt ?? now,
    })
    .select("*")
    .single<AppBugIncidentRow>();

  if (error) {
    console.error("[observability] incident insert failed", error.message);
    return null;
  }

  return data;
}

export async function recordLogEvent(input: LogEventInput): Promise<{ id?: string; incidentId?: string; error?: string }> {
  const event = sanitizeLogEventInput(input);
  const classification = classifyLogEvent(event);
  const fingerprint = classification.shouldCreateIncident ? createIncidentFingerprint(event) : undefined;
  const incident = fingerprint ? await upsertIncident(event, fingerprint, classification.severity) : null;

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("app_log_events")
    .insert(toInsertPayload(event, fingerprint, incident?.id))
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("[observability] log event insert failed", error.message);
    return { error: error.message };
  }

  if (incident && !incident.sample_event_id) {
    await supabase
      .from("app_bug_incidents")
      .update({ sample_event_id: data.id })
      .eq("id", incident.id);
  }

  return { id: data.id, incidentId: incident?.id };
}

export async function recordLogEvents(inputs: LogEventInput[]): Promise<{ accepted: number; failed: number }> {
  let accepted = 0;
  let failed = 0;

  for (const input of inputs.slice(0, 20)) {
    const result = await recordLogEvent(input);
    if (result.error) {
      failed += 1;
    } else {
      accepted += 1;
    }
  }

  return { accepted, failed };
}

export async function recordClientTelemetryEvents(
  inputs: LogEventInput[],
): Promise<{ accepted: number; failed: number }> {
  const events = inputs.slice(0, 10).flatMap((input) => {
    const level = CLIENT_EVENT_LEVELS[input.eventName as keyof typeof CLIENT_EVENT_LEVELS];
    if (!level) return [];
    return [
      sanitizeLogEventInput({
        ...input,
        source: "client",
        level,
        method: undefined,
        statusCode: undefined,
      }),
    ];
  });

  if (events.length === 0) return { accepted: 0, failed: 0 };

  const rows = events.map((event) => ({
    ...toInsertPayload(event),
    incident_id: null,
    fingerprint: null,
  }));
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("app_log_events").insert(rows);

  if (error) {
    console.error("[observability] client telemetry insert failed");
    return { accepted: 0, failed: events.length };
  }

  return { accepted: events.length, failed: 0 };
}

export async function listBugIncidents(params: {
  status?: IncidentStatus | "ALL";
  severity?: IncidentSeverity | "ALL";
  source?: "client" | "server" | "ALL";
  limit?: number;
} = {}): Promise<IncidentWithSample[]> {
  noStore();
  const supabase = getSupabaseServiceRoleClient();
  let query = supabase
    .from("app_bug_incidents")
    .select("*, sample_event:app_log_events!app_bug_incidents_sample_event_fk(*)")
    .order("last_seen_at", { ascending: false })
    .limit(params.limit ?? 100);

  if (params.status && params.status !== "ALL") query = query.eq("status", params.status);
  if (params.severity && params.severity !== "ALL") query = query.eq("severity", params.severity);
  if (params.source && params.source !== "ALL") query = query.eq("source", params.source);

  const { data, error } = await query.returns<(AppBugIncidentRow & { sample_event?: AppLogEventRow | null })[]>();
  if (error) {
    console.error("[observability] incident list failed", error.message);
    return [];
  }

  return (data ?? []).map(toIncidentWithSample);
}

export async function updateBugIncidentStatus(id: string, status: IncidentStatus): Promise<{ error?: string }> {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("app_bug_incidents")
    .update({ status })
    .eq("id", id);

  return error ? { error: error.message } : {};
}

export async function buildBugIncidentExport(id: string) {
  noStore();
  const supabase = getSupabaseServiceRoleClient();
  const { data: incident, error: incidentError } = await supabase
    .from("app_bug_incidents")
    .select("*")
    .eq("id", id)
    .single<AppBugIncidentRow>();

  if (incidentError || !incident) return null;

  const { data: sampleEvent } = await supabase
    .from("app_log_events")
    .select("*")
    .eq("id", incident.sample_event_id ?? "")
    .maybeSingle<AppLogEventRow>();

  const { data: relatedEvents } = await supabase
    .from("app_log_events")
    .select("*")
    .eq("fingerprint", incident.fingerprint)
    .order("occurred_at", { ascending: false })
    .limit(25)
    .returns<AppLogEventRow[]>();

  const fallbackEvent =
    sampleEvent ??
    relatedEvents?.[0] ??
    ({
      id: "unknown",
      occurred_at: incident.last_seen_at,
      level: "error",
      event_name: "incident",
      message: incident.summary,
      route: incident.route,
      metadata: {},
      breadcrumbs: [],
    } as AppLogEventRow);

  return buildIncidentExport({
    incident: toIncidentRecord(incident),
    sampleEvent: toExportLogEvent(fallbackEvent),
    relatedEvents: (relatedEvents ?? []).map(toExportLogEvent),
  });
}

export async function exportBugIncidentsCsv(): Promise<string> {
  const incidents = await listBugIncidents({ limit: 500 });
  return serializeIncidentsToCsv(incidents);
}
