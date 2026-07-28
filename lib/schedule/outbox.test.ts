import assert from "node:assert/strict";
import test from "node:test";

import { createScheduleMutation, desiredScheduleMutation } from "./outbox.ts";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE } from "./scope.ts";
import type { ScheduleCourse } from "./types.ts";

const SCOPE = accountScheduleScope("11111111-1111-4111-8111-111111111111");
const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const MUTATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-07-29T01:02:03.000Z");
const course = {
  id: COURSE_ID,
  code: "CS 101",
  title: "Computing",
  color: "blue",
  meetings: [],
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
} satisfies ScheduleCourse;

test("creates deterministic canonical account mutations", () => {
  assert.deepEqual(
    createScheduleMutation({
      scope: SCOPE,
      courseId: COURSE_ID.toUpperCase(),
      operation: "upsert",
      course,
      expectedRevision: 7,
      now: () => NOW,
      mutationId: () => MUTATION_ID,
    }),
    {
      mutationId: MUTATION_ID,
      scope: SCOPE,
      courseId: COURSE_ID,
      expectedRevision: 7,
      operation: "upsert",
      course,
      createdAt: NOW.toISOString(),
    },
  );
});

test("guest and non-canonical generated mutation IDs are rejected", () => {
  assert.throws(() =>
    createScheduleMutation({
      scope: GUEST_SCHEDULE_SCOPE,
      courseId: COURSE_ID,
      operation: "delete",
    }),
  );
  assert.throws(() =>
    createScheduleMutation({
      scope: SCOPE,
      courseId: COURSE_ID,
      operation: "delete",
      mutationId: () => "not-a-uuid",
    }),
  );
});

test("coalescing preserves the original expected revision", () => {
  const pendingDelete = createScheduleMutation({
    scope: SCOPE,
    courseId: COURSE_ID,
    operation: "delete",
    expectedRevision: 9,
    mutationId: () => MUTATION_ID,
    now: () => NOW,
  });
  const desired = desiredScheduleMutation({
    existing: pendingDelete,
    scope: SCOPE,
    course,
    operation: "upsert",
    knownRevision: 100,
    mutationId: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    now: () => NOW,
  });
  assert.equal(desired?.operation, "upsert");
  assert.equal(desired?.expectedRevision, 9);
  assert.equal(desired?.mutationId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.notEqual(desired?.mutationId, pendingDelete.mutationId);
});

test("create then delete before first sync coalesces to net zero", () => {
  const pendingCreate = createScheduleMutation({
    scope: SCOPE,
    courseId: COURSE_ID,
    operation: "upsert",
    course,
    expectedRevision: 0,
    mutationId: () => MUTATION_ID,
    now: () => NOW,
  });
  assert.equal(
    desiredScheduleMutation({
      existing: pendingCreate,
      scope: SCOPE,
      courseId: COURSE_ID,
      operation: "delete",
    }),
    undefined,
  );
});
