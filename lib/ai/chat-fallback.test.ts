import test from "node:test";
import assert from "node:assert/strict";

import { buildChatFallbackContent, shouldUseChatFallback } from "./chat-fallback.ts";

test("shouldUseChatFallback detects model and API availability failures", () => {
  assert.equal(shouldUseChatFallback("No API keys configured"), true);
  assert.equal(shouldUseChatFallback("404 model gemini-3.1-flash-lite is not found"), true);
  assert.equal(shouldUseChatFallback("ETIMEDOUT"), true);
  assert.equal(shouldUseChatFallback("Invalid request payload"), false);
});

test("buildChatFallbackContent returns a non-error assistant response", () => {
  const content = buildChatFallbackContent("Where is the library?");

  assert.match(content, /library/i);
  assert.match(content, /VSU/i);
  assert.doesNotMatch(content, /Sorry, I encountered an error/i);
});
