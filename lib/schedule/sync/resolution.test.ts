import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleCourse } from "../types";
import {
  applyScheduleResolution,
  buildCourseResolutionPlan,
  buildReconciliationResolutionPlan,
  validateReconciliationChoice,
  type AtomicScheduleResolutionStore,
} from "./resolution";
import type { ScheduleSourceReconciliation } from "./types";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const SCOPE = "user:33333333-3333-4333-8333-333333333333" as const;

function course(id: string, title: string): ScheduleCourse {
  return {
    id,
    code: title.slice(0, 8),
    title,
    color: "blue",
    meetings: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function conflict(): Extract<ScheduleSourceReconciliation, { kind: "conflict" }> {
  return {
    kind: "conflict",
    courses: [],
    conflicts: [{
      courseId: ID_A,
      versions: [
        { kind: "active", source: "guest", course: course(ID_A, "Guest") },
        { kind: "active", source: "account-local", course: course(ID_A, "Local") },
        { kind: "active", source: "cloud", course: course(ID_A, "Cloud"), revision: 7 },
      ],
    }],
  };
}

test("review merge requires every conflict and rejects absent sources", () => {
  assert.equal(
    validateReconciliationChoice(conflict(), { kind: "review-merge", choices: {} }).kind,
    "incomplete-review",
  );
  assert.equal(
    validateReconciliationChoice(conflict(), {
      kind: "review-merge",
      choices: { [ID_A]: "cloud", [ID_B]: "guest" },
    }).kind,
    "invalid-choice",
  );
  assert.equal(
    validateReconciliationChoice(conflict(), {
      kind: "review-merge",
      choices: { [ID_A]: "cloud" },
    }).kind,
    "valid",
  );
});

test("invalid and 201-course reconciliation stay in explicit review", () => {
  const invalid: ScheduleSourceReconciliation = {
    kind: "invalid",
    courses: [],
    conflicts: [],
    issues: [{ kind: "invalid-cloud-payload", source: "cloud", courseId: ID_A }],
  };
  assert.equal(
    validateReconciliationChoice(invalid, { kind: "use-cloud" }).kind,
    "review-required",
  );
  const overflow: ScheduleSourceReconciliation = {
    kind: "invalid",
    courses: Array.from({ length: 201 }, (_, index) => ({
      source: "guest" as const,
      course: course(
        `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
        `Course ${index}`,
      ),
    })),
    conflicts: [],
    issues: [{ kind: "course-limit-exceeded", source: "merged", courseId: "schedule" }],
  };
  assert.equal(
    validateReconciliationChoice(overflow, { kind: "review-merge", choices: {} }).kind,
    "course-limit-exceeded",
  );
});

test("guest choice produces one upsert at latest cloud revision", () => {
  const result = buildCourseResolutionPlan({
    scope: SCOPE,
    conflict: conflict().conflicts[0]!,
    resolution: { kind: "choose-source", courseId: ID_A, source: "guest" },
  });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.deepEqual(result.plan.local, { kind: "put", course: course(ID_A, "Guest") });
  assert.equal(result.plan.mutation?.operation, "upsert");
  assert.equal(result.plan.mutation?.expectedRevision, 7);
  assert.equal(result.plan.clearSuperseded, true);
});

test("active cloud replaces local while a cloud tombstone deletes it", () => {
  const active = buildCourseResolutionPlan({
    scope: SCOPE,
    conflict: conflict().conflicts[0]!,
    resolution: { kind: "choose-source", courseId: ID_A, source: "cloud" },
  });
  assert.equal(active.kind, "ready");
  if (active.kind === "ready") {
    assert.equal(active.plan.local.kind, "put");
    assert.equal(active.plan.mutation, undefined);
    assert.equal(active.plan.serverRevision, 7);
  }
  const tombstone = buildCourseResolutionPlan({
    scope: SCOPE,
    conflict: {
      courseId: ID_A,
      versions: [
        { kind: "active", source: "account-local", course: course(ID_A, "Local") },
        { kind: "tombstone", source: "cloud", courseId: ID_A, revision: 9 },
      ],
    },
    resolution: { kind: "choose-source", courseId: ID_A, source: "cloud" },
  });
  assert.equal(tombstone.kind, "ready");
  if (tombstone.kind === "ready") {
    assert.deepEqual(tombstone.plan.local, { kind: "delete", courseId: ID_A });
    assert.equal(tombstone.plan.mutation, undefined);
  }
});

test("cancel performs zero writes and one store call is the atomic boundary", async () => {
  let calls = 0;
  const store: AtomicScheduleResolutionStore = {
    async apply() {
      calls += 1;
    },
  };
  await applyScheduleResolution(store, { kind: "cancel" });
  assert.equal(calls, 0);
  const ready = buildCourseResolutionPlan({
    scope: SCOPE,
    conflict: conflict().conflicts[0]!,
    resolution: { kind: "choose-source", courseId: ID_A, source: "account-local" },
  });
  assert.equal(ready.kind, "ready");
  if (ready.kind === "ready") await applyScheduleResolution(store, ready.plan);
  assert.equal(calls, 1);
});

test("atomic store failure is surfaced without a partial retry", async () => {
  let calls = 0;
  const store: AtomicScheduleResolutionStore = {
    async apply() {
      calls += 1;
      throw new Error("rolled back");
    },
  };
  const ready = buildCourseResolutionPlan({
    scope: SCOPE,
    conflict: conflict().conflicts[0]!,
    resolution: { kind: "choose-source", courseId: ID_A, source: "guest" },
  });
  assert.equal(ready.kind, "ready");
  if (ready.kind !== "ready") return;
  await assert.rejects(applyScheduleResolution(store, ready.plan), /rolled back/);
  assert.equal(calls, 1);
});

test("replace cloud creates a bounded desired set against latest revisions", () => {
  const result = buildReconciliationResolutionPlan({
    scope: SCOPE,
    reconciliation: conflict(),
    choice: { kind: "replace-cloud" },
    deviceCourses: [
      { source: "guest", course: course(ID_A, "Guest") },
      { source: "account-local", course: course(ID_B, "Local B") },
    ],
    cloud: [
      { kind: "active", source: "cloud", course: course(ID_A, "Cloud"), revision: 7 },
      { kind: "tombstone", source: "cloud", courseId: ID_B, revision: 4 },
    ],
  });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready" || result.plan.kind !== "replace-cloud") return;
  assert.equal(result.plan.desired.length, 2);
  assert.deepEqual(
    result.plan.desired.map((item) => [
      item.courseId,
      item.mutation?.operation,
      item.mutation?.expectedRevision,
    ]),
    [[ID_A, "upsert", 7], [ID_B, "upsert", 4]],
  );
});

test("use cloud atomically replaces local and carries explicit tombstones", () => {
  const result = buildReconciliationResolutionPlan({
    scope: SCOPE,
    reconciliation: conflict(),
    choice: { kind: "use-cloud" },
    deviceCourses: [],
    cloud: [
      { kind: "active", source: "cloud", course: course(ID_A, "Cloud"), revision: 7 },
      { kind: "tombstone", source: "cloud", courseId: ID_B, revision: 4 },
    ],
  });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready" || result.plan.kind !== "use-cloud") return;
  assert.deepEqual(result.plan.courses, [{
    course: course(ID_A, "Cloud"),
    serverRevision: 7,
  }]);
  assert.deepEqual(result.plan.deletedCourseIds, [ID_B]);
  assert.equal(result.plan.clearSuperseded, true);
});

test("resolution plans reject guest scope before any account mutation", () => {
  const result = buildCourseResolutionPlan({
    scope: "guest",
    conflict: conflict().conflicts[0]!,
    resolution: { kind: "choose-source", courseId: ID_A, source: "guest" },
  });
  assert.equal(result.kind, "invalid-resolution");
});
