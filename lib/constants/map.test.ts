import test from "node:test";
import assert from "node:assert/strict";

import { MAP_TILES } from "./map.ts";

test("map light and dark basemaps use OpenFreeMap vector styles", () => {
  assert.equal(MAP_TILES.url, "https://tiles.openfreemap.org/styles/liberty");
  assert.equal(MAP_TILES.darkUrl, "https://tiles.openfreemap.org/styles/dark");
  assert.equal(MAP_TILES.pitch, 0);
  assert.equal(MAP_TILES.bearing, 0);
});
