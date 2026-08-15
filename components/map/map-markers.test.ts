import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./map-markers.tsx", import.meta.url), "utf8");

test("overview presentation maps every spread item directly to an individual marker", () => {
  assert.match(source, /import \{ spreadCoLocatedItems \} from "@\/lib\/map\/declutter"/);
  assert.match(source, /const spreadItems = useMemo\(/);
  assert.match(source, /spreadCoLocatedItems\(items, zoomBucket, \{ protectedIds \}\)/);
  assert.match(source, /spreadItems\.map\(\(\{ item, displayCoordinates \}\) => \(/);
  assert.match(source, /<MapMarker/);
  assert.doesNotMatch(source, /cluster/i);
});

test("individual markers retain route and selection presentation props", () => {
  assert.match(source, /const protectedIds = useMemo\(\(\) => \{/);
  assert.match(source, /if \(minimizeNonDestinationMarkers \|\| onMarkerTapOverride\) \{/);
  assert.match(source, /items\.forEach\(\(item\) => ids\.add\(item\.id\)\)/);
  assert.match(source, /if \(selectedId != null\) ids\.add\(selectedId\)/);
  assert.match(source, /if \(routeDestinationId != null\) ids\.add\(routeDestinationId\)/);
  assert.match(source, /isSelected=\{item\.id === selectedId\}/);
  assert.match(source, /isRouteDestination=\{item\.id === routeDestinationId\}/);
  assert.match(
    source,
    /forceMinimized=\{minimizeNonDestinationMarkers && item\.id !== routeDestinationId\}/,
  );
  assert.match(source, /onMarkerTapOverride=\{onMarkerTapOverride\}/);
  assert.match(source, /onDeselect=\{onDeselect\}/);
  assert.match(source, /onDirections=\{onDirections\}/);
});
