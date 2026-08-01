import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const ALLOWED_OUTCOMES = new Set(["live", "cached", "recovered", "generated_fallback", "static_fallback", "disabled_fallback", "rate_limited", "validation_failed", "error", "synthetic"]);
const ALLOWED_MODELS = new Set(["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"]);
const ALLOWED_VALIDATION = new Set(["pass", "warn", "fail"]);
export const CHAT_OPS_REVIEW_STATUSES = ["unreviewed", "reviewing", "resolved", "dismissed"] as const;
const ALLOWED_REVIEW = new Set<string>(CHAT_OPS_REVIEW_STATUSES);
const ALLOWED_WINDOWS = new Set([1, 6, 24, 72, 168]);

export type ChatOpsFilters = {
  outcome?: string;
  model?: string;
  validation?: string;
  reviewStatus?: string;
  windowHours: number;
  since: string;
};

export function parseChatOpsFilters(input: Record<string, string | undefined>, now = new Date()): ChatOpsFilters {
  const requestedWindow = Number.parseInt(input.windowHours ?? "24", 10);
  const windowHours = ALLOWED_WINDOWS.has(requestedWindow) ? requestedWindow : 24;
  return {
    ...(input.outcome && ALLOWED_OUTCOMES.has(input.outcome) ? { outcome: input.outcome } : {}),
    ...(input.model && ALLOWED_MODELS.has(input.model) ? { model: input.model } : {}),
    ...(input.validation && ALLOWED_VALIDATION.has(input.validation) ? { validation: input.validation } : {}),
    ...(input.reviewStatus && ALLOWED_REVIEW.has(input.reviewStatus) ? { reviewStatus: input.reviewStatus } : {}),
    windowHours,
    since: new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString(),
  };
}

type TurnRow = {
  id: string;
  created_at: string;
  release_id: string;
  request_id: string;
  user_message: string;
  assistant_message: string | null;
  outcome: string;
  requested_model: string | null;
  selected_model: string | null;
  latency_ms: number | null;
  time_to_first_token_ms: number | null;
  cache_state: string | null;
  retrieved_record_ids: string[] | null;
  validation_status: string;
  validation_reasons: string[] | null;
  injection_signals: string[] | null;
  error_class: string | null;
  review_status: string;
};

type FeedbackRow = {
  id: string;
  turn_id: string;
  rating: "positive" | "negative";
  reason: string | null;
  comment: string | null;
  review_status: string;
  created_at: string;
};

export type ChatOpsTurn = {
  id: string;
  createdAt: string;
  releaseId: string;
  requestId: string;
  userMessage: string;
  assistantMessage: string | null;
  outcome: string;
  requestedModel: string | null;
  selectedModel: string | null;
  latencyMs: number | null;
  timeToFirstTokenMs: number | null;
  cacheState: string | null;
  retrievedRecordIds: string[];
  grounded: boolean;
  validationStatus: string;
  validationReasons: string[];
  injectionSignals: string[];
  errorClass: string | null;
  reviewStatus: string;
};

export type ChatOpsFeedback = {
  id: string;
  turnId: string;
  rating: "positive" | "negative";
  reason: string | null;
  comment: string | null;
  reviewStatus: string;
  createdAt: string;
};

export type ChatOpsDashboardData = {
  summary: {
    totalTurns: number;
    outcomes: Record<string, number>;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
    ttftP50Ms: number | null;
    ttftP95Ms: number | null;
    fallbackRate: number;
    errorRate: number;
    negativeFeedbackRate: number;
    cacheHits: number;
    groundedTurns: number;
    validationWarnings: number;
    injectionSignals: Record<string, number>;
    models: Record<string, number>;
    positiveFeedback: number;
    negativeFeedback: number;
  };
  turns: ChatOpsTurn[];
  feedback: ChatOpsFeedback[];
  page: { limit: number; offset: number; hasMoreTurns: boolean; hasMoreFeedback: boolean };
  retention: { turnsDays: 90; feedbackDays: 90; alertClaimsDays: 30; alertWindowMinutes: 15 };
};

