import assert from "node:assert/strict";
import test from "node:test";

import {
  computePopupAutoPanPadding,
  DEFAULT_POPUP_AUTO_PAN_PADDING,
  DEFAULT_POPUP_BOTTOM_PADDING,
  DEFAULT_POPUP_TOP_PADDING,
  resetPopupAutoPanPaddingIfNeeded,
  shouldRemeasurePopupObstacleMutations,
} from "./map-popup-clearance";

test("default reset preserves the baseline object until an active override exists", () => {
  const defaults = {
    top: DEFAULT_POPUP_TOP_PADDING,
    bottom: DEFAULT_POPUP_BOTTOM_PADDING,
  };
  const active = { top: 176, bottom: 320 };

  assert.strictEqual(
    resetPopupAutoPanPaddingIfNeeded(DEFAULT_POPUP_AUTO_PAN_PADDING),
    DEFAULT_POPUP_AUTO_PAN_PADDING,
  );
  assert.strictEqual(resetPopupAutoPanPaddingIfNeeded(defaults, defaults), defaults);
  const reset = resetPopupAutoPanPaddingIfNeeded(active, defaults);
  assert.notStrictEqual(reset, active);
  assert.deepEqual(reset, defaults);
});

test("obstacle mutation summaries remeasure mounts, unmounts, and visibility changes only", () => {
  assert.equal(
    shouldRemeasurePopupObstacleMutations([
      {
        type: "childList",
        targetMatchesObstacle: false,
        changedSubtreeContainsObstacle: true,
      },
    ]),
    true,
  );
  assert.equal(
    shouldRemeasurePopupObstacleMutations([
      {
        type: "attributes",
        targetMatchesObstacle: true,
        changedSubtreeContainsObstacle: false,
      },
    ]),
    true,
  );
  assert.equal(
    shouldRemeasurePopupObstacleMutations([
      {
        type: "childList",
        targetMatchesObstacle: false,
        changedSubtreeContainsObstacle: false,
      },
      {
        type: "attributes",
        targetMatchesObstacle: false,
        changedSubtreeContainsObstacle: false,
      },
    ]),
    false,
  );
});

test("popup clearance keeps the baseline padding when no floating obstacle is present", () => {
  assert.deepEqual(
    computePopupAutoPanPadding({
      mapRect: { top: 0, bottom: 568 },
      obstacles: [],
    }),
    {
      top: DEFAULT_POPUP_TOP_PADDING,
      bottom: DEFAULT_POPUP_BOTTOM_PADDING,
    },
  );
});

test("popup clearance grows for a top obstacle that expands past the baseline", () => {
  assert.deepEqual(
    computePopupAutoPanPadding({
      mapRect: { top: 32, bottom: 568 },
      obstacles: [{ side: "top", top: 32, bottom: 196 }],
    }),
    { top: 176, bottom: DEFAULT_POPUP_BOTTOM_PADDING },
  );
});

test("root-font 200 percent two-row route dock gets more bottom clearance than the baseline", () => {
  const padding = computePopupAutoPanPadding({
    mapRect: { top: 0, bottom: 568 },
    obstacles: [
      // At 200% root font, the wrapped Clear/Report dock occupies this lower band.
      { side: "bottom", top: 260, bottom: 448 },
    ],
  });

  assert.equal(padding.top, DEFAULT_POPUP_TOP_PADDING);
  assert.equal(padding.bottom, 320);
  assert.ok(padding.bottom > DEFAULT_POPUP_BOTTOM_PADDING);
});

test("popup clearance uses the largest edge clearance when several obstacles overlap a side", () => {
  assert.deepEqual(
    computePopupAutoPanPadding({
      mapRect: { top: 0, bottom: 568 },
      obstacles: [
        { side: "top", top: 0, bottom: 140 },
        { side: "top", top: 0, bottom: 188 },
        { side: "bottom", top: 360, bottom: 448 },
        { side: "bottom", top: 288, bottom: 448 },
      ],
    }),
    { top: 200, bottom: 292 },
  );
});

test("popup clearance ignores disconnected, hidden, zero-size, and out-of-map obstacles", () => {
  const mapRect = { top: 0, bottom: 568, left: 0, right: 320 };
  const baseline = {
    top: DEFAULT_POPUP_TOP_PADDING,
    bottom: DEFAULT_POPUP_BOTTOM_PADDING,
  };
  const obstacle = {
    side: "bottom" as const,
    top: 260,
    bottom: 448,
    left: 0,
    right: 320,
    width: 320,
    height: 188,
  };

  assert.deepEqual(
    computePopupAutoPanPadding({
      mapRect,
      obstacles: [
        { ...obstacle, connected: false },
        { ...obstacle, visible: false },
        { ...obstacle, width: 0 },
        { ...obstacle, left: 320, right: 360 },
      ],
    }),
    baseline,
  );
  assert.deepEqual(
    computePopupAutoPanPadding({
      mapRect,
      obstacles: [{ ...obstacle, connected: true, visible: true }],
    }),
    { top: DEFAULT_POPUP_TOP_PADDING, bottom: 320 },
  );
});
