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

test("route fitting reserves fixed mobile navigation and its safe area", async () => {
  const source = await readMapWrapperSource();

  assert.match(source, /function getSafeAreaInsetBottom/);
  assert.match(source, /paddingTopLeft:\s*\[36,\s*36\]/);
  assert.match(source, /paddingBottomRight:\s*\[36,\s*mobileBottomPadding\]/);
  assert.doesNotMatch(source, /padding:\s*\[36,\s*36\]/);
});
