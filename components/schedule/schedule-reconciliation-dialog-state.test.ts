import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldResetReconciliationDialog,
  type ReconciliationDialogLifecycle,
} from "./schedule-reconciliation-dialog-state";

const snapshot = {};

const openLifecycle: ReconciliationDialogLifecycle = {
  open: true,
  scope: "user:test",
  activeScope: "user:test",
  snapshot,
};

test("unrelated parent rerenders preserve in-progress reconciliation review state", () => {
  const reviewState = {
    reviewing: true,
    choices: { calculus: "cloud" },
  };
  const previousOnCancel = () => undefined;
  const nextOnCancel = () => undefined;

  assert.notStrictEqual(previousOnCancel, nextOnCancel);
  assert.equal(
    shouldResetReconciliationDialog(openLifecycle, {
      ...openLifecycle,
    }),
    false,
  );
  assert.deepEqual(reviewState, {
    reviewing: true,
    choices: { calculus: "cloud" },
  });
});

test("intended close and scope changes reset reconciliation review state", () => {
  assert.equal(
    shouldResetReconciliationDialog(openLifecycle, {
      ...openLifecycle,
      open: false,
    }),
    true,
  );
  assert.equal(
    shouldResetReconciliationDialog(openLifecycle, {
      ...openLifecycle,
      scope: "guest",
      activeScope: "guest",
    }),
    true,
  );
});
