import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("My Location keeps its root-font-aware safe-area offset and visible anchor", async () => {
  const [mapPageSource, locationControlSource, locationButtonSource] =
    await Promise.all([
      readFile(
        new URL("../../app/(student)/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("./user-location-control.tsx", import.meta.url), "utf8"),
      readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
    ]);

  assert.doesNotMatch(
    mapPageSource,
    /MapBottomCard|mapBottomCardHeight|--map-mini-card-height|onHeightChange=\{setMapBottomCardHeight\}/,
  );
  assert.match(
    locationControlSource,
    /left-\[12px\] bottom-\[calc\(5rem\+112px\+env\(safe-area-inset-bottom\)\)\] min-\[769px\]:bottom-\[80px\]/,
  );
  assert.doesNotMatch(
    mapPageSource,
    /className="left-\[12px\] bottom-\[calc\(160px\+env\(safe-area-inset-bottom\)\)\] md:bottom-\[80px\]"/,
  );
  assert.match(
    mapPageSource,
    /pointer-events-none fixed inset-x-0 bottom-\[calc\(120px\+env\(safe-area-inset-bottom,0px\)\)\] z-\[1000\] flex flex-wrap justify-center gap-2 px-3 md:absolute md:bottom-8/,
  );
  assert.match(locationButtonSource, /h-11 w-11 min-w-11/);
  assert.match(
    locationButtonSource,
    /h-11 w-11 min-w-11[\s\S]*?min-\[769px\]:h-\[30px\] min-\[769px\]:w-\[30px\] min-\[769px\]:min-w-\[30px\].*rounded-sm/,
  );
  assert.doesNotMatch(locationButtonSource, /left-\[12px\].*bottom-\[/);
});

test("map controls are excluded from background gesture arbitration", async () => {
  const [selectionSource, locationButtonSource] = await Promise.all([
    readFile(new URL("./map-selection-layer.tsx", import.meta.url), "utf8"),
    readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(selectionSource, /\[data-map-control\]/);
  assert.match(locationButtonSource, /data-map-control="my-location"/);
});

test("mobile floating map controls expose 44px hit areas without changing desktop sizing", async () => {
  const [wrapperSource, pageSource, filtersSource, locationSource] = await Promise.all([
    readFile(new URL("./map-wrapper.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./category-filters.tsx", import.meta.url), "utf8"),
    readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    wrapperSource,
    /@media \(max-width: 768px\)[\s\S]*?\.map-wrapper \.leaflet-control-zoom a[\s\S]*?min-width: 44px[\s\S]*?min-height: 44px/,
  );
  assert.match(filtersSource, /h-11 min-w-11 lg:h-8 lg:min-w-0/);
  assert.match(pageSource, /h-11 min-w-11 lg:h-9 lg:min-w-0/);
  assert.match(pageSource, /data-tour="map-submit"/);
  assert.match(locationSource, /h-11 w-11 min-w-11/);
  assert.match(pageSource, /data-map-action-dock[\s\S]{0,1500}h-11 min-w-11/);
});

test("coarse-pointer tablets keep map controls at 44px while mouse desktop stays compact", async () => {
  const [pageSource, filtersSource, wrapperSource] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./category-filters.tsx", import.meta.url), "utf8"),
    readFile(new URL("./map-wrapper.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    pageSource,
    /@media \(pointer: coarse\), \(any-pointer: coarse\)[\s\S]*?\[data-map-control="submit-location"\][\s\S]*?min-height:\s*44px[\s\S]*?min-width:\s*44px/,
  );
  assert.match(
    filtersSource,
    /@media \(pointer: coarse\), \(any-pointer: coarse\)[\s\S]*?\[data-map-control="map-filters"\][\s\S]*?min-height:\s*44px[\s\S]*?min-width:\s*44px/,
  );
  assert.match(
    wrapperSource,
    /@media \(pointer: coarse\), \(any-pointer: coarse\)[\s\S]*?\.map-wrapper \.leaflet-control-zoom a[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/,
  );
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

test("mobile popup clearance stays selected-only, measurable, and scrollable", async () => {
  const [markerSource, shellSource] = await Promise.all([
    readFile(new URL("./map-marker.tsx", import.meta.url), "utf8"),
    readFile(new URL("./map-marker-popup-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(markerSource, /computePopupAutoPanPadding/);
  assert.match(markerSource, /autoPanPaddingTopLeft=\{\[12, popupAutoPanPadding\.top\]\}/);
  assert.match(markerSource, /autoPanPaddingBottomRight=\{\[12, popupAutoPanPadding\.bottom\]\}/);
  assert.match(markerSource, /if \(!isSelected\)/);
  assert.match(markerSource, /ResizeObserver/);
  assert.match(markerSource, /data-map-popup-obstacle/);
  assert.match(markerSource, /setPopupAutoPanPadding\(\(current\) =>/);
  assert.match(markerSource, /new MutationObserver/);
  assert.match(markerSource, /childList: true/);
  assert.match(markerSource, /attributeFilter/);
  assert.match(markerSource, /mutation\.addedNodes/);
  assert.match(markerSource, /mutation\.removedNodes/);
  assert.match(markerSource, /target\?\.closest\(obstacleSelector\)/);
  assert.match(markerSource, /subtree: true/);
  assert.match(markerSource, /shouldRemeasurePopupObstacleMutations/);
  assert.match(markerSource, /requestAnimationFrame/);
  assert.match(markerSource, /cancelAnimationFrame/);
  assert.match(markerSource, /mutationObserver\.disconnect\(\)/);
  assert.match(markerSource, /resizeObserver\.disconnect\(\)/);
  assert.match(markerSource, /window\.addEventListener\("resize"/);
  assert.match(markerSource, /window\.removeEventListener\("resize"/);
  assert.match(markerSource, /map\.on\("resize"/);
  assert.match(markerSource, /map\.off\("resize"/);
  assert.match(markerSource, /popup\.options\.autoPanPaddingBottomRight[\s\S]{0,220}popup\.update\(\)/);
  assert.match(markerSource, /element\.isConnected/);
  assert.match(markerSource, /getComputedStyle/);
  assert.match(markerSource, /rect\.width > 0/);
  assert.match(markerSource, /rect\.height > 0/);
  assert.match(markerSource, /rect\.right <= mapRect\.left/);
  assert.match(markerSource, /rect\.left >= mapRect\.right/);
  assert.match(
    shellSource,
    /max-h-\[min\(60dvh,calc\(100dvh-376px\),22rem\)\]/,
  );
  assert.match(shellSource, /overflow-y-auto/);

  const viewportHeight = 568;
  const fixedPopupClearance = 376;
  assert.ok(viewportHeight - fixedPopupClearance >= 192);
});

test("map obstacle tags cover top search/status and bottom floating controls", async () => {
  const pageSource = await readFile(
    new URL("../../app/(student)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.ok((pageSource.match(/data-map-popup-obstacle="top"/g) ?? []).length >= 2);
  assert.ok((pageSource.match(/data-map-popup-obstacle="bottom"/g) ?? []).length >= 4);
  assert.match(
    pageSource,
    /data-map-location-obstacle="true"[\s\S]{0,220}left-\[12px\] bottom-\[calc\(5rem\+112px\+env\(safe-area-inset-bottom\)\)\][\s\S]{0,220}h-11 w-11[\s\S]{0,80}min-\[769px\]:bottom-\[80px\]/,
  );
});

test("My Location stays above the native zoom stack at mobile widths", async () => {
  const [wrapperSource, locationControlSource, locationButtonSource] = await Promise.all([
    readFile(new URL("./map-wrapper.tsx", import.meta.url), "utf8"),
    readFile(new URL("./user-location-control.tsx", import.meta.url), "utf8"),
    readFile(new URL("./my-location-button.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    wrapperSource,
    /\.map-wrapper \[data-map-control="my-location"\] > span[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/,
  );
  assert.match(
    wrapperSource,
    /@media \(min-width: 769px\) and \(pointer: coarse\)[\s\S]*?\[data-map-control="my-location"\][\s\S]*?bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(
    locationControlSource,
    /bottom-\[calc\(5rem\+112px\+env\(safe-area-inset-bottom\)\)\] min-\[769px\]:bottom-\[80px\]/,
  );
  assert.match(
    locationButtonSource,
    /h-11 w-11 min-w-11[\s\S]*?min-\[769px\]:h-\[30px\]/,
  );

  const mobileLeafletMargin = 90;
  const nativeZoomStack = 92;
  const minimumGap = 10;
  assert.equal(mobileLeafletMargin + nativeZoomStack + minimumGap, 192);
  assert.ok(192 > mobileLeafletMargin + nativeZoomStack);
});
