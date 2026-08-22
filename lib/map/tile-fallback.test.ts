import assert from "node:assert/strict";
import test from "node:test";

import {
  createTileFallbackState,
  recordTileError,
} from "./tile-fallback.ts";

test("tile fallback activates once after the bounded error threshold", () => {
  let state = createTileFallbackState(3);

  state = recordTileError(state);
  assert.deepEqual(state, { errorCount: 1, active: false, threshold: 3 });
  state = recordTileError(state);
  assert.equal(state.active, false);
  state = recordTileError(state);
  assert.equal(state.active, true);

  const stillActive = recordTileError(state);
  assert.deepEqual(stillActive, state);
});
