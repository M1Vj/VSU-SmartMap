import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { apiKeyManager } from "@/lib/ai/api-key-manager";
import { runWithKeyRotation } from "@/lib/ai/gemini";
import { validateGroundedLocationResponse } from "@/lib/ai/ops/grounding";

let executeCalls = 0;
let generationError: Error | null = null;
let generationFailure: (() => Promise<never>) | undefined;
let generatedContent = "Verified campus answer";
let finalizations: Array<Record<string, unknown>> = [];
let cacheWrites: Array<Record<string, unknown>> = [];
let cacheError: Error | null = null;
const registrar = { id: "baybay-registrar", name: "Registrar", category: "office" };
let fallbackFacilities: Array<typeof registrar> = [];
let facilityContextReads = 0;
let facilityCardReads = 0;

mock.module("@/lib/ai/flows/find-location", {
  namedExports: {
    async executeFindLocation() {
      executeCalls += 1;
      if (generationFailure) return generationFailure();
      if (generationError) throw generationError;
      const grounding = validateGroundedLocationResponse({ response: generatedContent, facilities: [] }, { facilities: [], events: [], boardingHouses: [] });
      return {
        output: grounding.response,
        operations: {
          generation: { selectedModel: "model-a", attemptCount: 1 },
          grounding,
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
    async parseChatRequest(request: Request) {
      const { message, streaming } = await request.json();
      return {
        byteLength: 64,
        data: {
          message,
          streaming,
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
  namedExports: {
    async getFacilitiesForChatCached() {
      facilityContextReads += 1;
      return { data: fallbackFacilities };
    },
  },
});

mock.module("@/lib/supabase/queries/facilities", {
  namedExports: {
    async getFacilitiesByIds({ ids }: { ids: string[] }) {
      facilityCardReads += 1;
      return { data: fallbackFacilities.filter(({ id }) => ids.includes(id)) };
    },
  },
});

mock.module("@/lib/supabase/queries/boarding-houses.server", {
  namedExports: { async getBoardingHousesForChatCached() { return { data: [] }; } },
});

mock.module("@/lib/actions/events", {
  namedExports: { async getEventsCached() { return { data: [] }; } },
});

const routeModule = import("./route.ts");

function request(message = "Where is DMath-LecR3?", streaming = true) {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, streaming }),
  });
}

test.beforeEach(() => {
  process.env.CHAT_LLM_ENABLED = "true";
  executeCalls = 0;
  generationError = null;
  generationFailure = undefined;
  generatedContent = "Verified campus answer";
  finalizations = [];
  cacheWrites = [];
  cacheError = null;
  fallbackFacilities = [];
  facilityContextReads = 0;
  facilityCardReads = 0;
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

for (const streaming of [false, true]) {
  test(`a message-less provider 429 returns uncached local help (${streaming ? "SSE" : "JSON"})`, async (t) => {
    let providerAttempts = 0;
    t.mock.method(apiKeyManager, "getNextKey", () => "inert-route-fixture");
    generationFailure = () => runWithKeyRotation(async () => {
      providerAttempts += 1;
      throw { status: 429 };
    });
    fallbackFacilities = [registrar];
    const { POST } = await routeModule;
    const response = await POST(request("Where is the Registrar at VSU Baybay?", streaming));
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", streaming ? /text\/event-stream/ : /application\/json/);
    assert.match(response.headers.get("cache-control") ?? "", streaming ? /no-cache/ : /no-store/);
    assert.match(body, /I can still help/);
    assert.match(body, /baybay-registrar/);
    if (streaming) assert.match(body, /"type":"final".*baybay-registrar/);
    assert.equal(executeCalls, 1);
    assert.equal(providerAttempts, 1);
    assert.equal(cacheWrites.length, 0);
    assert.equal(finalizations.length, 1);
    assert.equal(finalizations[0]?.outcome, "static_fallback");
    assert.equal(finalizations[0]?.errorClass, "provider_quota");
  });
}

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

for (const streaming of [true, false]) {
  test(`a blank generated reply uses nonblank fallback and does not cache (${streaming ? "SSE" : "JSON"})`, async () => {
    generatedContent = "    ";
    const { POST } = await routeModule;
    const response = await POST(request(undefined, streaming));
    assert.equal(response.status, 200);
    let content: string;
    if (streaming) {
      const frames = (await response.text()).split("\n")
        .filter(line => line.startsWith("data: ") && line !== "data: [DONE]")
        .map(line => JSON.parse(line.slice(6)));
      content = frames.find(frame => frame.type === "final")?.content ?? "";
    } else {
      content = (await response.json()).content;
    }
    assert.ok(content.trim());
    assert.equal(executeCalls, 1);
    assert.equal(cacheWrites.length, 0);
    assert.notEqual(finalizations[0]?.outcome, "live");
  });
}

const campusFallbackCases = [
  ["Where is the Registrar at VSU Tolosa?", "outside"],
  ["Asa ang Registrar sa VSU Tolosa?", "outside"],
  ["Where is the Registrar at VSU (Tolosa)?", "outside"],
  ["Where is the Registrar at VSU: Tolosa?", "outside"],
  ["Where is the Registrar at VSU, Tolosa?", "outside"],
  ["Where is the Registrar in Tolosa branch of VSU?", "outside"],
  ["Where is the Registrar, at VSU Tolosa or VSU Main Campus?", "clarify"],
  ["Where is the Registrar at VSU Tolosa or Baybay?", "clarify"],
  ["Where is the Registrar at VSU Baybay or Tolosa, please?", "clarify"],
  ["Where is the Registrar at VSU Baybay or Tolosa please?", "clarify"],
  ["Where is the Registrar at VSU Baybay or Tolosa if you know?", "clarify"],
  ["Where is the Registrar at VSU Baybay, or Tolosa?", "clarify"],
  ["Where is the Registrar at VSU Baybay, or at Tolosa?", "clarify"],
  ["Asa ang Registrar sa VSU Baybay o sa Tolosa?", "clarify"],
  ["Where is the Registrar at VSU Alang-alang?", "outside"],
  ["Where is the Registrar at VSU Baybay or Tolosa,please?", "clarify"],
  ["Where is the Registrar at VSU Baybay or Tolosa Hall, please?", "show"],
  ["Where is the Registrar at VSU Baybay or at Tolosa Hall?", "show"],
  ["Where is the Registrar at VSU Baybay or Tolosaville please?", "show"],
  ["Where is the Registrar at VSU Baybay or Tolosa, can you send the pin?", "clarify"],
  ["Directions from Main Campus to the Registrar", "show"],
  ["Directions from Main Campus to the Registrar in Tolosa", "clarify"],
  ["Gikan sa VSU Baybay paingon sa Registrar sa Tolosa", "clarify"],
  ["Directions from Main Campus to the Registrar in Isabel Hall", "show"],
  ["Directions from Main Campus or an extension campus to the Registrar", "clarify"],
  ["Directions from Main Campus or Tolosa, please?", "clarify"],
  ["Directions from VSU Tolosa to the Registrar", "clarify"],
  ["From VSU Tolosa to the Registrar at Main Campus", "show"],
  ["Gikan sa VSU Tolosa padulong sa Registrar sa VSU Baybay", "show"],
  ["Gikan sa VSU Tolosa, asa ang Registrar sa VSU Main Campus sa Baybay?", "show"],
  ["Gikan sa VSU Tolosa paingon sa Registrar sa VSU Baybay", "show"],
  ["Mula sa VSU Tolosa papunta sa Registrar ng VSU Baybay", "show"],
  ["From VSU Baybay to the Registrar at VSU Tolosa", "outside"],
  ["Where is the Registrar at VSU’s Tolosa branch?", "outside"],
  ["Where is the Registrar in VSU’s Tolosa Hall?", "show"],
  ["Naa sa VSU Baybay o Tolosa ang Registrar?", "clarify"],
  ["Directions from the VSU Tolosa campus to the Registrar at VSU Baybay", "show"],
  ["Directions from VSU’s Tolosa branch to the Registrar at VSU Baybay", "show"],
  ["Naa sa VSU Baybay o Tolosa Hall ang Registrar?", "show"],
  ["Naa sa VSU Baybay o sa Tolosa ba ang Registrar?", "clarify"],
  ["Naa sa VSU Baybay o sa Tolosa Hall ba ang Registrar?", "show"],
  ["Ang Registrar naa sa VSU Baybay o sa Tolosa ba?", "clarify"],
  ["Ang Registrar naa sa VSU Baybay o sa Tolosa Hall ba?", "show"],
  ["Where is the Registrar at Tolosa branch campus of VSU?", "outside"],
  ["Directions from VSU Baybay to the Registrar at the Tolosa branch campus of VSU", "outside"],
  ["Directions from the VSU Tolosa branch campus to the Registrar at VSU Baybay", "show"],
  ["From the VSU Tolosa campus, how do I get to the Registrar at VSU Baybay?", "show"],
  ["Where is the Registrar at VSU Baybay?", "show"],
  ["Where is the Registrar?", "show"],
] as const;

for (const [message, expected] of campusFallbackCases) {
  test(`provider-off fallback campus scope (${expected}): ${message}`, async () => {
    process.env.CHAT_LLM_ENABLED = "false";
    fallbackFacilities = [registrar];
    const { POST } = await routeModule;
    const response = await POST(request(message, false));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(executeCalls, 0);
    assert.equal(finalizations[0]?.outcome, "disabled_fallback");
    assert.equal(cacheWrites.length, 0);
    if (expected === "show") {
      assert.equal(body.facilities?.[0]?.facility?.id, registrar.id);
      assert.equal(facilityContextReads, 1);
      assert.equal(facilityCardReads, 1);
      return;
    }
    assert.equal(body.facilities, undefined, JSON.stringify(body.facilities));
    assert.match(body.content, /only.*Main Campus in Baybay/i);
    if (expected === "clarify") {
      assert.match(body.content, /^Which VSU campus is your destination\?/);
    } else {
      assert.doesNotMatch(body.content, /\bDirections\b|\bpin\b/);
    }
    assert.equal(facilityContextReads, 0);
    assert.equal(facilityCardReads, 0);
    assert.deepEqual(finalizations[0]?.retrievedRecordIds, []);
  });
}

test("provider failure uses the same no-card fallback for another campus in SSE", async () => {
  generationError = new Error("provider unavailable");
  fallbackFacilities = [registrar];
  const { POST } = await routeModule;
  const response = await POST(request("Asa ang Registrar sa VSU Tolosa?"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(executeCalls, 1);
  assert.match(body, /"type":"final","content":"SmartMap only shows locations at the VSU Main Campus in Baybay/);
  assert.doesNotMatch(body, /"facilities"|baybay-registrar/);
  assert.equal(facilityContextReads, 0);
  assert.equal(facilityCardReads, 0);
  assert.equal(cacheWrites.length, 0);
  assert.equal(finalizations[0]?.outcome, "static_fallback");
});
