import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./leaflet-react.tsx", import.meta.url), "utf8");

test("project adapter is built directly on Leaflet and exposes only the required surface", () => {
  assert.doesNotMatch(source, /react-leaflet/);
  for (const symbol of [
    "MapContainer",
    "TileLayer",
    "CircleMarker",
    "Polyline",
    "Marker",
    "Tooltip",
    "Popup",
    "useMap",
    "useMapEvents",
  ]) {
    assert.match(source, new RegExp(`export (?:const |function )${symbol}`));
  }
});

test("adapter owns native layer cleanup and stable overlay portals", () => {
  assert.match(source, /mapInstance\.remove\(\)/);
  assert.match(source, /instance\.removeFrom\(map\)/);
  assert.match(source, /target\.off\(eventHandlers\)/);
  assert.match(source, /createPortal\(children, root\)/);
  assert.match(source, /layer\.bindTooltip/);
  assert.match(source, /layer\.bindPopup/);
});
