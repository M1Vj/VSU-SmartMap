import assert from "node:assert/strict";
import test, { mock } from "node:test";

let executeCalls = 0;
let generationError: Error | null = null;
let finalizations: Array<Record<string, unknown>> = [];
let cacheWrites: Array<Record<string, unknown>> = [];
let cacheError: Error | null = null;

mock.module("@/lib/ai/flows/find-location", {
  namedExports: {
    async executeFindLocation() {
      executeCalls += 1;
      if (generationError) throw generationError;
      return {
        output: { response: "Verified campus answer", facilities: [] },
        operations: {
          generation: { selectedModel: "model-a", attemptCount: 1 },
          grounding: { outcome: "pass", reasonCodes: [], response: { response: "Verified campus answer", facilities: [] } },
          retrievedRecordIds: [],
        },
      };
    },
  },
});

mock.module("@/lib/ai/answer-cache", {
  namedExports: {
    async getCachedChatAnswer() { return null; },
    getChatQuestionHash() { return "question-hash"; },
    isChatAnswerCacheEligible() { return true; },
    async upsertCachedChatAnswer(hash: string, payload: Record<string, unknown>) {
      cacheWrites.push({ hash, payload });
      if (cacheError) throw cacheError;
    },
  },
});

mock.module("@/lib/ai/rate-limit", {
  namedExports: {
    async consumeDurableChatRateLimit() {
      return { allowed: true, message: "", retryAfterSeconds: 0 };
    },
  },
});

mock.module("@/lib/ai/ops/request", {
  namedExports: {
    ChatRequestError: class ChatRequestError extends Error {},
    getTrustedClientIp() { return "192.0.2.1"; },
    async parseChatRequest() {
      return {
        byteLength: 64,
        data: {
          message: "Where is DMath-LecR3?",
          streaming: true,
          conversationId: "conversation-id",
          history: [],
        },
      };
    },
  },
});

mock.module("@/lib/ai/ops/trace", {
  namedExports: {
    createChatTurnSession() {
      return {
        identity: {
          turnId: "turn-id",
          requestId: "request-id",
          feedbackToken: "feedback-token",
        },
        markFirstToken() {},
        async finalize(input: Record<string, unknown>) { finalizations.push(input); },
      };
    },
  },
});

mock.module("@/lib/ai/ops/alerts", {
  namedExports: { async notifyChatOpsAlert() { return { claimed: true }; } },
});

mock.module("@/lib/supabase/queries/facilities.server", {
  namedExports: { async getFacilitiesForChatCached() { return { data: [] }; } },
});

mock.module("@/lib/supabase/queries/facilities", {
  namedExports: { async getFacilitiesByIds() { return { data: [] }; } },
});

mock.module("@/lib/supabase/queries/boarding-houses.server", {
  namedExports: { async getBoardingHousesForChatCached() { return { data: [] }; } },
});

mock.module("@/lib/actions/events", {
  namedExports: { async getEventsCached() { return { data: [] }; } },
});

mock.module("@/lib/ai/genkit", {
  namedExports: { CHAT_MODEL_ID: "model-a" },
});

const routeModule = import("./route.ts");

function request() {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: "Where is DMath-LecR3?", streaming: true }),
  });
}

test.beforeEach(() => {
  process.env.CHAT_LLM_ENABLED = "true";
  executeCalls = 0;
  generationError = null;
  finalizations = [];
  cacheWrites = [];
  cacheError = null;
});

test("an uncached SSE request performs one generation, records live, and populates cache", async () => {
  const { POST } = await routeModule;
  const response = await POST(request());
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(executeCalls, 1);
  assert.match(body, /"type":"chunk","content":"Verified campus answer"/);
  assert.match(body, /"type":"final","content":"Verified campus answer"/);
  assert.match(body, /data: \[DONE\]/);
  assert.equal(finalizations.length, 1);
  assert.equal(finalizations[0]?.outcome, "live");
  assert.equal(finalizations[0]?.cacheState, "miss");
  assert.equal(cacheWrites.length, 1);
  assert.equal(cacheWrites[0]?.hash, "question-hash");
});

test("an SSE generation failure goes directly to static fallback without a retry", async () => {
  generationError = new Error("provider unavailable");
  const { POST } = await routeModule;
  const response = await POST(request());
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(executeCalls, 1);
  assert.match(body, /"type":"chunk"/);
  assert.match(body, /"type":"final"/);
  assert.equal(finalizations.length, 1);
  assert.equal(finalizations[0]?.outcome, "static_fallback");
  assert.equal(finalizations[0]?.errorClass, "provider_unavailable");
  assert.equal(cacheWrites.length, 0);
});

test("a cache persistence failure after delivery never emits a second final answer", async () => {
  cacheError = new Error("private cache persistence detail");
  const { POST } = await routeModule;
  const response = await POST(request());
  const body = await response.text();

  assert.equal(executeCalls, 1);
  assert.equal(body.match(/"type":"final"/g)?.length, 1);
  assert.match(body, /Verified campus answer/);
  assert.doesNotMatch(body, /I’m having trouble|I'm having trouble/);
});
