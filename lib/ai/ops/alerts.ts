import { notifyAdmins } from "@/lib/notifications/service";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

import type { ChatOutcome } from "./types";

const SAFE_OUTCOMES = new Set<ChatOutcome>([
  "live",
  "cached",
  "recovered",
  "generated_fallback",
  "static_fallback",
  "disabled_fallback",
  "rate_limited",
  "validation_failed",
  "error",
  "synthetic",
]);
const SAFE_ERROR_CLASSES = new Set([
  "provider_error",
  "provider_timeout",
  "provider_unavailable",
  "provider_quota",
  "provider_rate_limit",
  "validation_error",
  "internal_error",
  "unknown",
]);
const SAFE_AGGREGATE_KEYS = [
  "affectedTurns",
  "attemptCount",
  "failureCount",
  "fallbackCount",
  "latencyMs",
  "timeToFirstTokenMs",
] as const;

type AlertAggregate = Partial<Record<(typeof SAFE_AGGREGATE_KEYS)[number], number>>;

export type ChatOpsAlertInput = {
  outcome: ChatOutcome;
  errorClass?: string;
  releaseId?: string;
  requestId?: string;
  occurredAt?: Date;
  aggregate?: AlertAggregate;
};

type SafeAlertDetails = {
  outcome: ChatOutcome;
  errorClass?: string;
  releaseId?: string;
  requestId?: string;
  aggregate?: AlertAggregate;
};

function safeOutcome(value: ChatOutcome): ChatOutcome {
  return SAFE_OUTCOMES.has(value) ? value : "error";
}

function safeErrorClass(value: string | undefined): string | undefined {
  return value && SAFE_ERROR_CLASSES.has(value) ? value : undefined;
}

function safeIdentifier(value: string | undefined): string | undefined {
  if (!value || !/^[A-Za-z0-9._:-]{1,200}$/.test(value)) return undefined;
  return value;
}

function safeAggregate(value: AlertAggregate | undefined): AlertAggregate | undefined {
  if (!value) return undefined;
  const aggregate = Object.fromEntries(
    SAFE_AGGREGATE_KEYS.flatMap((key) => {
      const candidate = value[key];
      if (typeof candidate !== "number" || !Number.isFinite(candidate)) return [];
      return [[key, Math.min(Math.max(Math.round(candidate), 0), 1_000_000)]];
    }),
  ) as AlertAggregate;
  return Object.keys(aggregate).length > 0 ? aggregate : undefined;
}

function safeDetails(input: ChatOpsAlertInput): SafeAlertDetails {
  const details: SafeAlertDetails = { outcome: safeOutcome(input.outcome) };
  const errorClass = safeErrorClass(input.errorClass);
  const releaseId = safeIdentifier(input.releaseId);
  const requestId = safeIdentifier(input.requestId);
  const aggregate = safeAggregate(input.aggregate);
  if (errorClass) details.errorClass = errorClass;
  if (releaseId) details.releaseId = releaseId;
  if (requestId) details.requestId = requestId;
  if (aggregate) details.aggregate = aggregate;
  return details;
}

function textFor(details: SafeAlertDetails): string {
  const lines = [`Outcome: ${details.outcome}`];
  if (details.errorClass) lines.push(`Error class: ${details.errorClass}`);
  if (details.releaseId) lines.push(`Release: ${details.releaseId}`);
  if (details.requestId) lines.push(`Request ID: ${details.requestId}`);
  if (details.aggregate) {
    lines.push(`Aggregate: ${Object.entries(details.aggregate).map(([key, value]) => `${key}=${value}`).join(", ")}`);
  }
  return lines.join("\n");
}

export async function notifyChatOpsAlert(
  input: ChatOpsAlertInput,
): Promise<{ claimed: boolean; notified: boolean }> {
  const details = safeDetails(input);
  const occurredAt = input.occurredAt && !Number.isNaN(input.occurredAt.getTime())
    ? input.occurredAt
    : new Date();
  const fingerprint = `chat_ops:${details.outcome}:${details.errorClass ?? "none"}`;

  try {
    const { data: claimed, error } = await getSupabaseServiceRoleClient().rpc("claim_ai_chat_alert", {
      p_fingerprint: fingerprint,
      p_occurred_at: occurredAt.toISOString(),
      p_metadata: details,
    });
    if (error || claimed !== true) return { claimed: false, notified: false };

    try {
      await notifyAdmins({
        eventType: "chat_ops_alert",
        subject: `Chat operations alert: ${details.outcome}${details.errorClass ? ` (${details.errorClass})` : ""}`,
        text: textFor(details),
        metadata: details,
      });
      return { claimed: true, notified: true };
    } catch {
      return { claimed: true, notified: false };
    }
  } catch {
    return { claimed: false, notified: false };
  }
}
