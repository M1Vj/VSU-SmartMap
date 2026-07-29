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
const upsertMutation: ScheduleOutboxMutation = {
  ...mutation,
  operation: "upsert",
  course: {
    id, code: "CS1", title: "Course", color: "blue",
    meetings: [{ id: "44444444-4444-4444-8444-444444444444", days: [1], startMinute: 60, endMinute: 120 }],
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  },
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

test("RPC results must exactly match the sent canonical course id", async () => {
  const client = new FakeClient();
  for (const result of [
    { status: "deleted", id: "99999999-9999-4999-8999-999999999999", payload: null, revision: 0, server_version: null, created_at: null, updated_at: null, deleted_at: null },
    { status: "conflict", id: courseIdUpper(), payload: null, revision: null, server_version: null, created_at: null, updated_at: null, deleted_at: null },
  ]) {
    client.rpcResult = { data: [result], error: null };
    await assert.rejects(
      () => new SupabaseScheduleGateway(client as never).push(mutation),
      (error: unknown) => error instanceof ScheduleSyncError && error.category === "invalid-remote",
    );
  }
});

test("null conflict and delete-noop variants require every null field", async () => {
  const client = new FakeClient();
  for (const result of [
    { status: "conflict", id, payload: null, revision: null, server_version: null, created_at: null, updated_at: null },
    { status: "deleted", id, payload: null, revision: 0, server_version: null, created_at: null, updated_at: null, deleted_at: "2026-07-28T00:00:00.000Z" },
  ]) {
    client.rpcResult = { data: [result], error: null };
    await assert.rejects(() => new SupabaseScheduleGateway(client as never).push(mutation));
  }
});

test("pull keeps semantically invalid payloads for coordinator quarantine", async () => {
  const client = new FakeClient();
  client.rows = [{
    id, payload: { id, meetings: [] }, revision: 1, server_version: 1,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z", deleted_at: null,
  }];
  const rows = await new SupabaseScheduleGateway(client as never).pull(0);
  assert.equal(rows.length, 1);
});

test("initial pull continues from a full page and fails closed above its bound", async () => {
  class PagingClient {
    after = 0;
    calls = 0;
    requestedLimit?: number;
    from() {
      const query = {
        select: () => query,
        gt: (_column: string, value: number) => {
          this.after = value;
          return query;
        },
        order: () => query,
        limit: (value: number) => {
          this.requestedLimit = value;
          return query;
        },
        then: (resolve: (value: unknown) => void) => {
          this.calls += 1;
          const start = this.after + 1;
          const count = this.calls === 1 ? 2 : 1;
          resolve({
            data: Array.from({ length: count }, (_, index) => ({
              id: `00000000-0000-4000-8000-${(start + index).toString().padStart(12, "0")}`,
              payload: null,
              revision: 1,
              server_version: start + index,
              created_at: "2026-07-28T00:00:00.000Z",
              updated_at: "2026-07-28T00:00:00.000Z",
              deleted_at: "2026-07-28T00:00:00.000Z",
            })),
            error: null,
          });
        },
      };
      return query;
    }
  }
  const client = new PagingClient();
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).pullAllBounded(2, 2),
    (error: unknown) =>
      error instanceof ScheduleSyncError &&
      error.category === "invalid-remote",
  );
  assert.equal(client.calls, 2);
  assert.equal(client.requestedLimit, 2);
});

test("bounded initial pull continues through a lower server cap until an empty proof page", async () => {
  class CappedClient {
    after = 0;
    requestedLimit = 0;
    calls = 0;
    readonly rows = Array.from({ length: 1_200 }, (_, index) => {
      const version = index + 1;
      return {
        id: `00000000-0000-4000-8000-${version.toString().padStart(12, "0")}`,
        payload: null,
        revision: 1,
        server_version: version,
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:00:00.000Z",
        deleted_at: "2026-07-28T00:00:00.000Z",
      };
    });
    from() {
      const query = {
        select: () => query,
        gt: (_column: string, value: number) => {
          this.after = value;
          return query;
        },
        order: () => query,
        limit: (value: number) => {
          this.requestedLimit = value;
          return query;
        },
        then: (resolve: (value: unknown) => void) => {
          this.calls += 1;
          resolve({
            data: this.rows
              .filter((row) => row.server_version > this.after)
              .slice(0, Math.min(500, this.requestedLimit)),
            error: null,
          });
        },
      };
      return query;
    }
  }
  const client = new CappedClient();
  const rows = await new SupabaseScheduleGateway(client as never)
    .pullAllBounded(1_500, 1_000);
  assert.equal(rows.length, 1_200);
  assert.equal(client.calls, 4);
  assert.equal(client.requestedLimit, 1_000);
});

