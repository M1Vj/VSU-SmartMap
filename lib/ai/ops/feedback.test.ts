import assert from "node:assert/strict";
import test from "node:test";

import {
  FeedbackRequestError,
  maybeNotifyRepeatedNegativeFeedback,
  parseFeedbackRequest,
  submitChatFeedback,
} from "./feedback.ts";
import { sanitizeChatText } from "./sanitize.ts";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/chat/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("parses bounded valid feedback and enforces the negative reason taxonomy", async () => {
  const turnId = "00000000-0000-4000-8000-000000000001";
  const positive = await parseFeedbackRequest(request(JSON.stringify({
    turnId,
    feedbackToken: "a".repeat(43),
    rating: "positive",
    comment: " Helpful answer. ",
  })));
  assert.deepEqual(positive.data, {
    turnId,
    feedbackToken: "a".repeat(43),
    rating: "positive",
    comment: "Helpful answer.",
  });

  const negative = await parseFeedbackRequest(request(JSON.stringify({
    turnId,
    feedbackToken: "b".repeat(43),
    rating: "negative",
    reason: "wrong_location",
  })));
  assert.equal(negative.data.reason, "wrong_location");

  for (const payload of [
    { turnId, feedbackToken: "a".repeat(43), rating: "negative" },
    { turnId, feedbackToken: "a".repeat(43), rating: "positive", reason: "incorrect" },
    { turnId, feedbackToken: "a".repeat(43), rating: "negative", reason: "invented" },
    { turnId, feedbackToken: "a".repeat(43), rating: "positive", comment: "bad\u0000text" },
  ]) {
    await assert.rejects(parseFeedbackRequest(request(JSON.stringify(payload))), FeedbackRequestError);
  }
});

test("enforces JSON content type and the actual 4 KiB streamed body cap", async () => {
  await assert.rejects(
    parseFeedbackRequest(request("{}", { "content-type": "text/plain" })),
    (error: unknown) => error instanceof FeedbackRequestError && error.status === 415,
  );
  await assert.rejects(
    parseFeedbackRequest(request(`{"padding":"${"x".repeat(5 * 1024)}"}`, { "content-length": "1" })),
    (error: unknown) => error instanceof FeedbackRequestError && error.status === 413,
  );
});

test("verifies the turn-owned token hash, sanitizes comments, and upserts by turn_id", async () => {
  const calls: Array<{ table: string; operation: string; value: unknown }> = [];
  const token = "valid-opaque-feedback-token-1234567890";
  const comment = "Class IT 203 was wrong; email me at student@example.com.";
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  const { hashFeedbackToken } = await import("./sanitize.ts");
                  return {
                    data: { feedback_token_hash: hashFeedbackToken(token), release_id: "release-1" },
                    error: null,
                  };
                },
              };
            },
          };
        },
        async upsert(value: unknown, options: unknown) {
          calls.push({ table, operation: "upsert", value: { value, options } });
          return { error: null };
        },
      };
    },
  };

  const result = await submitChatFeedback({
    turnId: "00000000-0000-4000-8000-000000000001",
    feedbackToken: token,
    rating: "negative",
    reason: "incorrect",
    comment,
  }, client as never);

  assert.equal(result, "accepted");
  assert.deepEqual(calls, [{
    table: "ai_chat_feedback",
    operation: "upsert",
    value: {
      value: {
        turn_id: "00000000-0000-4000-8000-000000000001",
        rating: "negative",
        reason: "incorrect",
        comment: sanitizeChatText(comment, 1000),
      },
      options: { onConflict: "turn_id" },
    },
  }]);
  const stored = ((calls[0]?.value as { value: { comment: string } }).value).comment;
  assert.match(stored, /Class IT 203 was wrong/);
  assert.equal(stored.includes("student@example.com"), false);
});

test("alerts only at three recent negatives for the exact release and reason without secrets", async () => {
  for (const count of [2, 3]) {
    const calls: Array<Record<string, unknown>> = [];
    const notifications: Array<Record<string, unknown>> = [];
    const client = {
      from(table: string) {
        assert.equal(table, "ai_chat_feedback");
        return {
          select() {
            return {
              eq(column: string, value: string) {
                calls.push({ kind: "eq", column, value });
                return this;
              },
              gte(column: string, value: string) {
                calls.push({ kind: "gte", column, value });
                return this;
              },
              async limit(value: number) {
                calls.push({ kind: "limit", value });
                return { count, error: null };
              },
            };
          },
        };
      },
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ kind: "rpc", name, args });
        return { data: true, error: null };
      },
    };

    await maybeNotifyRepeatedNegativeFeedback({
      releaseId: "release-1",
      reason: "incorrect",
      occurredAt: new Date("2026-08-01T04:15:00.000Z"),
    }, client as never, async (input) => { notifications.push(input); });

    const serialized = JSON.stringify({ calls, notifications });
    assert.equal(calls.some((call) => call.kind === "gte" && call.column === "updated_at"), true);
    assert.equal(serialized.includes("student@example.com"), false);
    assert.equal(serialized.includes("private-feedback-token"), false);
    assert.equal(serialized.includes("turn transcript"), false);
    if (count === 2) {
      assert.equal(calls.some((call) => call.kind === "rpc"), false);
      assert.equal(notifications.length, 0);
    } else {
      const rpc = calls.find((call) => call.kind === "rpc");
      assert.equal(rpc?.name, "claim_ai_chat_alert");
      assert.equal(notifications.length, 1);
      assert.deepEqual(notifications[0]?.metadata, {
        category: "repeated_negative_feedback",
        releaseId: "release-1",
        reason: "incorrect",
        negativeFeedbackCount: 3,
      });
    }
  }
});

test("does not write and returns the same forbidden result for missing turns and bad tokens", async () => {
  for (const row of [null, { feedback_token_hash: "f".repeat(64) }]) {
    let writes = 0;
    const client = {
      from() {
        return {
          select() {
            return { eq() { return { async maybeSingle() { return { data: row, error: null }; } }; } };
          },
          async upsert() { writes += 1; return { error: null }; },
        };
      },
    };
    const result = await submitChatFeedback({
      turnId: "00000000-0000-4000-8000-000000000001",
      feedbackToken: "wrong-opaque-feedback-token-123456789",
      rating: "positive",
    }, client as never);
    assert.equal(result, "forbidden");
    assert.equal(writes, 0);
  }
});
