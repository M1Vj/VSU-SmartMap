import test from "node:test";
import assert from "node:assert/strict";

import { buildChatFallbackContent, getFallbackCampusNotice, shouldUseChatFallback } from "./chat-fallback.ts";

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

test("fallback distinguishes named VSU campuses from ordinary names", () => {
  for (const campus of ["Alangalang", "Isabel", "Tolosa", "Villaba"]) {
    assert.match(getFallbackCampusNotice(`Registrar at VSU-${campus}`) ?? "", /only.*Main Campus in Baybay/i);
  }
  assert.match(getFallbackCampusNotice("Registrar at Visayas State University Tolosa") ?? "", /only.*Main Campus in Baybay/i);
  for (const message of [
    "Where is the Registrar in VSU Visca?",
    "VSU Baybay or Main Campus Registrar",
    "Where is Isabel Hall?",
    "Where is VSU Tolosaville Hall?",
    "Where is VSU (Tolosaville) Hall?",
    "Where is VSU: Tolosaville Hall?",
  ]) {
    assert.equal(getFallbackCampusNotice(message), undefined, message);
  }
});