test("pull rejects an equal cursor and unsafe BIGINT values", async () => {
  const client = new FakeClient();
  client.rows = [{
    id, payload: null, revision: 1, server_version: 42,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
    deleted_at: "2026-07-28T00:00:00.000Z",
  }];
  await assert.rejects(() => new SupabaseScheduleGateway(client as never).pull(42));
  await assert.rejects(() => new SupabaseScheduleGateway(client as never).pull(Number.MAX_SAFE_INTEGER + 1));
});

test("quota and representative PostgREST network failures are generic", async () => {
  const client = new FakeClient();
  client.rpcResult = { data: null, error: { code: "P0001", message: "active student schedule quota exceeded" } };
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).push(mutation),
    (error: unknown) => error instanceof ScheduleSyncError && error.category === "conflict",
  );
  client.rpcResult = { data: null, error: { code: "", message: "TypeError: Failed to fetch", details: "secret endpoint" } };
  await assert.rejects(
    () => new SupabaseScheduleGateway(client as never).push(mutation),
    (error: unknown) =>
      error instanceof ScheduleSyncError &&
      error.category === "offline" &&
      !error.message.includes("secret"),
  );
  for (const message of ["fetch failed", "Network request failed", "Load failed"]) {
    client.rpcResult = { data: null, error: { code: "", message, details: "secret" } };
    await assert.rejects(
      () => new SupabaseScheduleGateway(client as never).push(mutation),
      (error: unknown) => error instanceof ScheduleSyncError && error.category === "offline",
    );
  }
});

test("accepts strict PostgREST timestamptz offsets and microseconds", async () => {
  const client = new FakeClient();
  client.rows = [{
    id, payload: null, revision: 1, server_version: 1,
    created_at: "2026-07-28T18:46:04.338019+00:00",
    updated_at: "2026-07-28T20:46:04.1+02:00",
    deleted_at: "2026-07-29T02:46:04-08:00",
  }];
  assert.equal((await new SupabaseScheduleGateway(client as never).pull(0)).length, 1);
});

test("rejects invalid and ambiguous timestamp strings", async () => {
  for (const value of [
    "2026-02-30T18:46:04Z",
    "2026-07-28 18:46:04+00:00",
    "07/28/2026 18:46:04",
    "2026-07-28T18:46:04",
    "2026-07-28T25:00:00Z",
  ]) {
    const client = new FakeClient();
    client.rows = [{
      id, payload: null, revision: 1, server_version: 1,
      created_at: value, updated_at: "2026-07-28T00:00:00Z",
      deleted_at: "2026-07-28T00:00:00Z",
    }];
    await assert.rejects(() => new SupabaseScheduleGateway(client as never).pull(0));
  }
});

test("RPC status and row state must match the sent operation", async () => {
  const active = {
    id, payload: upsertMutation.course, revision: 1, server_version: 1,
    created_at: "2026-07-28T00:00:00Z",
    updated_at: "2026-07-28T00:00:00Z", deleted_at: null,
  };
  const tombstone = {
    id, payload: null, revision: 2, server_version: 2,
    created_at: "2026-07-28T00:00:00Z",
    updated_at: "2026-07-28T00:00:00Z",
    deleted_at: "2026-07-28T00:00:00Z",
  };
  for (const [sent, result] of [
    [upsertMutation, { status: "deleted", ...tombstone }],
    [upsertMutation, { status: "replayed", ...tombstone }],
    [mutation, { status: "upserted", ...active }],
    [mutation, { status: "replayed", ...active }],
  ] as const) {
    const client = new FakeClient();
    client.rpcResult = { data: [result], error: null };
    await assert.rejects(() => new SupabaseScheduleGateway(client as never).push(sent));
  }
});

function courseIdUpper(): string {
  return "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
}
