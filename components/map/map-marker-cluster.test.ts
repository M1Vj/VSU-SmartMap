import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./map-marker-cluster.tsx", import.meta.url), "utf8");

test("cluster marker wires the accessible icon spec and keyboard activation contract", () => {
  assert.match(source, /getMarkerClusterIconSpec/);
  assert.match(source, /isMarkerClusterActivationKey\(original\.key\)/);
  assert.match(source, /original\.preventDefault\(\)/);
  assert.match(source, /expand\(\)/);
});

test("cluster activation targets the tested honest fan-out zoom", () => {
  assert.match(source, /MIN_CLUSTER_EXPANSION_ZOOM/);
  assert.match(source, /Math\.max\(\s*MIN_CLUSTER_EXPANSION_ZOOM,\s*currentZoom \+ 2\s*\)/);
});

test("cluster marker names the outer Leaflet focus target", () => {
  assert.match(source, /ref=\{setMarkerRef\}/);
  assert.match(source, /setAttribute\("role",\s*"button"\)/);
  assert.match(source, /setAttribute\("aria-label",/);
});
