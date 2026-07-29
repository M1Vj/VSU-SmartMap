import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleCourse } from "../types";
import {
  classifyFirstReconciliation,
  createReconciliationGeneration,
} from "./reconciliation-controller";
import { createValidatedScheduleReconciliationSnapshot } from "./resolution";

const ID = "11111111-1111-4111-8111-111111111111";
const course: ScheduleCourse = {
  id: ID,
  code: "TEST",
  title: "Course",
  color: "blue",
  meetings: [{
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    days: [1],
    startMinute: 480,
    endMinute: 540,
  }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const cloudRow = {
  id: ID,
  payload: course,
  revision: 1,
  serverVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("controller distinguishes empty, guest-only, cloud-only, both, and invalid", () => {
  const classify = (
    guest: unknown[],
    accountLocal: Array<{ course: unknown }>,
    cloud: typeof cloudRow[],
  ) => classifyFirstReconciliation(
    createValidatedScheduleReconciliationSnapshot({ guest, accountLocal, cloud }),
  );
  assert.equal(classify([], [], []), "complete-empty");
  assert.equal(classify([course], [], []), "review");
  assert.equal(classify([], [], [cloudRow]), "review");
  assert.equal(classify([course], [], [cloudRow]), "review");
  assert.equal(
    classifyFirstReconciliation(
      createValidatedScheduleReconciliationSnapshot({
        guest: [],
        accountLocal: [],
        cloud: [{ ...cloudRow, payload: { ...course, id: "bad" } }],
      }),
    ),
    "blocked",
  );
});

test("generation rejects late pull results after scope switch", () => {
  const gate = createReconciliationGeneration();
  const first = gate.begin("user:11111111-1111-4111-8111-111111111111");
  const second = gate.begin("user:22222222-2222-4222-8222-222222222222");
  assert.equal(gate.isCurrent(first, "user:11111111-1111-4111-8111-111111111111"), false);
  assert.equal(gate.isCurrent(second, "user:22222222-2222-4222-8222-222222222222"), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(second, "user:22222222-2222-4222-8222-222222222222"), false);
});
