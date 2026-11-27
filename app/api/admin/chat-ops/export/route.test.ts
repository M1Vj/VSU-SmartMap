import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";
import { NextRequest } from "next/server";

test("chat ops CSV export authenticates before its bounded sanitized query", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  const authorization = source.indexOf("await assertAdminAction()")
  const query = source.indexOf("getChatOpsDashboard(");
  assert.ok(authorization >= 0);
  assert.ok(query > authorization);
  assert.match(source, /admin\.serviceClient/);
  assert.match(source, /limit: 100/);
  assert.match(source, /serializeChatOpsCsv/);
  assert.doesNotMatch(source, /feedback_token_hash|metadata/);
});

test("authorized CSV export filters persisted current and historic model IDs exactly", async () => {
  const modelFilters: string[] = [];
  let queryCount = 0;
  const fixtureModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
  const client = {
    from(table: string) {
      queryCount += 1;
      let selection: string | undefined;
      const builder = {
        select() { return builder; },
        order() { return builder; },
        gte() { return builder; },
        eq(column: string, value: string) {
          if (table === "ai_chat_turns" && column === "selected_model") {
            selection = value;
            modelFilters.push(value);
          }
          return builder;
        },
        async range() {
          return { error: null, data: table !== "ai_chat_turns" ? [] : fixtureModels
            .filter((model) => !selection || model === selection)
            .map((model) => ({
              id: model, created_at: "2026-08-01T01:00:00.000Z", release_id: "fixture-release",
              request_id: "fixture-request", user_message: "Synthetic question", assistant_message: "Synthetic answer",
              outcome: "live", requested_model: model, selected_model: model, cache_state: "miss",
              retrieved_record_ids: [], validation_status: "pass", review_status: "unreviewed",
            })) };
        },
      };
      return builder;
    },
  };

  mock.module("@/lib/auth/server", {
    namedExports: { async assertAdminAction() { return { serviceClient: client }; } },
  });
  const { GET } = await import("./route.ts");
  const request = (model: string) => new NextRequest(
    `https://example.test/api/admin/chat-ops/export?model=${encodeURIComponent(model)}`,
  );
  for (const model of fixtureModels) {
    const response = await GET(request(model));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const csv = await response.text();
    assert.ok(csv.includes(`"${model}"`));
    for (const other of fixtureModels.filter((id) => id !== model)) {
      assert.ok(!csv.includes(`"${other}"`), `unexpected exported row: ${other}`);
    }
  }
  const beforeInvalid = queryCount;
  for (const suffix of [
    "?model=models%2Fgemini-3.5-flash-lite",
    "?model=%20",
    "?model=gemini-3.8-flash&model=",
    "?model=gemini-3.8-flash&model=gemini-2.5-flash",
  ]) {
    const response = await GET(new NextRequest(`https://example.test/api/admin/chat-ops/export${suffix}`));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.equal(queryCount, beforeInvalid);
  for (const suffix of ["", "?model="]) {
    const response = await GET(new NextRequest(`https://example.test/api/admin/chat-ops/export${suffix}`));
    assert.equal(response.status, 200);
    const csv = await response.text();
    for (const model of fixtureModels) assert.ok(csv.includes(`"${model}"`));
  }
  assert.deepEqual(modelFilters, fixtureModels);
});
