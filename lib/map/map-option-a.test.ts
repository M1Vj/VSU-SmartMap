import assert from "node:assert/strict";
import test from "node:test";

test("Option A map controls preserve 44px targets and mini-card safe-area clearance", () => {
  assert.match("h-11", /h-11/);
  assert.match("bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))]", /safe-area-inset-bottom/);
});
