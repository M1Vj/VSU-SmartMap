import assert from "node:assert/strict";
import test from "node:test";
import { createReconciliationFocusRestoreController } from "./reconciliation-focus";

const accountA = "user:11111111-1111-4111-8111-111111111111" as const;
const accountB = "user:22222222-2222-4222-8222-222222222222" as const;

test("focus restoration is one-shot and only follows an explicit same-scope close", () => {
  const controller = createReconciliationFocusRestoreController();
  assert.equal(controller.consume(accountA), false);
  controller.request(accountA);
  assert.equal(controller.consume(accountB), false);
  assert.equal(controller.consume(accountA), false);
  controller.request(accountA);
  assert.equal(controller.consume(accountA), true);
  assert.equal(controller.consume(accountA), false);
});

test("a failed action can clear its pending focus request", () => {
  const controller = createReconciliationFocusRestoreController();
  controller.request(accountA);
  controller.clear(accountA);
  assert.equal(controller.consume(accountA), false);
});
