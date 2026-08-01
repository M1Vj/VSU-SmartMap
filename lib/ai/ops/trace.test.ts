import assert from "node:assert/strict";
import test from "node:test";

import { createChatTurnSession } from "./trace.ts";
import type { ChatTurnInput } from "./types.ts";

test("chat turn session records a sanitized correlated turn exactly once", async () => {
  const rows: ChatTurnInput[] = [];
  let now = 1_000;
  const session = createChatTurnSession({
    conversationId: "00000000-0000-4000-8000-000000000001",
    requestId: "request-1",
    userMessage: "Where is the library?",
    injectionSignals: [],
    now: () => now,
    record: async (row) => {
      rows.push(row);
      return { stored: true, turnId: row.id };
    },
  });

  now = 1_125;
  session.markFirstToken();
  now = 1_500;
  await session.finalize({
    assistantMessage: "The library is on the map.",
    outcome: "live",
    selectedModel: "gemini-test",
    attemptCount: 2,
    validationStatus: "pass",
    validationReasons: [],
    retrievedRecordIds: ["facility-1"],
  });
  await session.finalize({ outcome: "error", validationStatus: "fail" });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].requestId, "request-1");
  assert.equal(rows[0].latencyMs, 500);
  assert.equal(rows[0].timeToFirstTokenMs, 125);
  assert.equal(rows[0].selectedModel, "gemini-test");
  assert.deepEqual(rows[0].retrievedRecordIds, ["facility-1"]);
  assert.match(session.identity.feedbackToken, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(session.identity.feedbackToken, rows[0].feedbackTokenHash);
});

test("chat turn session never lets persistence failure break the response path", async () => {
  const session = createChatTurnSession({
    userMessage: "hello",
    injectionSignals: ["role_spoofing"],
    record: async () => {
      throw new Error("database unavailable");
    },
  });

  await assert.doesNotReject(() =>
    session.finalize({ outcome: "static_fallback", validationStatus: "warn" }),
  );
});
