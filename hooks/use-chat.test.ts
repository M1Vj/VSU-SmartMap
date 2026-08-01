import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatRequestBody,
  getOrCreateConversationId,
  readFeedbackCredentials,
} from "./use-chat.ts";

test("getOrCreateConversationId persists and reuses a stable UUID", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const generated = "a285a87d-15a2-4b4d-8685-817eb1495a8a";

  assert.equal(getOrCreateConversationId(storage, () => generated), generated);
  assert.equal(getOrCreateConversationId(storage, () => "should-not-run"), generated);
});

test("buildChatRequestBody includes the stable conversation ID", () => {
  assert.deepEqual(
    buildChatRequestBody({
      message: "Where is the library?",
      history: [],
      summary: undefined,
      streaming: true,
      conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
    }),
    {
      message: "Where is the library?",
      history: [],
      summary: undefined,
      streaming: true,
      conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
    },
  );
});

test("readFeedbackCredentials accepts only complete string credentials", () => {
  assert.deepEqual(
    readFeedbackCredentials({
      turnId: "turn-1",
      feedbackToken: "token-1",
      requestId: "request-1",
    }),
    { turnId: "turn-1", feedbackToken: "token-1", requestId: "request-1" },
  );
  assert.equal(readFeedbackCredentials({ turnId: "turn-1" }), undefined);
});
