import assert from "node:assert/strict";
import test from "node:test";

import { createTurnIdentity, recordChatTurn } from "./server.ts";

function createInsertClient({ fail = false }: { fail?: boolean } = {}) {
  const rows: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "ai_chat_turns");
      return {
        insert(row: Record<string, unknown>) {
          rows.push(row);
          return {
            select(selection: string) {
              assert.equal(selection, "id");
              return {
                async single() {
                  return fail
                    ? { data: null, error: { message: "database unavailable" } }
                    : { data: { id: row.id }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, rows };
}

test("createTurnIdentity preserves valid correlation and creates an opaque feedback credential", () => {
  const identity = createTurnIdentity({
    conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
    requestId: "iad1::request-123",
  });

  assert.equal(identity.conversationId, "a285a87d-15a2-4b4d-8685-817eb1495a8a");
  assert.equal(identity.requestId, "iad1::request-123");
  assert.match(identity.turnId, /^[0-9a-f-]{36}$/);
  assert.match(identity.feedbackToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(identity.feedbackTokenHash, /^[a-f0-9]{64}$/);
});

test("createTurnIdentity replaces malformed client correlation values", () => {
  const identity = createTurnIdentity({
    conversationId: "not-a-uuid",
    requestId: "bad request id with spaces and a secret=abc",
  });

  assert.match(identity.conversationId, /^[0-9a-f-]{36}$/);
  assert.match(identity.requestId, /^[0-9a-f-]{36}$/);
});

test("recordChatTurn writes one sanitized bounded operational row", async () => {
  const { client, rows } = createInsertClient();
  const result = await recordChatTurn(
    {
      id: "f9947aac-6745-4b0c-a5ea-07460964de17",
      conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
      requestId: "iad1::request-123",
      releaseId: "release-abc",
      feedbackTokenHash: "a".repeat(64),
      userMessage: "CS 101 student@example.com",
      assistantMessage: "Room schedule: 8 AM. Bearer unsafe-value",
      outcome: "live",
      requestedModel: "gemini-primary",
      selectedModel: "gemini-fallback",
      promptVersion: "campus-assistant-v3",
      attemptCount: 2,
      latencyMs: 1_250,
      timeToFirstTokenMs: 320,
      inputTokens: 400,
      outputTokens: 120,
      cacheState: "miss",
      retrievedRecordIds: ["facility:one", "facility:one", "event:two"],
      validationStatus: "warn",
      validationReasons: ["invalid_facility_reference", "invalid_facility_reference"],
      injectionSignals: ["direct_override", "direct_override"],
      metadata: { retrievalCounts: { facilities: 2 }, apiToken: "secret" },
    },
    client as never,
  );

  assert.deepEqual(result, {
    stored: true,
    turnId: "f9947aac-6745-4b0c-a5ea-07460964de17",
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: "f9947aac-6745-4b0c-a5ea-07460964de17",
    conversation_id: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
    request_id: "iad1::request-123",
    release_id: "release-abc",
    feedback_token_hash: "a".repeat(64),
    user_message: "CS 101 [REDACTED EMAIL]",
    assistant_message: "Room schedule: 8 AM. Bearer [REDACTED]",
    outcome: "live",
    requested_model: "gemini-primary",
    selected_model: "gemini-fallback",
    prompt_version: "campus-assistant-v3",
    attempt_count: 2,
    latency_ms: 1250,
    time_to_first_token_ms: 320,
    input_tokens: 400,
    output_tokens: 120,
    cache_state: "miss",
    retrieved_record_ids: ["facility:one", "event:two"],
    validation_status: "warn",
    validation_reasons: ["invalid_facility_reference"],
    injection_signals: ["direct_override"],
    error_class: null,
    metadata: { retrievalCounts: { facilities: 2 }, apiToken: "[REDACTED]" },
  });
});

test("recordChatTurn isolates persistence failures from the student response", async (t) => {
  const errorLog = t.mock.method(console, "error", () => {});
  const { client } = createInsertClient({ fail: true });
  const result = await recordChatTurn(
    {
      id: "f9947aac-6745-4b0c-a5ea-07460964de17",
      conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
      requestId: "iad1::request-123",
      releaseId: "release-abc",
      feedbackTokenHash: "a".repeat(64),
      userMessage: "Where is the library?",
      outcome: "error",
      attemptCount: 0,
      retrievedRecordIds: [],
      validationStatus: "fail",
      validationReasons: ["provider_error"],
      injectionSignals: [],
      metadata: {},
    },
    client as never,
  );

  assert.deepEqual(result, {
    stored: false,
    turnId: "f9947aac-6745-4b0c-a5ea-07460964de17",
  });
  assert.equal(errorLog.mock.callCount(), 1);
});
