import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleOutboxMutation } from "../local-types";
import {
  ScheduleSyncError,
  SupabaseScheduleGateway,
} from "./cloud-gateway";

const id = "11111111-1111-4111-8111-111111111111";
const mutation: ScheduleOutboxMutation = {
  sequence: 1,
  mutationId: "22222222-2222-4222-8222-222222222222",
  scope: "user:33333333-3333-4333-8333-333333333333",
  courseId: id,
  expectedRevision: 0,
  operation: "delete",
  createdAt: "2026-07-28T00:00:00.000Z",
};

class FakeClient {
  lastRpc?: { name: string; params: Record<string, unknown> };
  filters: unknown[] = [];
  orders: unknown[] = [];
  rpcResult: unknown = {
    data: [{
      status: "deleted", id, payload: null, revision: 0,
      server_version: null, created_at: null, updated_at: null, deleted_at: null,
    }],
    error: null,
  };
  rows: unknown[] = [];

  async rpc(name: string, params: Record<string, unknown>) {
    this.lastRpc = { name, params };
    return this.rpcResult;
  }
  from() {
    const query = {
      select: () => query,
      gt: (column: string, value: number) => {
        this.filters.push(["gt", column, value]);
        return query;
      },
      order: (column: string, options: unknown) => {
        this.orders.push([column, options]);
        return query;
      },
      then: (resolve: (value: unknown) => void) =>
        resolve({ data: this.rows, error: null }),
    };
    return query;
  }
}

test("push sends the exact RPC shape without a user id", async () => {
  const client = new FakeClient();
  const result = await new SupabaseScheduleGateway(client as never).push(mutation);
  assert.deepEqual(client.lastRpc, {
    name: "apply_student_schedule_mutation",
    params: {
      p_mutation_id: mutation.mutationId,
      p_course_id: mutation.courseId,
      p_expected_revision: 0,
      p_operation: "delete",
      p_payload: null,
    },
  });
  assert.deepEqual(result, { kind: "deleted-noop", courseId: id, revision: 0 });
});

test("pull validates its cursor and orders monotonically", async () => {
  const client = new FakeClient();
  await new SupabaseScheduleGateway(client as never).pull(42);
  assert.deepEqual(client.filters, [["gt", "server_version", 42]]);
  assert.deepEqual(client.orders, [
    ["server_version", { ascending: true }],
    ["id", { ascending: true }],
  ]);
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).pull(-1),
    (error: unknown) =>
      error instanceof ScheduleSyncError && error.category === "invalid-remote",
  );
});

test("invalid responses and raw database errors are sanitized", async () => {
  const client = new FakeClient();
  client.rpcResult = { data: null, error: { code: "42501", message: "secret row" } };
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).push(mutation),
    (error: unknown) =>
      error instanceof ScheduleSyncError &&
      error.category === "auth" &&
      !error.message.includes("secret"),
  );
  client.rpcResult = { data: [{ status: "upserted", payload: { secret: true } }], error: null };
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).push(mutation),
    (error: unknown) =>
      error instanceof ScheduleSyncError &&
      error.category === "invalid-remote" &&
      !error.message.includes("secret"),
  );
});
