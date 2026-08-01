import assert from "node:assert/strict";
import test, { mock } from "node:test";

let authorized = true;
let updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];

mock.module("@/lib/auth/server", { namedExports: {
  async assertAdminAction() {
    if (!authorized) return { error: "Unauthorized" };
    return { user: { id: "admin-1" }, serviceClient: {
      from(table: string) {
        const update: { table: string; values: Record<string, unknown>; id?: string } = { table, values: {} };
        updates.push(update);
        return { update(values: Record<string, unknown>) {
          update.values = values;
          return { async eq(_column: string, id: string) { update.id = id; return { error: null }; } };
        } };
      },
    } };
  },
} });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });

const actions = import("./actions.ts");

test.beforeEach(() => { authorized = true; updates = []; });

test("reviewChatOpsRecordAction writes only allowlisted review fields", async () => {
  const { reviewChatOpsRecordAction } = await actions;
  const result = await reviewChatOpsRecordAction({ target: "turn", id: "turn-1", status: "resolved", note: "Checked against campus data." });
  assert.deepEqual(result, {});
  assert.equal(updates[0]?.table, "ai_chat_turns");
  assert.equal(updates[0]?.id, "turn-1");
  assert.deepEqual(Object.keys(updates[0]?.values ?? {}).sort(), ["review_note", "review_status", "reviewed_at", "reviewed_by"]);
});

test("reviewChatOpsRecordAction rejects unauthorized and invalid writes", async () => {
  const { reviewChatOpsRecordAction } = await actions;
  assert.deepEqual(await reviewChatOpsRecordAction({ target: "feedback", id: "feedback-1", status: "invalid", note: "x" }), { error: "Invalid review update." });
  assert.deepEqual(await reviewChatOpsRecordAction({ target: "feedback", id: "feedback-1", status: "resolved", note: "x".repeat(2001) }), { error: "Invalid review update." });
  authorized = false;
  assert.deepEqual(await reviewChatOpsRecordAction({ target: "feedback", id: "feedback-1", status: "resolved", note: "ok" }), { error: "Unauthorized" });
  assert.equal(updates.length, 0);
});
