import assert from "node:assert/strict";
import test from "node:test";

import { focusConnectedMarker } from "./marker-focus.ts";

function marker(mapItemId: string, isConnected = true) {
  let focused = 0;
  return {
    target: {
      dataset: { mapItemId },
      isConnected,
      focus: () => {
        focused += 1;
      },
    },
    get focused() {
      return focused;
    },
  };
}

test("Escape focus restoration targets the same connected marker once", () => {
  const other = marker("other");
  const selected = marker("selected");

  assert.equal(
    focusConnectedMarker([other.target, selected.target], "selected"),
    true,
  );
  assert.equal(other.focused, 0);
  assert.equal(selected.focused, 1);
});

test("Escape focus restoration skips disconnected or unknown markers", () => {
  const disconnected = marker("selected", false);
  const other = marker("other");

  assert.equal(
    focusConnectedMarker([disconnected.target, other.target], "selected"),
    false,
  );
  assert.equal(disconnected.focused, 0);
  assert.equal(other.focused, 0);
});
