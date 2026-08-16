import assert from "node:assert/strict";
import test from "node:test";

import { createMapViewportSyncScheduler } from "./map-viewport-sync";

test("viewport lifecycle events coalesce into one frame and retain resize intent", () => {
  const callbacks: Array<() => void> = [];
  const calls: string[] = [];
  let nextFrameId = 0;

  const scheduler = createMapViewportSyncScheduler({
    requestFrame: (callback) => {
      callbacks.push(callback);
      return ++nextFrameId;
    },
    cancelFrame: () => undefined,
    invalidateSize: () => calls.push("invalidate"),
    resize: () => calls.push("resize"),
    repaint: () => calls.push("repaint"),
  });

  scheduler.schedule();
  scheduler.schedule(true);
  scheduler.schedule();
  assert.equal(callbacks.length, 1);
  assert.deepEqual(calls, []);

  callbacks.shift()?.();
  assert.deepEqual(calls, ["invalidate", "resize", "repaint"]);

  scheduler.schedule();
  assert.equal(callbacks.length, 1);
  scheduler.dispose();
  callbacks.shift()?.();
  assert.deepEqual(calls, ["invalidate", "resize", "repaint"]);
});

test("gesture lifecycle repaint does not resize or invalidate the map", () => {
  const callbacks: Array<() => void> = [];
  const calls: string[] = [];
  const scheduler = createMapViewportSyncScheduler({
    requestFrame: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancelFrame: () => undefined,
    invalidateSize: () => calls.push("invalidate"),
    resize: () => calls.push("resize"),
    repaint: () => calls.push("repaint"),
  });

  scheduler.schedule();
  scheduler.schedule();
  callbacks.shift()?.();

  assert.deepEqual(calls, ["repaint"]);
  scheduler.dispose();
});
