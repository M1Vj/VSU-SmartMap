import test from "node:test";
import assert from "node:assert/strict";
import { runMapPopupActionOnce } from "./popup-action.ts";

test("popup actions are suppressed for the same task and released for a later task", async () => {
  const pending = { current: false };
  let calls = 0;
  const action = () => {
    calls += 1;
  };

  assert.equal(runMapPopupActionOnce(pending, action), true);
  assert.equal(runMapPopupActionOnce(pending, action), false);
  assert.equal(calls, 1);

  await new Promise<void>((resolve) => queueMicrotask(resolve));

  assert.equal(runMapPopupActionOnce(pending, action), true);
  assert.equal(calls, 2);
});