const TURN_COLUMNS = [
  "id", "created_at", "release_id", "request_id", "user_message", "assistant_message", "outcome",
  "requested_model", "selected_model", "latency_ms", "time_to_first_token_ms",
  "cache_state", "retrieved_record_ids", "validation_status", "validation_reasons", "injection_signals",
  "error_class", "review_status",
].join(",");
const FEEDBACK_COLUMNS = "id,turn_id,rating,reason,comment,review_status,created_at";

function sanitizeExcerpt(value: string | null, maxLength = 500): string | null {
  if (value === null) return null;
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/(?:\+?\d[\s().-]*){8,}\d/g, "[phone]")
    .replace(/\bBearer\s+\S+/gi, "[credential]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[credential]")
    .replace(/\b(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*\S+/gi, "[credential]")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 1)}…` : sanitized;
}

function increment(target: Record<string, number>, key: string | null | undefined) {
  if (key) target[key] = (target[key] ?? 0) + 1;
}

function percentile(values: Array<number | null>, quantile: number): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  present.sort((a, b) => a - b);
  return present[Math.max(0, Math.ceil(quantile * present.length) - 1)] ?? null;
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeChatOpsCsv(turns: ChatOpsTurn[]): string {
  const columns: Array<[string, (turn: ChatOpsTurn) => unknown]> = [
    ["created_at", (turn) => turn.createdAt], ["request_id", (turn) => turn.requestId],
    ["release_id", (turn) => turn.releaseId], ["outcome", (turn) => turn.outcome],
    ["selected_model", (turn) => turn.selectedModel], ["latency_ms", (turn) => turn.latencyMs],
    ["ttft_ms", (turn) => turn.timeToFirstTokenMs], ["cache_state", (turn) => turn.cacheState],
    ["retrieved_ids", (turn) => turn.retrievedRecordIds], ["validation", (turn) => turn.validationStatus],
    ["validation_reasons", (turn) => turn.validationReasons], ["injection_signals", (turn) => turn.injectionSignals],
    ["error_class", (turn) => turn.errorClass], ["review_status", (turn) => turn.reviewStatus],
    ["user_excerpt", (turn) => turn.userMessage], ["assistant_excerpt", (turn) => turn.assistantMessage],
  ];
  return [columns.map(([name]) => csvCell(name)).join(","), ...turns.slice(0, 500).map((turn) => columns.map(([, read]) => csvCell(read(turn))).join(","))].join("\n");
}

export async function getChatOpsDashboard(
  client: SupabaseClient,
  params: { limit?: number; offset?: number; filters?: ChatOpsFilters } = {},
): Promise<ChatOpsDashboardData> {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(params.limit ?? DEFAULT_PAGE_SIZE)));
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));
  const end = offset + limit - 1;
  const filters = params.filters ?? parseChatOpsFilters({});
  let turnQuery = client.from("ai_chat_turns").select(TURN_COLUMNS).order("created_at", { ascending: false }).gte("created_at", filters.since);
  let feedbackQuery = client.from("ai_chat_feedback").select(FEEDBACK_COLUMNS).order("created_at", { ascending: false }).gte("created_at", filters.since);
  if (filters.outcome) turnQuery = turnQuery.eq("outcome", filters.outcome);
  if (filters.model) turnQuery = turnQuery.eq("selected_model", filters.model);
  if (filters.validation) turnQuery = turnQuery.eq("validation_status", filters.validation);
  if (filters.reviewStatus) {
    turnQuery = turnQuery.eq("review_status", filters.reviewStatus);
    feedbackQuery = feedbackQuery.eq("review_status", filters.reviewStatus);
  }
  const [turnResult, feedbackResult] = await Promise.all([turnQuery.range(offset, end), feedbackQuery.range(offset, end)]);

  if (turnResult.error) console.error("[chat-ops] turn list failed");
  if (feedbackResult.error) console.error("[chat-ops] feedback list failed");
  const turnRows = (turnResult.error ? [] : turnResult.data ?? []) as unknown as TurnRow[];
  const feedbackRows = (feedbackResult.error ? [] : feedbackResult.data ?? []) as unknown as FeedbackRow[];
  const turns = turnRows.map((row): ChatOpsTurn => ({
    id: row.id, createdAt: row.created_at, releaseId: row.release_id, requestId: row.request_id,
    userMessage: sanitizeExcerpt(row.user_message) ?? "",
    assistantMessage: sanitizeExcerpt(row.assistant_message), outcome: row.outcome,
    requestedModel: row.requested_model, selectedModel: row.selected_model,
    latencyMs: row.latency_ms, timeToFirstTokenMs: row.time_to_first_token_ms,
    cacheState: row.cache_state, retrievedRecordIds: row.retrieved_record_ids ?? [],
    grounded: (row.retrieved_record_ids?.length ?? 0) > 0,
    validationStatus: row.validation_status, validationReasons: row.validation_reasons ?? [],
    injectionSignals: row.injection_signals ?? [], errorClass: row.error_class, reviewStatus: row.review_status,
  }));
  const feedback = feedbackRows.map((row): ChatOpsFeedback => ({
    id: row.id, turnId: row.turn_id, rating: row.rating, reason: row.reason,
    comment: sanitizeExcerpt(row.comment, 300), reviewStatus: row.review_status, createdAt: row.created_at,
  }));
  const outcomes: Record<string, number> = {};
  const injectionSignals: Record<string, number> = {};
  const models: Record<string, number> = {};
  turns.forEach((turn) => {
    increment(outcomes, turn.outcome);
    increment(models, turn.selectedModel ?? turn.requestedModel);
    turn.injectionSignals.forEach((signal) => increment(injectionSignals, signal));
  });
  const fallbackOutcomes = new Set(["recovered", "generated_fallback", "static_fallback", "disabled_fallback"]);
  const errorOutcomes = new Set(["error", "rate_limited", "validation_failed"]);
  const ratio = (count: number, total: number) => total ? count / total : 0;

  return {
    summary: {
      totalTurns: turns.length, outcomes,
      latencyP50Ms: percentile(turns.map((turn) => turn.latencyMs), 0.5),
      latencyP95Ms: percentile(turns.map((turn) => turn.latencyMs), 0.95),
      ttftP50Ms: percentile(turns.map((turn) => turn.timeToFirstTokenMs), 0.5),
      ttftP95Ms: percentile(turns.map((turn) => turn.timeToFirstTokenMs), 0.95),
      fallbackRate: ratio(turns.filter((turn) => fallbackOutcomes.has(turn.outcome)).length, turns.length),
      errorRate: ratio(turns.filter((turn) => errorOutcomes.has(turn.outcome)).length, turns.length),
      negativeFeedbackRate: ratio(feedback.filter((item) => item.rating === "negative").length, feedback.length),
      cacheHits: turns.filter((turn) => turn.outcome === "cached" || turn.cacheState === "hit").length,
      groundedTurns: turns.filter((turn) => turn.grounded).length,
      validationWarnings: turns.filter((turn) => turn.validationStatus !== "pass").length,
      injectionSignals, models,
      positiveFeedback: feedback.filter((item) => item.rating === "positive").length,
      negativeFeedback: feedback.filter((item) => item.rating === "negative").length,
    },
    turns, feedback,
    page: { limit, offset, hasMoreTurns: turns.length === limit, hasMoreFeedback: feedback.length === limit },
    retention: { turnsDays: 90, feedbackDays: 90, alertClaimsDays: 30, alertWindowMinutes: 15 },
  };
}
