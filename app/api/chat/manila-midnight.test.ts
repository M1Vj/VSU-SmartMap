import assert from "node:assert/strict";
import test, { mock } from "node:test";

let executeCalls = 0;
let noCards = false;
type Gate = { entered: () => void; release: Promise<void> };
let pending: Gate | undefined;
let pendingRead: Gate | undefined;
let pendingLimit: Gate | undefined;

function pause() {
  let entered!: () => void, release!: () => void;
  const seen = new Promise<void>(r => { entered = r; });
  const released = new Promise<void>(r => { release = r; });
  return { seen, release, gate: { entered, release: released } };
}

const boundary = Date.parse("2026-11-27T16:00:00Z");
const events = ["28", "29"].map((day) => ({
  id: "day-" + day, eventId: "day-" + day, title: "Fixture " + day,
  startTime: "2026-11-" + day + "T01:00:00.000Z",
  endTime: "2026-11-" + day + "T02:00:00.000Z", category: "academic",
}));
const rows = new Map<string, Record<string, unknown>>();


mock.module("@/lib/ai/flows/find-location", {
  namedExports: {
    async executeFindLocation(_input: unknown, { requestTime }: { requestTime: Date }) {
      executeCalls += 1;
      const modeledDay = requestTime.getTime() < boundary ? 0 : 1;
      if (pending) {
        const gate = pending;
        pending = undefined;
        gate.entered();
        await gate.release;
      }
      return {
        output: {
          response: modeledDay === 0 ? "Ugma, Nobyembre 28." : "Ugma, Nobyembre 29.",
          events: noCards ? [] : [events[modeledDay]], facilities: []
        },
        operations: {
          generation: { selectedModel: "model-a", attemptCount: 1 },
          grounding: { outcome: "pass", reasonCodes: [], response: { response: "Verified campus answer", facilities: [] } },
          retrievedRecordIds: [],
        },
      };
    },
  },
});

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return { from(table: string) {
        assert.equal(table, "chat_answer_cache");
        return {
          select() { return { eq(field: string, hash: string) {
            assert.equal(field, "question_hash");
            return { gt(col: string, iso: string) {
              assert.equal(col, "expires_at");
              return { async maybeSingle() {
                if (pendingRead) {
                  const gate = pendingRead;
                  pendingRead = undefined;
                  gate.entered();
                  await gate.release;
                }
                const row = rows.get(hash);
                return { data: row && String(row.expires_at) > iso ? row : null, error: null };
              } };
            } };
          } }; },
          async upsert(row: Record<string, unknown>) {
            rows.set(String(row.question_hash), row);
            return { error: null };
          }
        };
      } };
    },
  },
});

mock.module("@/lib/ai/rate-limit", {
  namedExports: {
    async consumeDurableChatRateLimit() {
      if (pendingLimit) {
        const gate = pendingLimit;
        pendingLimit = undefined;
        gate.entered();
        await gate.release;
      }
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
        async finalize() {},
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
      return { data: [] };
    },
  },
});

mock.module("@/lib/supabase/queries/facilities", {
  namedExports: {
    async getFacilitiesByIds() {
      return { data: [] };
    },
  },
});

mock.module("@/lib/supabase/queries/boarding-houses.server", {
  namedExports: { async getBoardingHousesForChatCached() { return { data: [] }; } },
});

mock.module("@/lib/actions/events", {
  namedExports: { async getEventsCached({ startDate, endDate }: {startDate: Date, endDate: Date}) {
    return { data: events.filter(e => Date.parse(e.startTime) >= +startDate && Date.parse(e.endTime) <= +endDate) };
  } },
});

mock.module("@/lib/ai/gemini", {
  namedExports: { CHAT_MODEL_ID: "model-a" },
});

const routeModule = import("./route.ts");

function request(message = "Where is DMath-LecR3?", streaming = true) {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, streaming }),
  });
}


