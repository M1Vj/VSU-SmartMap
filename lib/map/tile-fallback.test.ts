import assert from "node:assert/strict";
import test from "node:test";

import {
  CARTO_LIGHT_TILE_HOST,
  createTileFallbackState,
  recordTileError,
  tileFallbackUrlFromArcGis,
} from "./tile-fallback.ts";

test("ArcGIS XYZ tile coordinates convert to the bounded Carto light fallback", () => {
  assert.equal(
    tileFallbackUrlFromArcGis(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/12345/67890",
    ),
    `${CARTO_LIGHT_TILE_HOST}/light_all/17/67890/12345.png`,
  );
  assert.equal(
    tileFallbackUrlFromArcGis(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/not-a-tile",
    ),
    null,
  );
});

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
