import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleOutboxMutation, StoredScopedScheduleCourse } from "../local-types";
import type { ScheduleScope } from "../scope";
import type { CloudMutationResult, CloudScheduleRow, PullRowResolution } from "./types";
import {
  ScheduleSyncCoordinator,
  type ScheduleSyncLocalStore,
} from "./coordinator";

const scope = "user:33333333-3333-4333-8333-333333333333" as const;
const courseId = "11111111-1111-4111-8111-111111111111";
const course = {
  id: courseId, code: "CS1", title: "Course", color: "blue" as const,
  meetings: [{ id: "44444444-4444-4444-8444-444444444444", days: [1 as const], startMinute: 60, endMinute: 120 }],
  createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z",
};
const mutation = (mutationId: string, expectedRevision = 0): ScheduleOutboxMutation => ({
  sequence: 1, mutationId, scope, courseId, expectedRevision, operation: "upsert",
  course, createdAt: "2026-07-28T00:00:00.000Z",
});
const row = (revision: number, serverVersion = revision): CloudScheduleRow => ({
  id: courseId, payload: course, revision, serverVersion,
  createdAt: course.createdAt, updatedAt: course.updatedAt,
});

class Store implements ScheduleSyncLocalStore {
  outbox: ScheduleOutboxMutation[] = [];
  rows = new Map<string, StoredScopedScheduleCourse>();
  cursor = 0;
  conflicts: PullRowResolution[] = [];
  quarantined: CloudScheduleRow[] = [];
  failPull = false;
  async listOutbox(requested: ScheduleScope) {
    return this.outbox.filter((item) => item.scope === requested);
  }
  async acknowledge(requested: ScheduleScope, sent: ScheduleOutboxMutation, remote: CloudMutationResult) {
    assert.equal(requested, scope);
    const current = this.outbox.find((item) => item.scope === requested && item.courseId === sent.courseId);
    const revision = remote.kind === "accepted" ? remote.row.revision : remote.kind === "deleted-noop" ? 0 : undefined;
    if (revision === undefined) return;
    if (remote.kind === "accepted" && remote.row.payload !== null) {
      this.rows.set(courseId, { key: `${scope}|${courseId}`, scope, id: courseId, course, serverRevision: revision });
    }
    if (current?.mutationId === sent.mutationId) {
      this.outbox = this.outbox.filter((item) => item !== current);
    } else if (current) current.expectedRevision = revision;
  }
  async recordPushConflict(_scope: ScheduleScope, _mutation: ScheduleOutboxMutation, result: CloudMutationResult) {
    this.conflicts.push({ kind: "no-change", serverRevision: result.kind === "conflict" && result.remote ? result.remote.revision : 0 });
  }
  async cursorFor() { return this.cursor; }
  async applyPull(
    _scope: ScheduleScope,
    rows: readonly CloudScheduleRow[],
    nextCursor: number,
    resolve: Parameters<ScheduleSyncLocalStore["applyPull"]>[3],
  ) {
    if (this.failPull) throw new Error("transaction");
    for (const remote of rows) {
      const local = this.rows.get(remote.id);
      const resolution = resolve({
        accountLocal: local
          ? { course: local.course, serverRevision: local.serverRevision }
          : undefined,
        cloud: remote,
        pendingMutation: this.outbox.find(
          (item) => item.scope === scope && item.courseId === remote.id,
        ),
      });
      if (resolution.kind === "invalid-cloud-payload" || resolution.kind === "invalid-cloud-row") {
        this.quarantined.push(remote);
      } else if (resolution.kind === "replace-local") {
        this.rows.set(remote.id, { key: `${scope}|${remote.id}`, scope, id: remote.id, course: resolution.course, serverRevision: resolution.serverRevision });
      } else if (resolution.kind === "delete-local") {
        this.rows.delete(remote.id);
      } else if (resolution.kind === "conflict") {
        this.conflicts.push(resolution);
      }
    }
    this.cursor = nextCursor;
    return { conflicts: this.quarantined.length, quarantined: this.quarantined.length };
  }
  async pendingCount() { return this.outbox.length; }
}

test("pushes sequentially, acknowledges replay, then pulls", async () => {
  const store = new Store();
  store.outbox = [mutation("22222222-2222-4222-8222-222222222222")];
  const calls: string[] = [];
  const gateway = {
    async push(item: ScheduleOutboxMutation) {
      calls.push(`push:${item.mutationId}`);
      return { kind: "accepted", status: "replayed", row: row(1) } as const;
    },
    async pull(cursor: number) { calls.push(`pull:${cursor}`); return [row(1, 5)]; },
  };
  const result = await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.deepEqual(calls, [`push:${store.outbox[0]?.mutationId ?? "22222222-2222-4222-8222-222222222222"}`, "pull:0"]);
  assert.equal(result.kind, "synced");
  assert.equal(store.cursor, 5);
  assert.equal(store.outbox.length, 0);
});

