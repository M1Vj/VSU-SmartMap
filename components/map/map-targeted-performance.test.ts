import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plain map taps are owned by Leaflet map clicks, not duplicate document or touch listeners", async () => {
  const source = await readFile(new URL("./map-selection-layer.tsx", import.meta.url), "utf8");

  assert.match(source, /map\.on\("click", handleMapClick\)/);
  assert.match(source, /event\.originalEvent/);
  assert.doesNotMatch(source, /document\.addEventListener\("click"/);
  assert.doesNotMatch(source, /addEventListener\("touch(start|end)"/);
});

test("marker pointer/touch compatibility clicks are deduplicated without suppressing keyboard activation", async () => {
  const source = await readFile(new URL("./map-marker.tsx", import.meta.url), "utf8");

  assert.match(source, /lastPointerTapRef/);
  assert.match(source, /shouldSuppressCompatibilityActivation/);
  assert.match(source, /sourceCapabilities\?\.firesTouchEvents/);
  assert.match(source, /pointerdown/);
  assert.match(source, /touchstart/);
  assert.match(source, /click: handleMarkerTap/);
  assert.match(source, /keydown:/);
});

test("route replacement does not clear the rendered path before a replacement result exists", async () => {
  const [coordinator, page] = await Promise.all([
    readFile(new URL("../../lib/navigation/route-request-coordinator.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(coordinator, /if \(options\.resolve\) \{/);
  assert.doesNotMatch(coordinator, /callbacks\.clear\(\);\n\s*\n\s*const isSuccessAnnounced/);
  assert.match(coordinator, /hasPublishedResult/);
  assert.doesNotMatch(page, /<NavigationLayer\s+key=\{/);
  assert.doesNotMatch(page, /setAvailableRoutes\(\[\]\);\n\s*\}, \[navEnd/);
});

test("mobile route actions use measured mini-card clearance and retain 44px targets", async () => {
  const [page, card, facility, boarding] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./map-bottom-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("./map-popup-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("./boarding-house-map-popup-card.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /--map-mini-card-height/);
  assert.match(page, /bottom-\[calc\(6\.5rem\+var\(--map-mini-card-height\)/);
  assert.match(page, /data-route-status="true"/);
  assert.match(page, /data-route-action-dock="true"/);
  const dockStart = page.indexOf('data-route-action-dock="true"');
  assert.ok(dockStart > 0);
  assert.match(page.slice(0, dockStart), /Use my location/);
  assert.doesNotMatch(page.slice(dockStart), /Use my location|Start from main gate/);
  assert.match(page.slice(dockStart), /primaryActionLabel/);
  assert.match(page.slice(dockStart), /Report Route/);
  assert.match(card, /ResizeObserver/);
  assert.match(card, /onHeightChange/);
  assert.match(card, /onHeightChange\(0\)/);
  assert.match(card, /observer\.disconnect\(\)/);
  assert.match(facility, /isBottomSheet \? "h-11 w-full/);
  assert.match(boarding, /isBottomSheet \? "h-11 w-full/);
});

test("facility mini-card heading is inert and Details remains the only expansion control", async () => {
  const source = await readFile(new URL("./map-popup-card.tsx", import.meta.url), "utf8");

  assert.match(source, /<h3[\s\S]*facility\.name/);
  assert.doesNotMatch(source, /<h3[^>]*onClick/);
  assert.doesNotMatch(source, /<h3[^>]*>\s*<Button/);
  assert.match(source, /onClick=\{onViewDetails\}/);
});
