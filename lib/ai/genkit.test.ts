import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAT_MODEL_ID,
  CHAT_MODEL_IDS,
  DEFAULT_CHAT_MODEL_IDS,
  getChatModelIds,
  shouldTryNextChatModel,
} from "./genkit.ts";

test("chat defaults to the best Gemini model with stable fallbacks", () => {
  assert.deepEqual(CHAT_MODEL_IDS, [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ]);
  assert.equal(CHAT_MODEL_ID, "gemini-3.1-flash-lite");
  assert.equal((DEFAULT_CHAT_MODEL_IDS as readonly string[]).includes("gemini-3.1-flash-lite-preview"), false);
  assert.equal((DEFAULT_CHAT_MODEL_IDS as readonly string[]).some((modelId) => modelId.includes("preview")), false);
});

test("chat model ids can be overridden with a comma-separated env value", () => {
  assert.deepEqual(
    getChatModelIds({
      GEMINI_MODEL_IDS: "gemini-3.5-flash, gemini-3.1-flash-lite-preview, gemini-3.1-flash-lite, gemini-3.5-flash",
    }),
    ["gemini-3.5-flash", "gemini-3.1-flash-lite"],
  );
});

test("deprecated single-model env values fall back to the default model ladder", () => {
  assert.deepEqual(getChatModelIds({ GEMINI_MODEL_ID: "gemini-3.1-flash-lite-preview" }), [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ]);
});

test("model fallback is limited to model availability and capacity failures", () => {
  assert.equal(shouldTryNextChatModel({ status: 404, message: "model is not found" }), true);
  assert.equal(shouldTryNextChatModel({ message: "quota exceeded" }), true);
  assert.equal(shouldTryNextChatModel({ status: 503, message: "service unavailable" }), true);
  assert.equal(shouldTryNextChatModel({ status: 400, message: "Invalid request payload" }), false);
});
