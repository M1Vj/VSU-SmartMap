export const CHAT_OUTCOMES = [
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
] as const;

export type ChatOutcome = (typeof CHAT_OUTCOMES)[number];
export type ChatValidationStatus = "pass" | "warn" | "fail";

export type ChatTurnInput = {
  id: string;
  conversationId: string;
  requestId: string;
  releaseId: string;
  feedbackTokenHash: string;
  userMessage: string;
  assistantMessage?: string;
  outcome: ChatOutcome;
  requestedModel?: string;
  selectedModel?: string;
  promptVersion?: string;
  attemptCount: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheState?: string;
  retrievedRecordIds: string[];
  validationStatus: ChatValidationStatus;
  validationReasons: string[];
  injectionSignals: string[];
  errorClass?: string;
  metadata: Record<string, unknown>;
};

export type ChatTurnIdentity = {
  turnId: string;
  conversationId: string;
  requestId: string;
  feedbackToken: string;
  feedbackTokenHash: string;
};

