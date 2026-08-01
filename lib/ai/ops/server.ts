import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createFeedbackCredential, sanitizeChatText, sanitizeTurnMetadata } from "./sanitize";
import type { ChatTurnIdentity, ChatTurnInput } from "./types";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

function uniqueBounded(values: readonly string[], maximumItems: number, maximumLength: number) {
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeChatText(value, maximumLength).trim())
        .filter(Boolean),
    ),
  ).slice(0, maximumItems);
}

function boundedInteger(value: number | undefined, maximum: number): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export function createTurnIdentity({
  conversationId,
  requestId,
}: {
  conversationId?: string;
  requestId?: string | null;
}): ChatTurnIdentity {
  const feedback = createFeedbackCredential();
  return {
    turnId: randomUUID(),
    conversationId:
      conversationId && UUID_PATTERN.test(conversationId) ? conversationId : randomUUID(),
    requestId: requestId && REQUEST_ID_PATTERN.test(requestId) ? requestId : randomUUID(),
    feedbackToken: feedback.token,
    feedbackTokenHash: feedback.hash,
  };
}

export async function recordChatTurn(
  input: ChatTurnInput,
  client: SupabaseClient = getSupabaseServiceRoleClient(),
): Promise<{ stored: boolean; turnId: string }> {
  const row = {
    id: input.id,
    conversation_id: input.conversationId,
    request_id: sanitizeChatText(input.requestId, 200),
    release_id: sanitizeChatText(input.releaseId, 200),
    feedback_token_hash: sanitizeChatText(input.feedbackTokenHash, 128),
    user_message: sanitizeChatText(input.userMessage, 8_000),
    assistant_message: input.assistantMessage
      ? sanitizeChatText(input.assistantMessage, 16_000)
      : null,
    outcome: input.outcome,
    requested_model: input.requestedModel
      ? sanitizeChatText(input.requestedModel, 200)
      : null,
    selected_model: input.selectedModel
      ? sanitizeChatText(input.selectedModel, 200)
      : null,
    prompt_version: input.promptVersion
      ? sanitizeChatText(input.promptVersion, 120)
      : null,
    attempt_count: boundedInteger(input.attemptCount, 10) ?? 0,
    latency_ms: boundedInteger(input.latencyMs, 600_000),
    time_to_first_token_ms: boundedInteger(input.timeToFirstTokenMs, 600_000),
    input_tokens: boundedInteger(input.inputTokens, 1_000_000),
    output_tokens: boundedInteger(input.outputTokens, 1_000_000),
    cache_state: input.cacheState ? sanitizeChatText(input.cacheState, 80) : null,
    retrieved_record_ids: uniqueBounded(input.retrievedRecordIds, 100, 200),
    validation_status: input.validationStatus,
    validation_reasons: uniqueBounded(input.validationReasons, 20, 120),
    injection_signals: uniqueBounded(input.injectionSignals, 20, 120),
    error_class: input.errorClass ? sanitizeChatText(input.errorClass, 120) : null,
    metadata: sanitizeTurnMetadata(input.metadata),
  };

  try {
    const { error } = await client
      .from("ai_chat_turns")
      .insert(row)
      .select("id")
      .single<{ id: string }>();

    if (error) {
      console.error("[chat-ops] turn persistence failed");
      return { stored: false, turnId: input.id };
    }
    return { stored: true, turnId: input.id };
  } catch {
    console.error("[chat-ops] turn persistence failed");
    return { stored: false, turnId: input.id };
  }
}

