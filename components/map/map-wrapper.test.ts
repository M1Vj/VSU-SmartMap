import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readMapWrapperSource() {
  return readFile(new URL("./map-wrapper.tsx", import.meta.url), "utf8");
}

test("the public map places the developer link inside Leaflet attribution", async () => {
  const source = await readMapWrapperSource();

  assert.match(source, /function DeveloperAttribution/);
  assert.match(source, /map\.attributionControl\.addAttribution/);
  assert.match(source, /map\.attributionControl\.removeAttribution/);
  assert.match(source, /href="https:\/\/github\.com\/M1Vj"/);
  assert.match(source, /Developed by Vj F Mabansag/);
  assert.match(source, /<DeveloperAttribution \/>/);
});

test("mobile attribution meets the top edge of the fixed student navigation", async () => {
  const source = await readMapWrapperSource();

  assert.match(
    source,
    /\.leaflet-bottom\.leaflet-left\s*\{[\s\S]*margin-bottom:\s*calc\(5rem \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(
    source,
    /\.leaflet-bottom\.leaflet-right\s*\{[\s\S]*margin-bottom:\s*calc\(var\(--student-mobile-nav-height\) \+ env\(safe-area-inset-bottom, 0px\)\)/,
  );
  assert.doesNotMatch(source, /4\.5625rem/);
});

test("the map wrapper does not automatically fit route bounds", async () => {
  const source = await readMapWrapperSource();

  assert.doesNotMatch(source, /function getSafeAreaInsetBottom/);
  assert.doesNotMatch(source, /function MapBoundsHandler/);
  assert.doesNotMatch(source, /\.fitBounds\(/);
});

test("satellite imagery switches once to an attributed Carto raster fallback after base tile errors", async () => {
  const source = await readMapWrapperSource();

  assert.match(source, /createTileFallbackState/);
  assert.match(source, /recordTileError/);
  assert.match(source, /satelliteFallbackActive/);
  assert.match(source, /satelliteFallbackUrl/);
  assert.match(source, /tileerror/);
  assert.match(source, /satelliteFallbackAttribution/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /top-32/);
  assert.match(source, /url=\{MAP_TILES\.satelliteUrl\}/);
  assert.doesNotMatch(
    source,
    /attribution=\{MAP_TILES\.satelliteAttribution\}[\s\S]{0,240}url=\{mapStyleUrl\}/,
  );

  const fallbackBranchStart = source.indexOf("satelliteFallbackActive ?");
  const fallbackBranchEnd = source.indexOf("\n          ) : (", fallbackBranchStart);
  assert.ok(fallbackBranchStart >= 0 && fallbackBranchEnd > fallbackBranchStart);
  const fallbackBranch = source.slice(fallbackBranchStart, fallbackBranchEnd);
  assert.match(fallbackBranch, /key="satellite-raster-fallback"/);
  assert.match(fallbackBranch, /url=\{MAP_TILES\.satelliteFallbackUrl\}/);
  assert.doesNotMatch(fallbackBranch, /satelliteTransportUrl|satelliteLabelsUrl/);
});
