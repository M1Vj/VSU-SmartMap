import assert from "node:assert/strict";
import test from "node:test";
import { observeMapCardHeight } from "./map-card-height";

test("map card height fallback resets the dock measurement on cleanup", () => {
  let height = 144;
  const reported: number[] = [];
  const cleanup = observeMapCardHeight(
    { getBoundingClientRect: () => ({ height }) },
    (nextHeight) => reported.push(nextHeight),
  );

  assert.deepEqual(reported, [144]);
  height = 220;
  cleanup();
  assert.deepEqual(reported, [144, 0]);
});

test("map card height observer disconnects and resets after resize tracking", () => {
  let callback: (() => void) | null = null;
  let disconnected = false;
  const reported: number[] = [];
  let height = 144;
  const cleanup = observeMapCardHeight(
    { getBoundingClientRect: () => ({ height }) },
    (nextHeight) => reported.push(nextHeight),
    (onResize) => {
      callback = onResize;
      return {
        observe: () => undefined,
        disconnect: () => {
          disconnected = true;
        },
      };
    },
  );

  height = 220;
  callback?.();
  assert.deepEqual(reported, [144, 220]);
  cleanup();
  assert.equal(disconnected, true);
  assert.deepEqual(reported, [144, 220, 0]);
});
