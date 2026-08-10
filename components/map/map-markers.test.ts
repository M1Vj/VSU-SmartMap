import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./map-markers.tsx", import.meta.url), "utf8");

test("manual-start override protects every low-zoom item from clustering", () => {
  assert.match(source, /if \(minimizeNonDestinationMarkers \|\| onMarkerTapOverride\) \{/);
  assert.match(source, /items\.forEach\(\(item\) => ids\.add\(item\.id\)\)/);
});

test("active route mode protects every low-zoom item from clustering", () => {
  assert.match(source, /minimizeNonDestinationMarkers \|\| onMarkerTapOverride/);
});
