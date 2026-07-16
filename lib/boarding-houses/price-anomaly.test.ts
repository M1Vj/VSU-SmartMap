import test from "node:test";
import assert from "node:assert/strict";

import { isSuspiciouslyCheap } from "./price-anomaly.ts";

test("flags a price far below the peer median", () => {
  assert.equal(isSuspiciouslyCheap(1000, [2500, 3000, 3500, 4000]), true);
});

test("does not flag a normal provincial price", () => {
  assert.equal(isSuspiciouslyCheap(2500, [2500, 3000, 3500, 4000]), false);
});

test("does not flag without enough peers", () => {
  assert.equal(isSuspiciouslyCheap(500, [3000, 3500]), false);
});

test("ignores unpriced and zero-priced peers when counting the minimum", () => {
  assert.equal(isSuspiciouslyCheap(1000, [null, 0, 3000, 3500]), false);
});

test("never flags an unpriced listing", () => {
  assert.equal(isSuspiciouslyCheap(null, [2500, 3000, 3500, 4000]), false);
});
