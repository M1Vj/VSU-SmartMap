import assert from "node:assert/strict";
import test from "node:test";

import { isScheduleAccountSyncEnabled } from "./feature-flag";

test("account sync is disabled unless the public flag is exactly true", () => {
  assert.equal(isScheduleAccountSyncEnabled(undefined), false);
  assert.equal(isScheduleAccountSyncEnabled("false"), false);
  assert.equal(isScheduleAccountSyncEnabled("TRUE"), false);
  assert.equal(isScheduleAccountSyncEnabled(" true "), false);
  assert.equal(isScheduleAccountSyncEnabled("true"), true);
});
