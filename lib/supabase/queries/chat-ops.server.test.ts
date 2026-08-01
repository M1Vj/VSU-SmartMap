import assert from "node:assert/strict";
import test from "node:test";

import {
  getChatOpsDashboard,
  parseChatOpsFilters,
  serializeChatOpsCsv,
} from "./chat-ops.server.ts";

test("parseChatOpsFilters allowlists filters and defaults to a 24 hour window", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  assert.deepEqual(parseChatOpsFilters({
    outcome: "error",
    model: "gemini-3.5-flash",
    validation: "warn",
    reviewStatus: "reviewing",
    windowHours: "999",
  }, now), {
    outcome: "error",
    model: "gemini-3.5-flash",
    validation: "warn",
    reviewStatus: "reviewing",
    windowHours: 24,
    since: "2026-07-31T12:00:00.000Z",
  });
  assert.deepEqual(parseChatOpsFilters({ outcome: "invented", model: "bad model!" }, now), {
    windowHours: 24,
    since: "2026-07-31T12:00:00.000Z",
  });
});

test("serializeChatOpsCsv neutralizes formulas and excludes restricted fields", () => {
  const csv = serializeChatOpsCsv([{
    id: "turn-1", createdAt: "2026-08-01T01:00:00.000Z", releaseId: "ai_release",
    requestId: "=HYPERLINK(\"bad\")", userMessage: "+SUM(1,1)", assistantMessage: "safe",
    outcome: "error", requestedModel: "model-a", selectedModel: null, latencyMs: 400,
    timeToFirstTokenMs: null, cacheState: "miss", retrievedRecordIds: ["facility-1"],
    grounded: true, validationStatus: "fail", validationReasons: ["unsupported"],
    injectionSignals: [], errorClass: "provider", reviewStatus: "unreviewed",
  }]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+SUM/);
  assert.doesNotMatch(csv, /feedback_token_hash|metadata|input_tokens/i);
});

test("getChatOpsDashboard uses bounded whitelisted queries and sanitizes excerpts", async () => {
  const calls: Array<{ table: string; selection?: string; range?: [number, number]; gte?: string }> = [];
  const client = {
    from(table: string) {
      const call = { table } as (typeof calls)[number];
      calls.push(call);
      const builder = {
        select(selection: string) {
          call.selection = selection;
          return builder;
        },
        order() {
          return builder;
        },
        gte(_column: string, value: string) {
          call.gte = value;
          return builder;
        },
        eq() { return builder; },
        range(from: number, to: number) {
          call.range = [from, to];
          return Promise.resolve({
            data: table === "ai_chat_turns" ? [{
              id: "turn-1",
              created_at: "2026-08-01T01:00:00.000Z",
              release_id: "ai_release",
              request_id: "request-1",
              user_message: "Email student@example.edu or call +63 917 123 4567",
              assistant_message: "Bearer secret-token-value",
              outcome: "live",
              requested_model: "model-a",
              selected_model: "model-b",
              latency_ms: 240,
              time_to_first_token_ms: 80,
              cache_state: "miss",
              retrieved_record_ids: ["facility-1"],
              validation_status: "pass",
              validation_reasons: [],
              injection_signals: ["direct_override"],
              error_class: null,
              review_status: "unreviewed",
            }] : [{
              id: "feedback-1",
              turn_id: "turn-1",
              rating: "negative",
              reason: "incorrect",
              comment: "My email is student@example.edu",
              review_status: "unreviewed",
              created_at: "2026-08-01T01:01:00.000Z",
            }],
            error: null,
          });
        },
      };
      return builder;
    },
  };

  const result = await getChatOpsDashboard(client as never, { limit: 500, offset: -3 });

  assert.deepEqual(calls.map(({ table, range }) => ({ table, range })), [
    { table: "ai_chat_turns", range: [0, 99] },
    { table: "ai_chat_feedback", range: [0, 99] },
  ]);
  for (const call of calls) {
    assert.doesNotMatch(call.selection ?? "", /feedback_token_hash|metadata|input_tokens|output_tokens/);
  }
  assert.equal(result.turns[0]?.userMessage, "Email [email] or call [phone]");
  assert.equal(result.turns[0]?.assistantMessage, "[credential]");
  assert.equal(result.feedback[0]?.comment, "My email is [email]");
  assert.deepEqual(result.summary.outcomes, { live: 1 });
  assert.equal(result.summary.latencyP50Ms, 240);
  assert.equal(result.summary.latencyP95Ms, 240);
  assert.equal(result.summary.negativeFeedbackRate, 1);
  assert.equal(result.summary.groundedTurns, 1);
  assert.deepEqual(result.summary.injectionSignals, { direct_override: 1 });
});

test("getChatOpsDashboard returns an empty read model when queries fail", async () => {
  const client = {
    from() {
      const builder = {
        select() { return builder; },
        order() { return builder; },
        gte() { return builder; },
        eq() { return builder; },
        range() { return Promise.resolve({ data: null, error: { message: "private detail" } }); },
      };
      return builder;
    },
  };

  const result = await getChatOpsDashboard(client as never);
  assert.equal(result.turns.length, 0);
  assert.equal(result.feedback.length, 0);
  assert.equal(result.summary.totalTurns, 0);
});
