import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAT_MODEL_IDS,
  DEFAULT_CHAT_MODEL_IDS,
  getChatModelIds,
  runWithKeyRotation,
  shouldTryNextChatModel,
} from "./gemini.ts";
import { apiKeyManager } from "./api-key-manager.ts";

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
  assert.equal(shouldTryNextChatModel({ status: 503, message: "service unavailable" }), true);
  assert.equal(shouldTryNextChatModel({ status: 400, message: "Invalid request payload" }), false);
  assert.equal(shouldTryNextChatModel({ message: "quota exceeded" }), false);
  assert.equal(shouldTryNextChatModel({ status: 429 }), false);
  assert.equal(shouldTryNextChatModel({ status: 401, message: "model credentials invalid" }), false);
  assert.equal(shouldTryNextChatModel({ response: { status: 403 }, message: "model permission denied" }), false);
});

test("no eligible credential ends the request before generation", async (t) => {
  const failure = new Error("All API keys are currently rate limited. Please try again later.");
  const credential = t.mock.method(apiKeyManager, "getNextKey", () => { throw failure; });
  await assert.rejects(runWithKeyRotation(async () => assert.fail("unexpected provider attempt")), (error) => error === failure);
  assert.equal(credential.mock.callCount(), 1);
});

test("the request-wide budget stops before a seventh eligible model call", async (t) => {
  const models = Array.from({ length: 7 }, (_, index) => `fixture-model-${index + 1}`);
  const original = CHAT_MODEL_IDS.splice(0, CHAT_MODEL_IDS.length, ...models);
  t.after(() => { CHAT_MODEL_IDS.splice(0, CHAT_MODEL_IDS.length, ...original); });
  const credential = t.mock.method(apiKeyManager, "getNextKey", () => "inert-fixture");
  const calls: string[] = [];
  await assert.rejects(runWithKeyRotation(async (_sdk, model) => {
    calls.push(model);
    throw { status: 503 };
  }), { name: "ChatAttemptBudgetError" });
  assert.deepEqual(calls, models.slice(0, 6));
  assert.equal(credential.mock.callCount(), 6);
});
