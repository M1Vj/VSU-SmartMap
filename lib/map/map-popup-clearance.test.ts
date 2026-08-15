import assert from "node:assert/strict";
import test from "node:test";

import {
  computePopupAutoPanPadding,
  DEFAULT_POPUP_BOTTOM_PADDING,
  DEFAULT_POPUP_TOP_PADDING,
} from "./map-popup-clearance";

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
