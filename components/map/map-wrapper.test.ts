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

test("mobile attribution stays above the fixed student navigation", async () => {
  const source = await readMapWrapperSource();

  assert.doesNotMatch(source, /\.leaflet-bottom\.leaflet-right/);
});
