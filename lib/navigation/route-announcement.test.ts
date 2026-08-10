import assert from "node:assert/strict";
import test from "node:test";

import { createRouteAnnouncementTracker } from "./route-announcement.ts";

test("tracks one toast per session across recalculations and releases it on reset", () => {
  const tracker = createRouteAnnouncementTracker();

  assert.equal(tracker.claim(1), true);
  tracker.register(1, "route-toast-1");
  assert.equal(tracker.claim(1), false);
  assert.equal(tracker.has(1), true);
  assert.equal(tracker.reset(), "route-toast-1");
  assert.equal(tracker.has(1), false);
  assert.equal(tracker.reset(), null);
});

test("a new session can claim and register a fresh toast after reset", () => {
  const tracker = createRouteAnnouncementTracker();

  assert.equal(tracker.claim(1), true);
  tracker.register(1, "old-toast");
  assert.equal(tracker.reset(), "old-toast");

  assert.equal(tracker.claim(2), true);
  tracker.register(2, "new-toast");
  assert.equal(tracker.has(2), true);
  assert.equal(tracker.reset(), "new-toast");
});

test("releasing a toast preserves the announced session gate", () => {
  const tracker = createRouteAnnouncementTracker();

  assert.equal(tracker.claim(1), true);
  tracker.register(1, "route-toast-1");

  assert.equal(tracker.releaseToast(), "route-toast-1");
  assert.equal(tracker.has(1), true);
  assert.equal(tracker.claim(1), false);
  assert.equal(tracker.releaseToast(), null);
  assert.equal(tracker.reset(), null);
});

test("reset retires the old session until a later generation", () => {
  const tracker = createRouteAnnouncementTracker();

  assert.equal(tracker.claim(4), true);
  tracker.register(4, "old-toast");
  assert.equal(tracker.reset(4), "old-toast");
  assert.equal(tracker.claim(4), false);
  assert.equal(tracker.has(4), false);
  assert.equal(tracker.claim(5), true);
});
