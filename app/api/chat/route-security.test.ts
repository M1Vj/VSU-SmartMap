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
    "live",
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

test("chat route gates caching and validates the completed generation before cards or persistence", () => {
  assert.match(routeSource, /CHAT_LLM_ENABLED/);
  assert.match(routeSource, /"disabled_fallback"/);
  assert.match(routeSource, /isChatAnswerCacheEligible\(message\)/);
  assert.match(routeSource, /generatedPayload\.operations\?\.grounding\.outcome\s*===\s*"fail"/);
  assert.match(routeSource, /notifyChatOpsAlert\s*\(/);
});

test("SSE uses one completed generation and caches the same validated live payload", () => {
  assert.doesNotMatch(routeSource, /streamFindLocation|stream\.stream|stream\.response/);
  assert.doesNotMatch(routeSource, /generated_fallback/);
  assert.match(routeSource, /if \(streaming\) \{[\s\S]{0,500}buildFinalChatPayload\(message, context, request\.signal\)/);
  assert.match(routeSource, /enqueueSse\(controller, \{ type: "chunk", content: payload\.content \}\)/);
  assert.match(routeSource, /finalizeTurn\(session, payload, "live", \{ cacheState: "miss" \}\)/);
  assert.match(routeSource, /cacheSuccessfulFinalPayload\(questionHash, message, payload\)/);
  assert.match(routeSource, /class GroundingValidationError/);
  assert.match(routeSource, /error instanceof GroundingValidationError/);
});

test("SSE failure goes directly to a classified static fallback without retry generation", () => {
  assert.match(
    routeSource,
    /catch \(error\) \{[\s\S]{0,260}request\.signal\.aborted[\s\S]{0,500}buildStaticFallbackPayload/,
  );
  assert.match(routeSource, /classifyChatError\(error\)/);
  assert.doesNotMatch(routeSource, /enqueueGeneratedFinal/);
});
