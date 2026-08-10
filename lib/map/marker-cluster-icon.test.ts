import test from "node:test";
import assert from "node:assert/strict";

import {
  getMarkerClusterIconSpec,
  isMarkerClusterActivationKey,
} from "./marker-cluster-icon.ts";

test("cluster icon exposes a label while keeping the visible count readable", () => {
  const icon = getMarkerClusterIconSpec(7);

  assert.match(icon.html, /aria-label="7 nearby map items"/);
  assert.match(icon.html, />7<\/span>/);
  assert.doesNotMatch(icon.html, /aria-hidden/);
});

test("cluster activation accepts Enter and Space keys", () => {
  assert.equal(isMarkerClusterActivationKey("Enter"), true);
  assert.equal(isMarkerClusterActivationKey(" "), true);
  assert.equal(isMarkerClusterActivationKey("Spacebar"), true);
  assert.equal(isMarkerClusterActivationKey("Escape"), false);
  assert.equal(isMarkerClusterActivationKey(undefined), false);
});
