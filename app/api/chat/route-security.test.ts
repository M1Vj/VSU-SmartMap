import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("chat route uses the bounded request parser and durable quota", () => {
  assert.match(routeSource, /parseChatRequest\(request\)/);
  assert.match(routeSource, /consumeDurableChatRateLimit\s*\(/);
  assert.match(routeSource, /getTrustedClientIp\(request\.headers\)/);
  assert.doesNotMatch(routeSource, /chatRateLimiter\.check/);
  assert.doesNotMatch(routeSource, /request\.json\(\)/);
});

test("chat route returns no-store validation and quota responses with retry timing", () => {
  assert.match(routeSource, /"Cache-Control":\s*"no-store"/);
  assert.match(routeSource, /"Retry-After":\s*String\(rateLimit\.retryAfterSeconds\)/);
  assert.match(routeSource, /error instanceof ChatRequestError/);
});

test("chat route traces every operational outcome and returns opaque feedback credentials", () => {
  assert.match(routeSource, /createChatTurnSession\s*\(/);
  for (const outcome of [
    "rate_limited",
    "cached",
    "generated_fallback",
    "static_fallback",
    "error",
  ]) {
    assert.match(routeSource, new RegExp(`finalizeTurn\\([^)]*[\\s\\S]{0,180}\"${outcome}\"`));
  }
  assert.match(routeSource, /finalizeTurn\(session, fallbackPayload, "validation_failed"/);
  assert.match(routeSource, /feedbackToken:\s*payload\.feedbackToken/);
  assert.match(routeSource, /turnId:\s*payload\.turnId/);
  assert.doesNotMatch(routeSource, /console\.error\([^)]*,\s*error\)/);
});

test("chat route gates caching and validates the completed stream before cards or persistence", () => {
  assert.match(routeSource, /CHAT_LLM_ENABLED/);
  assert.match(routeSource, /"disabled_fallback"/);
  assert.match(routeSource, /isChatAnswerCacheEligible\(message\)/);
  assert.match(routeSource, /sanitizeGeneratedLocationResponse\s*\(/);
  assert.match(routeSource, /grounding\.outcome\s*===\s*"fail"/);
  assert.match(routeSource, /notifyChatOpsAlert\s*\(/);
});

test("chat route withholds provider chunks and replaces hard validation failures", () => {
  const providerLoop = routeSource.match(
    /for await \(const chunk of stream\.stream\)([\s\S]+?)const response = await stream\.response/,
  )?.[1] ?? "";
  assert.ok(providerLoop.length > 0);
  assert.doesNotMatch(providerLoop, /send\s*\(/);
  const validationIndex = routeSource.indexOf("sanitizeGeneratedLocationResponse(");
  const validatedChunkIndex = routeSource.indexOf('send({ type: "chunk", content: payload.content })');
  assert.ok(validationIndex > 0 && validatedChunkIndex > validationIndex);
  assert.match(routeSource, /grounding\.outcome === "fail"[\s\S]{0,600}buildStaticFallbackPayload/);
  assert.match(routeSource, /class GroundingValidationError/);
  assert.match(routeSource, /fallbackError instanceof GroundingValidationError/);
  assert.match(routeSource, /enqueueGeneratedFinal\([\s\S]{0,220}request\.signal/);
});

test("withheld partial streams retry validated generation before static fallback", () => {
  assert.doesNotMatch(routeSource, /validationReasons:\s*\["partial_stream_discarded"\]/);
  assert.match(
    routeSource,
    /catch \(error\) \{[\s\S]{0,500}!request\.signal\.aborted[\s\S]{0,500}enqueueGeneratedFinal\(/,
  );
});
