import test from "node:test";
import assert from "node:assert/strict";
import { shouldDeselectAfterPopupClose } from "./popup-close.ts";

test("only a user dismissal of the current selection deselects", () => {
  assert.equal(shouldDeselectAfterPopupClose(true, "dismiss"), true);
  assert.equal(shouldDeselectAfterPopupClose(false, "dismiss"), false);
  assert.equal(shouldDeselectAfterPopupClose(true, "action"), false);
  assert.equal(shouldDeselectAfterPopupClose(true, "selection-transfer"), false);
});
