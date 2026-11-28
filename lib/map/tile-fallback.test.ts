import assert from "node:assert/strict";
import test from "node:test";

import {
  createTileFallbackState,
  isInitialVectorStyleError,
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

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

test("initial vector style HTTP 503 falls back to the raster basemap", () => {
  const event = { error: { url: STYLE_URL, message: "AJAXError: Service Unavailable (503)" } };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: false,
      hasStyle: false,
    }),
    true,
  );
});

test("a style error after the initial style loaded stays on the vector basemap", () => {
  const event = { error: { url: STYLE_URL, message: "AJAXError: Service Unavailable (503)" } };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: true,
      hasStyle: true,
    }),
    false,
  );
});

test("a source/tile error is not an initial style failure", () => {
  const event = {
    sourceId: "openmaptiles",
    error: { message: "AJAXError: Service Unavailable (503)" },
  };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: false,
      hasStyle: false,
    }),
    false,
  );
});

test("a non-style URL error (sprite or glyph) is not an initial style failure", () => {
  const event = {
    error: {
      url: "https://tiles.openfreemap.org/styles/liberty/sprite.json",
      message: "AJAXError: Service Unavailable (503)",
    },
  };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: false,
      hasStyle: false,
    }),
    false,
  );
});

test("a network failure without a URL falls back when no style exists yet", () => {
  const event = { error: { message: "Failed to fetch" } };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: false,
      hasStyle: false,
    }),
    true,
  );
});

test("an error without a URL keeps the vector basemap once a style exists", () => {
  const event = { error: { message: "Unknown renderer error" } };

  assert.equal(
    isInitialVectorStyleError(event, STYLE_URL, {
      initialStyleLoaded: false,
      hasStyle: true,
    }),
    false,
  );
});
