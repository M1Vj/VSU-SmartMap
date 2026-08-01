import test from "node:test";
import assert from "node:assert/strict";

import {
  getChatQuestionHash,
  isChatAnswerCacheEligible,
  normalizeChatQuestion,
} from "./answer-cache.ts";

test("normalizeChatQuestion lowercases, trims, collapses spaces, and strips terminal punctuation", () => {
  assert.equal(
    normalizeChatQuestion("  Where   is the LIBRARY???  "),
    "where is the library"
  );
});

test("getChatQuestionHash produces stable hashes for equivalent questions", () => {
  assert.equal(
    getChatQuestionHash("Where is the library?"),
    getChatQuestionHash(" where   is THE library!!! ")
  );
});

test("getChatQuestionHash invalidates entries when release behavior changes", () => {
  assert.notEqual(
    getChatQuestionHash("Where is the library?", "release-a"),
    getChatQuestionHash("Where is the library?", "release-b")
  );
});

test("isChatAnswerCacheEligible rejects sensitive or control-bearing questions", () => {
  const unsafeQuestions = [
    "Email me at student@example.edu",
    "Call +63 917 123 4567",
    "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    "api_key=sk-live-1234567890abcdef",
    "client_secret: very-sensitive-value",
    "Where is the library?\u0000",
  ];

  for (const question of unsafeQuestions) {
    assert.equal(isChatAnswerCacheEligible(question), false, question);
  }
});

test("isChatAnswerCacheEligible accepts ordinary campus questions", () => {
  assert.equal(isChatAnswerCacheEligible("Where is the library?"), true);
});
