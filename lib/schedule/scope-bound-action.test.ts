import assert from "node:assert/strict";
import test from "node:test";

import { canRunScheduleScopeAction } from "./scope-bound-action";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE } from "./scope";

const A = accountScheduleScope("00000000-0000-4000-8000-000000000001");
const B = accountScheduleScope("00000000-0000-4000-8000-000000000002");

for (const kind of ["clear", "restore", "edit", "delete", "remove-local"] as const) {
  test(`${kind} opened in A is rejected after switching to B or guest`, () => {
    assert.equal(canRunScheduleScopeAction(A, B, B), false);
    assert.equal(canRunScheduleScopeAction(A, GUEST_SCHEDULE_SCOPE, GUEST_SCHEDULE_SCOPE), false);
    assert.equal(canRunScheduleScopeAction(A, A, B), false);
    assert.equal(canRunScheduleScopeAction(A, A, A), true);
  });
}
