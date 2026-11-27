import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";

import { apiKeyManager } from "@/lib/ai/api-key-manager";

const partial = "An unfinished SDK answer";
const fallback = /live AI is temporarily unavailable/i;
const finishReasons = ["CONTINUATION", "MAX_TOKENS"] as const;
const finalized: Array<{ outcome: string; errorClass?: string; assistantMessage?: string }> = [];
const alerts: Array<{ outcome: string; errorClass?: string }> = [];
let cacheWrites = 0;

mock.module("@/lib/ai/answer-cache", {
  namedExports: {
    async getCachedChatAnswer() { return null; },
    getChatQuestionHash() { return "synthetic-hash"; },
    isChatAnswerCacheEligible() { return true; },
    async upsertCachedChatAnswer() { cacheWrites += 1; },
  },
});
mock.module("@/lib/ai/rate-limit", {
  namedExports: {
    async consumeDurableChatRateLimit() {
      return { allowed: true, message: "", retryAfterSeconds: 0 };
    },
  },
});
mock.module("@/lib/ai/ops/trace", {
  namedExports: {
    createChatTurnSession() {
      return {
        identity: { turnId: "synthetic-turn", feedbackToken: "synthetic-feedback", requestId: "synthetic-request" },
        markFirstToken() {},
        async finalize(input: typeof finalized[number]) { finalized.push(input); },
      };
    },
  },
});
mock.module("@/lib/ai/ops/alerts", {
  namedExports: { async notifyChatOpsAlert(input: typeof alerts[number]) { alerts.push(input); } },
});
for (const [path, exportName] of [
  ["@/lib/supabase/queries/facilities.server", "getFacilitiesForChatCached"],
  ["@/lib/supabase/queries/facilities", "getFacilitiesByIds"],
  ["@/lib/supabase/queries/ai-knowledge.server", "getAiKnowledgeForChatCached"],
  ["@/lib/supabase/queries/boarding-houses.server", "getBoardingHousesForChatCached"],
  ["@/lib/actions/events", "getEventsCached"],
]) {
  mock.module(path, { namedExports: { [exportName]: async () => ({ data: [] }) } });
}
const route = import("./route.ts");

function fixture(t: TestContext, respond: () => Response) {
  finalized.length = 0;
  alerts.length = 0;
  cacheWrites = 0;
  const previous = process.env.CHAT_LLM_ENABLED;
  process.env.CHAT_LLM_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.CHAT_LLM_ENABLED;
    else process.env.CHAT_LLM_ENABLED = previous;
  });
  t.mock.method(apiKeyManager, "getNextKey", () => "synthetic-incomplete-fixture");
  return t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://generativelanguage.googleapis.com");
    return respond();
  });
}

function request(streaming: boolean) {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Find the library", streaming }),
  });
}

for (const finishReason of finishReasons) {
  for (const streaming of [false, true]) {
    test(`${finishReason} sends only uncached static fallback in ${streaming ? "SSE" : "JSON"} mode`, async t => {
      const transport = fixture(t, () => Response.json({
        candidates: [{
          finishReason,
          ...(finishReason === "CONTINUATION" ? { continuationToken: "c3ludGhldGlj" } : {}),
          content: { role: "model", parts: [{ text: JSON.stringify({ response: partial, facilities: [] }) }] },
        }],
      }));

      const { POST } = await route;
      const response = await POST(request(streaming));
      const body = await response.text();
      assert.equal(response.status, 200);
      if (streaming) {
        assert.equal(response.headers.get("content-type"), "text/event-stream");
        assert.equal(body.match(/"type":"final"/g)?.length, 1);
        assert.match(body, /data: \[DONE\]/);
      } else {
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      assert.match(body, fallback);
      assert.ok(!body.includes(partial));
      assert.equal(transport.mock.callCount(), 1);
      assert.equal(cacheWrites, 0);
      assert.equal(finalized.length, 1);
      assert.equal(finalized[0].outcome, "static_fallback");
      assert.equal(finalized[0].errorClass, "provider_incomplete");
      assert.match(finalized[0].assistantMessage ?? "", fallback);
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].errorClass, "provider_incomplete");
    });
  }
}

test("an unrelated terminal provider error keeps the existing JSON error status", async t => {
  const transport = fixture(t, () => { throw new Error("Synthetic terminal failure"); });
  const { POST } = await route;
  const response = await POST(request(false));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await response.text(), fallback);
  assert.equal(transport.mock.callCount(), 1);
  assert.equal(cacheWrites, 0);
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].outcome, "error");
  assert.equal(finalized[0].errorClass, "provider_error");
});