test("a newer edit arriving during push survives and is rebased", async () => {
  const store = new Store();
  const sent = mutation("22222222-2222-4222-8222-222222222222");
  store.outbox = [sent];
  const gateway = {
    async push() {
      store.outbox = [{ ...mutation("55555555-5555-4555-8555-555555555555"), sequence: 2 }];
      return { kind: "accepted", status: "upserted", row: row(1) } as const;
    },
    async pull() { return []; },
  };
  await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(store.outbox[0]?.mutationId, "55555555-5555-4555-8555-555555555555");
  assert.equal(store.outbox[0]?.expectedRevision, 1);
});

test("conflict preserves mutation and continues later courses", async () => {
  const secondId = "66666666-6666-4666-8666-666666666666";
  const store = new Store();
  store.outbox = [mutation("22222222-2222-4222-8222-222222222222"), { ...mutation("77777777-7777-4777-8777-777777777777"), sequence: 2, courseId: secondId, course: { ...course, id: secondId } }];
  let pushes = 0;
  const gateway = {
    async push(item: ScheduleOutboxMutation): Promise<CloudMutationResult> {
      pushes++;
      return item.courseId === courseId
        ? { kind: "conflict", courseId, remote: row(2) }
        : { kind: "accepted", status: "upserted", row: { ...row(1), id: secondId, payload: { ...course, id: secondId } } };
    },
    async pull() { return []; },
  };
  await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(pushes, 2);
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0]?.courseId, courseId);
});

test("auth expiry stops the batch without deleting pending work", async () => {
  const store = new Store();
  store.outbox = [mutation("22222222-2222-4222-8222-222222222222")];
  const gateway = { async push() { throw Object.assign(new Error("safe"), { category: "auth" }); }, async pull() { return []; } };
  const result = await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(result.kind, "auth-required");
  assert.equal(store.outbox.length, 1);
});

test("pull transaction failure does not advance the cursor", async () => {
  const store = new Store(); store.cursor = 4; store.failPull = true;
  const gateway = { async push() { throw new Error("unused"); }, async pull() { return [row(2, 9)]; } };
  const result = await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(result.kind, "failed");
  assert.equal(store.cursor, 4);
});

test("invalid remote rows are quarantined atomically and require review", async () => {
  const store = new Store();
  const gateway = { async push() { throw new Error("unused"); }, async pull() { return [{ ...row(2, 9), payload: { ...course, meetings: [] } }]; } };
  const result = await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(result.kind, "needs-review");
  assert.equal(store.cursor, 9);
  assert.equal(store.quarantined.length, 1);
});

test("a lost response retries the same mutation and accepts server replay", async () => {
  const store = new Store();
  store.outbox = [mutation("22222222-2222-4222-8222-222222222222")];
  let applied = false;
  const gateway = {
    async push() {
      if (!applied) {
        applied = true;
        throw Object.assign(new Error("network"), { category: "offline" });
      }
      return { kind: "accepted", status: "replayed", row: row(1) } as const;
    },
    async pull() { return []; },
  };
  const coordinator = new ScheduleSyncCoordinator({ store, gateway });
  assert.equal((await coordinator.sync(scope)).kind, "failed");
  assert.equal(store.outbox.length, 1);
  assert.equal((await coordinator.sync(scope)).kind, "synced");
  assert.equal(store.outbox.length, 0);
});

test("a stale pull never overwrites a newer canonical local revision", async () => {
  const store = new Store();
  store.rows.set(courseId, {
    key: `${scope}|${courseId}`, scope, id: courseId,
    course: { ...course, title: "Newer" }, serverRevision: 5,
  });
  const gateway = {
    async push() { throw new Error("unused"); },
    async pull() { return [{ ...row(4, 9), payload: { ...course, title: "Older" } }]; },
  };
  await new ScheduleSyncCoordinator({ store, gateway }).sync(scope);
  assert.equal(store.rows.get(courseId)?.course.title, "Newer");
});

test("concurrent calls join by scope but reject account scope confusion", async () => {
  const store = new Store();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const gateway = { async push() { throw new Error("unused"); }, async pull() { await blocked; return []; } };
  const coordinator = new ScheduleSyncCoordinator({ store, gateway });
  const first = coordinator.sync(scope);
  const joined = coordinator.sync(scope);
  const other = await coordinator.sync("user:88888888-8888-4888-8888-888888888888");
  assert.equal(first, joined);
  assert.equal(other.kind, "scope-changed");
  release();
  const completed = await first;
  assert.equal(completed.kind, "synced");
  if (completed.kind === "synced") assert.equal(completed.runToken, 1);
});

test("guest, disabled consent, offline, and unverified auth exit safely", async () => {
  const store = new Store();
  const gateway = { async push() { throw new Error("unused"); }, async pull() { throw new Error("unused"); } };
  assert.equal((await new ScheduleSyncCoordinator({ store, gateway }).sync("guest")).kind, "skipped");
  assert.equal((await new ScheduleSyncCoordinator({ store, gateway, consent: () => false }).sync(scope)).kind, "skipped");
  assert.equal((await new ScheduleSyncCoordinator({ store, gateway, online: () => false }).sync(scope)).kind, "offline");
  assert.equal((await new ScheduleSyncCoordinator({ store, gateway, cloudVerified: () => false }).sync(scope)).kind, "auth-required");
});
