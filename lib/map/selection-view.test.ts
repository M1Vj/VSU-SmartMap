import test from "node:test";
import assert from "node:assert/strict";

import { getViewAfterDeselect } from "./selection-view.ts";

test("getViewAfterDeselect restores the saved pre-selection view when it exists", () => {
  const result = getViewAfterDeselect(
    {
      center: { lat: 10.7314, lng: 124.7942 },
      zoom: 18,
    },
    {
      center: { lat: 10.7301, lng: 124.7928 },
      zoom: 16,
    }
  );

  assert.deepEqual(result, {
    center: { lat: 10.7301, lng: 124.7928 },
    zoom: 16,
  });
});

test("getViewAfterDeselect falls back to zooming out one level when no saved view exists", () => {
  const result = getViewAfterDeselect(
    {
      center: { lat: 10.7314, lng: 124.7942 },
      zoom: 18,
    },
    null
  );

  assert.deepEqual(result, {
    center: { lat: 10.7314, lng: 124.7942 },
    zoom: 17,
  });
});

test("getViewAfterDeselect does not return a negative zoom when falling back", () => {
  const result = getViewAfterDeselect(
    {
      center: { lat: 10.7314, lng: 124.7942 },
      zoom: 0,
    },
    null
  );

  assert.deepEqual(result, {
    center: { lat: 10.7314, lng: 124.7942 },
    zoom: 0,
  });
});
