import test from "node:test";
import assert from "node:assert/strict";

import { prepareChatContextPayload, prepareHistoryForContext } from "./history.ts";
import type { ChatMessage } from "@/lib/types/chat.ts";

function makeMessage(
  index: number,
  role: ChatMessage["role"],
  content = `${role} message ${index}`
): ChatMessage {
  return {
    id: `msg-${index}`,
    role,
    content,
    timestamp: new Date("2026-06-21T00:00:00.000Z"),
  };
}

test("prepareHistoryForContext excludes empty and error messages before slicing", () => {
  const messages: ChatMessage[] = [
    makeMessage(1, "user", "Where is the library?"),
    { ...makeMessage(2, "assistant", "Network error"), isError: true },
    makeMessage(3, "assistant", "The library is shown as a card."),
    makeMessage(4, "user", "   "),
  ];

  assert.deepEqual(prepareHistoryForContext(messages), [
    { role: "user", content: "Where is the library?" },
    { role: "assistant", content: "The library is shown as a card." },
  ]);
});

test("prepareChatContextPayload summarizes older turns and keeps recent history compact", () => {
  const messages = Array.from({ length: 9 }, (_, index) =>
    makeMessage(index, index % 2 === 0 ? "user" : "assistant")
  );

  const payload = prepareChatContextPayload(messages);

  assert.equal(payload.history.length, 6);
  assert.equal(payload.history[0].content, "assistant message 3");
  assert.match(payload.summary ?? "", /User asked: user message 0/);
  assert.match(payload.summary ?? "", /Assistant answered: assistant message 1/);
});
