import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./map-markers.tsx", import.meta.url), "utf8");

test("renders every overview item through an individual marker", () => {
  assert.match(source, /import \{ spreadCoLocatedItems \} from "@\/lib\/map\/declutter";/);
  assert.match(
    source,
    /const spreadItems = useMemo\(\s*\(\) => spreadCoLocatedItems\(items, zoomBucket, \{ protectedIds \}\)/,
  );
  assert.match(source, /spreadItems\.map\(\(\{ item, displayCoordinates \}\) =>/);
  assert.doesNotMatch(source, /MapMarkerCluster|marker-clusters|renderType|cluster/);
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

test("passes protected marker IDs into declutter", () => {
  assert.match(source, /const protectedIds = useMemo\(\(\) => \{/);
  assert.match(source, /if \(minimizeNonDestinationMarkers \|\| onMarkerTapOverride\) \{/);
  assert.match(source, /if \(selectedId != null\) ids\.add\(selectedId\);/);
  assert.match(source, /if \(routeDestinationId != null\) ids\.add\(routeDestinationId\);/);
  assert.match(source, /spreadCoLocatedItems\(items, zoomBucket, \{\s*protectedIds\s*\}\)/);
});

test("seeds declutter protections from the page-owned runtime marker set", () => {
  assert.match(source, /protectedMarkerIds\?: ReadonlySet<string>;/);
  assert.match(
    source,
    /const protectedIds = useMemo\(\(\) => \{\s*const ids = new Set<string>\(protectedMarkerIds \?\? \[\]\);/,
  );
  assert.match(source, /protectedMarkerIds,/);
});

test("propagates an accepted navigation ID through the marker registry", () => {
  assert.match(source, /onDirections\?: \(item: MapItem\) => number \| null;/);
  assert.match(source, /onDirections=\{onDirections\}/);
});
