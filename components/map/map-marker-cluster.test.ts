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
