import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./map-markers.tsx", import.meta.url), "utf8");
const markerSource = readFileSync(new URL("./map-marker.tsx", import.meta.url), "utf8");

test("renders every item at its source coordinates without a rewrite path", () => {
  assert.match(source, /items\.map\(\(item\) => \(/);
  assert.match(source, /item=\{item\}/);
  assert.doesNotMatch(source, /spreadCoLocatedItems|zoomBucket|centroid|fan.?out|groupOverlappingItems/);
  assert.doesNotMatch(source, /displayCoordinates/);
  assert.doesNotMatch(source, /MapMarkerCluster|marker-clusters|renderType|cluster/);
});

test("derives every Leaflet marker position from its item coordinates", () => {
  assert.match(markerSource, /const position: \[number, number\] = \[item\.coordinates\.lat, item\.coordinates\.lng\];/);
  assert.doesNotMatch(markerSource, /displayCoordinates/);
});

test("keeps selection, route, and activation callbacks on every marker", () => {
  assert.match(source, /onMarkerTapOverride=\{onMarkerTapOverride\}/);
  assert.match(source, /onMarkerActivate=\{onMarkerActivate\}/);
  assert.match(source, /onDeselect=\{onDeselect\}/);
  assert.match(source, /onDirections=\{onDirections\}/);
  assert.match(
    source,
    /forceMinimized=\{minimizeNonDestinationMarkers && item\.id !== routeDestinationId\}/,
  );
});

test("does not thread a dead protected marker registry into rendering", () => {
  assert.doesNotMatch(source, /protectedMarkerIds|protectedIds|useMemo/);
});

test("propagates an accepted navigation ID through the marker registry", () => {
  assert.match(source, /onDirections\?: \(item: MapItem\) => number \| null;/);
  assert.match(source, /onDirections=\{onDirections\}/);
});
