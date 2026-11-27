import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CHAT_MODEL_IDS,
  getChatModelIds,
  shouldTryNextChatModel,
} from "./gemini.ts";

const economicalLadder = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

test("chat defaults to a stable Flash-Lite ladder without Flash upgrades", () => {
  assert.deepEqual(DEFAULT_CHAT_MODEL_IDS, economicalLadder);
  assert.deepEqual(getChatModelIds({}), economicalLadder);
});

test("a configured ladder preserves approved order, deduplicates and never routes to retired aliases", () => {
  assert.deepEqual(getChatModelIds({
    GEMINI_MODEL_IDS: " gemini-3.8-flash, gemini-2.5-flash, models/gemini-3.5-flash-lite, gemini-3.5-flash, gemini-2.5-flash-lite, gemini-3.1-flash-lite-preview, gemini-3.8-flash ",
  }), ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
});

test("the previous example ladder keeps supported entries and maps 2.5 Flash to its documented Lite replacement", () => {
  assert.deepEqual(getChatModelIds({
    GEMINI_MODEL_IDS: "gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash",
  }), ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite"]);
});

test("higher-cost and legacy models are opt-in only; other IDs are not accepted", () => {
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_IDS: "models/gemini-3.6-flash" }), ["gemini-3.6-flash"]);
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_IDS: "gemini-2.5-flash-lite" }), ["gemini-2.5-flash-lite"]);
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_IDS: "gemini-3.5-flash, gemini-4-neon, gemini-3.8-live, gemini-3.8-flash-tts, gemini-flash-lite-latest" }), economicalLadder);
});

test("empty or invalid lists can use a supported legacy single-model setting plus economical defaults", () => {
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_IDS: "unknown", GEMINI_MODEL_ID: "models/gemini-3.8-flash" }), [
    "gemini-3.8-flash", ...economicalLadder,
  ]);
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_ID: "gemini-3.1-flash-lite-preview" }), economicalLadder);
});

test("model fallback is limited to model availability and capacity failures", () => {
  assert.equal(shouldTryNextChatModel({ status: 404, message: "model is not found" }), true);
  assert.equal(shouldTryNextChatModel({ message: "quota exceeded" }), true);
  assert.equal(shouldTryNextChatModel({ status: 503, message: "service unavailable" }), true);
  assert.equal(shouldTryNextChatModel({ status: 400, message: "Invalid request payload" }), false);
});
