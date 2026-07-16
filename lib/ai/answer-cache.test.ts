import test from "node:test";
import assert from "node:assert/strict";

import { getChatQuestionHash, normalizeChatQuestion } from "./answer-cache.ts";

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
