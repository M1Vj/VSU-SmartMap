import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Option A splits status from a safe-area action dock and lifts both facility and boarding cards", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  const cardSource = await readFile(new URL("../../components/map/map-bottom-card.tsx", import.meta.url), "utf8");
  const facilityPopupSource = await readFile(new URL("../../components/map/map-popup-card.tsx", import.meta.url), "utf8");
  const boardingPopupSource = await readFile(new URL("../../components/map/boarding-house-map-popup-card.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /data-map-status-hud/);
  assert.match(pageSource, /data-map-action-dock/);
  assert.match(pageSource, /pointer-events-none fixed inset-x-0 bottom-\[calc\(6\.5rem\+var\(--map-mini-card-height,0px\)\+1rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.match(pageSource, /--map-mini-card-height/);
  const statusStart = pageSource.indexOf("data-map-status-hud");
  const actionStart = pageSource.indexOf("data-map-action-dock");
  assert.ok(statusStart >= 0 && actionStart > statusStart);
  assert.match(pageSource.slice(statusStart, actionStart), /aria-label="Use my location as route start"/);
  assert.match(pageSource.slice(statusStart, actionStart), /aria-label="Start route from main gate"/);
  assert.match(pageSource, /data-map-action-dock[\s\S]{0,1800}aria-label=\{`\$\{navigationControls\.primaryActionLabel\} navigation`\}/);
  assert.doesNotMatch(pageSource.slice(actionStart), /Use my location as route start/);
  assert.doesNotMatch(pageSource.slice(actionStart), /Start route from main gate/);
  assert.match(pageSource, /data-map-action-dock[\s\S]{0,2400}aria-label="Report route"/);
  assert.equal((pageSource.match(/h-11/g) ?? []).length >= 4, true);
  const dockSource = pageSource.slice(actionStart);
  assert.equal((dockSource.match(/h-11/g) ?? []).length >= 2, true);
  assert.match(dockSource, /pointer-events-auto h-11/);
  assert.match(cardSource, /bottom-\[calc\(7\.25rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.match(cardSource, /ResizeObserver/);
  assert.match(cardSource, /onHeightChange/);
  assert.match(cardSource, /observer\.disconnect\(\)/);
  assert.match(cardSource, /onHeightChange\?\.\(0\)/);
  assert.match(cardSource, /observeMapCardHeight/);
  assert.match(cardSource, /useLayoutEffect/);
  assert.match(cardSource, /role="dialog"/);
  const selectionSource = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(selectionSource, /markMapPerformance\(/);
  assert.match(selectionSource, /"map-ready"/);
  assert.match(facilityPopupSource, /h-11 min-h-11 w-full text-sm/);
  assert.match(boardingPopupSource, /h-11 min-h-11 w-full text-sm/);
});

test("marker adapter forwards pointer identity/modality before Leaflet click compatibility", async () => {
  const markerSource = await readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  assert.match(markerSource, /addEventListener\("pointerdown"/);
  assert.match(markerSource, /addEventListener\("pointerup"/);
  assert.match(markerSource, /pointerId/);
  assert.match(markerSource, /pointerType/);
  assert.match(markerSource, /isPrimaryPointerActivation/);
  assert.match(markerSource, /original\.button/);
  assert.match(markerSource, /compatibilityActivationRef/);
  assert.match(markerSource, /markMapPerformance\([\s\S]{0,120}"marker-activation"/);
});
