import test from "node:test";
import assert from "node:assert/strict";

import {
  TBA_SEARCH_DIALOG_DELAY_MS,
  getTbaSearchDialogDelay,
  isTbaSearchQuery,
} from "./tba-search.ts";

test("isTbaSearchQuery matches TBA regardless of casing and outer spacing", () => {
  assert.equal(isTbaSearchQuery("TBA"), true);
  assert.equal(isTbaSearchQuery(" tba "), true);
  assert.equal(isTbaSearchQuery("TbA"), true);
});

test("isTbaSearchQuery only matches the standalone TBA abbreviation", () => {
  assert.equal(isTbaSearchQuery(""), false);
  assert.equal(isTbaSearchQuery("TBA building"), false);
  assert.equal(isTbaSearchQuery("notba"), false);
  assert.equal(isTbaSearchQuery("To Be Announced"), false);
});

test("getTbaSearchDialogDelay waits before showing the TBA explanation", () => {
  assert.equal(TBA_SEARCH_DIALOG_DELAY_MS, 500);
  assert.equal(getTbaSearchDialogDelay("TBA"), TBA_SEARCH_DIALOG_DELAY_MS);
  assert.equal(getTbaSearchDialogDelay("TBA building"), null);
});