for (const streaming of [false, true]) {
  test(`fresh, warm and cold "ugma" across Manila midnight, streaming=${streaming}`, async t => {
    process.env.CHAT_LLM_ENABLED = "true";
    executeCalls = 0;
    noCards = false;
    rows.clear();
    t.mock.timers.enable({apis: ["Date"], now: boundary - 5 * 60_000});
    const { POST } = await routeModule;
    const ask = async (question = "Unsay kalihokan ugma sa campus?") => {
      const resp = await POST(request(question, streaming));
      assert.equal(resp.status, 200);
      if (!streaming) return await resp.json();
      const wire = await resp.text();
      const line = wire.split("\n").find(l => l.startsWith('data: {"type":"final"'));
      assert.ok(line, wire);
      return JSON.parse(line.slice(6));
    };
    const before = await ask();
    for (const q of ["What is happening tomorrow?", "May event ba bukas?"]) {
      assert.equal((await ask(q)).content, before.content);
    }
    assert.equal((await ask("Where is the Registrar?")).content, before.content);
    assert.equal(rows.size, 4);
    t.mock.timers.setTime(boundary - 30_000);
    assert.equal((await ask()).content, before.content);
    assert.equal(executeCalls, 4);
    t.mock.timers.setTime(boundary + 5 * 60_000);
    assert.equal((await ask("Where is the Registrar?")).content, before.content);
    assert.equal(executeCalls, 4);
    for (const q of ["What is happening tomorrow?", "May event ba bukas?"]) {
      assert.equal((await ask(q)).content, "Ugma, Nobyembre 29.");
    }
    const warm = await ask();
    const warmCalls = executeCalls;
    rows.clear();
    const cold = await ask();
    const pair = (out: {content: string, events: Array<{startTime: string}>}) => [out.content, out.events?.[0]?.startTime];
    console.log(JSON.stringify({streaming, before: pair(before), warm: pair(warm), cold: pair(cold), warmCalls, finalCalls: executeCalls}));
    assert.deepEqual(pair(before), ["Ugma, Nobyembre 28.", events[0].startTime]);
    assert.deepEqual(pair(cold), ["Ugma, Nobyembre 29.", events[1].startTime]);
    assert.deepEqual(pair(warm), pair(cold));
  });
}

test("a delayed pre-midnight write cannot populate the post-midnight cache key, even with no event cards", async t => {
  process.env.CHAT_LLM_ENABLED = "true";
  executeCalls = 0;
  noCards = true;
  rows.clear();
  t.mock.timers.enable({apis: ["Date"], now: boundary - 1});
  const { POST } = await routeModule;
  const { seen, release, gate } = pause();
  pending = gate;
  const ask = async () => {
    const res = await POST(request("Any events tomorrow?", false));
    assert.equal(res.status, 200);
    return await res.json();
  };
  const beforePromise = ask();
  await seen;
  t.mock.timers.setTime(boundary);
  release();
  const before = await beforePromise;
  assert.equal(before.content, "Ugma, Nobyembre 28.");
  assert.equal(before.events, undefined);
  assert.equal(rows.size, 1);
  const after = await ask();
  assert.equal(after.content, "Ugma, Nobyembre 29.");
  assert.equal(after.events, undefined);
  assert.equal(executeCalls, 2);
  assert.equal(rows.size, 2);
  assert.equal((await ask()).content, after.content);
  assert.equal(executeCalls, 2);
  noCards = false;
});

for (const cached of [false, true]) {
  test(`a boundary-start event remains valid for a request that crosses midnight (cached=${cached})`, async t => {
    executeCalls = 0;
    noCards = false;
    rows.clear();
    t.mock.timers.enable({ apis: ["Date"], now: boundary - 1 });
    const originalStart = events[0].startTime;
    const midnightStart = new Date(boundary).toISOString();
    events[0].startTime = midnightStart;
    t.after(() => { events[0].startTime = originalStart; pending = undefined; pendingRead = undefined; });
    const { POST } = await routeModule;
    const ask = async () => {
      const resp = await POST(request("Unsay kalihokan ugma sa campus?", false));
      assert.equal(resp.status, 200);
      return await resp.json();
    };
    if (cached) {
      assert.equal((await ask()).events?.[0]?.startTime, midnightStart);
    }
    const { seen, release, gate } = pause();
    if (cached) pendingRead = gate;
    else pending = gate;
    const crossing = ask();
    await seen;
    t.mock.timers.setTime(boundary + 1);
    release();
    const actual = await crossing;
    assert.equal(actual.content, "Ugma, Nobyembre 28.");
    assert.equal(actual.events?.[0]?.startTime, midnightStart);
    assert.equal(executeCalls, 1);
  });
}

test("an accepted request keeps its ingress campus date across a delayed rate-limit check", async t => {
  executeCalls = 0;
  noCards = false;
  rows.clear();
  t.mock.timers.enable({ apis: ["Date"], now: boundary - 1 });
  const { POST } = await routeModule;
  const { seen, release, gate } = pause();
  pendingLimit = gate;
  const originalStart = events[0].startTime;
  const midnightStart = new Date(boundary).toISOString();
  events[0].startTime = midnightStart;
  t.after(() => { pendingLimit = undefined; events[0].startTime = originalStart; release(); });
  const crossing = POST(request("Unsay kalihokan ugma sa campus?", false));
  await seen;
  t.mock.timers.setTime(boundary + 1);
  release();
  const first = await crossing;
  assert.equal(first.status, 200);
  const firstPayload = await first.json();
  assert.equal(firstPayload.content, "Ugma, Nobyembre 28.");
  assert.equal(firstPayload.events?.[0]?.startTime, midnightStart);
  const next = await POST(request("Unsay kalihokan ugma sa campus?", false));
  assert.equal(next.status, 200);
  const nextPayload = await next.json();
  assert.equal(nextPayload.content, "Ugma, Nobyembre 29.");
  assert.equal(nextPayload.events?.[0]?.startTime, events[1].startTime);
  assert.equal(executeCalls, 2);
});
