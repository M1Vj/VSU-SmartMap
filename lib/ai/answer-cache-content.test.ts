import assert from "node:assert/strict";
import test, { mock } from "node:test";

let rowContent: string;
let clientCalls = 0;
const writes: Array<Record<string, unknown>> = [];
mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      clientCalls++;
      return {
        from(table: string) {
          assert.equal(table, "chat_answer_cache");
          const query = {
            select: () => query,
            eq: () => query,
            gt: () => query,
            async maybeSingle() {
              return {
                data: { question_hash: "hash", question: "Synthetic campus question", content: rowContent, facilities: null, events: null, boarding_houses: null, model: null },
                error: null,
              };
            },
            async upsert(row: Record<string, unknown>) { writes.push(row); return { error: null }; },
          };
          return query;
        },
      };
    },
  },
});
const cache = import("./answer-cache.ts");

test("blank cached rows are misses and nonblank hits remain usable", async () => {
  const { getCachedChatAnswer } = await cache;
  rowContent = "\t  ";
  assert.equal(await getCachedChatAnswer("hash"), null);
  rowContent = "Synthetic complete answer";
  assert.equal((await getCachedChatAnswer("hash"))?.content, rowContent);
});

test("blank answers skip cache writes; valid cache records keep their normal expiry", async () => {
  const { upsertCachedChatAnswer } = await cache;
  const before = clientCalls;
  const timestamp = new Date("2026-01-01T00:00:00Z");
  await upsertCachedChatAnswer("hash", { question: "Synthetic campus question", content: "" }, timestamp);
  assert.equal(clientCalls, before);
  assert.equal(writes.length, 0);
  await upsertCachedChatAnswer("hash", { question: "Synthetic campus question", content: "Synthetic complete answer" }, timestamp);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].content, "Synthetic complete answer");
  assert.equal(writes[0].expires_at, "2026-01-02T00:00:00.000Z");
});
