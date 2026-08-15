import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile map controls use fixed safe-area offsets with anchored popups", async () => {
  const [mapPageSource, locationButtonSource] =
    await Promise.all([
      readFile(
        new URL("../../app/(student)/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
    ]);

  assert.doesNotMatch(
    mapPageSource,
    /MapBottomCard|mapBottomCardHeight|--map-mini-card-height|onHeightChange=\{setMapBottomCardHeight\}/,
  );
  assert.match(
    mapPageSource,
    /left-\[12px\] bottom-\[calc\(160px\+env\(safe-area-inset-bottom\)\)\] md:bottom-\[80px\]/,
  );
  assert.match(
    mapPageSource,
    /pointer-events-none fixed inset-x-0 bottom-\[calc\(120px\+env\(safe-area-inset-bottom,0px\)\)\] z-\[1000\] flex flex-wrap justify-center gap-2 px-3 md:absolute md:bottom-8/,
  );
  assert.match(locationButtonSource, /h-11 w-11 min-w-11 rounded-full md:bottom-\[80px\]/);
});

test("map controls are excluded from background gesture arbitration", async () => {
  const [selectionSource, locationButtonSource] = await Promise.all([
    readFile(new URL("./map-selection-layer.tsx", import.meta.url), "utf8"),
    readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(selectionSource, /\[data-map-control\]/);
  assert.match(locationButtonSource, /data-map-control="my-location"/);
});

test("selected mobile popups keep Submit Location out of the action surface", async () => {
  const pageSource = await readFile(
    new URL("../../app/(student)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(pageSource, /--map-mini-card-height|mapBottomCardHeight/);
  assert.match(pageSource, /selectedFacility \|\| selectedBoardingHouse/);
  assert.match(pageSource, /hidden md:inline-flex/);
});

test("small mobile popup clearance leaves a usable scrollable surface", async () => {
  const [markerSource, shellSource] = await Promise.all([
    readFile(new URL("./map-marker.tsx", import.meta.url), "utf8"),
    readFile(new URL("./map-marker-popup-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(markerSource, /autoPanPaddingTopLeft=\{\[12, 128\]\}/);
  assert.match(markerSource, /autoPanPaddingBottomRight=\{\[12, 248\]\}/);
  assert.match(
    shellSource,
    /max-h-\[min\(60dvh,calc\(100dvh-376px\),22rem\)\]/,
  );
  assert.match(shellSource, /overflow-y-auto/);

  const viewportHeight = 568;
  const fixedPopupClearance = 376;
  assert.ok(viewportHeight - fixedPopupClearance >= 192);
});
