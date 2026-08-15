import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Option A keeps status and actions clear of the anchored popup surface", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  const facilityPopupSource = await readFile(new URL("../../components/map/map-popup-card.tsx", import.meta.url), "utf8");
  const boardingPopupSource = await readFile(new URL("../../components/map/boarding-house-map-popup-card.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /data-map-status-hud/);
  assert.match(pageSource, /data-map-action-dock/);
  assert.doesNotMatch(pageSource, /MapBottomCard|mapBottomCardHeight|--map-mini-card-height/);
  assert.doesNotMatch(pageSource, /onHeightChange=\{setMapBottomCardHeight\}/);
  assert.match(pageSource, /left-\[12px\] bottom-\[calc\(10rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(pageSource, /pointer-events-none fixed inset-x-0 bottom-\[calc\(7\.5rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
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
  assert.doesNotMatch(pageSource, /ResizeObserver|observeMapCardHeight|layout="bottom-sheet"/);
  const selectionSource = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(selectionSource, /markMapPerformance\(/);
  assert.match(selectionSource, /"map-ready"/);
  assert.match(selectionSource, /map\.whenReady\(/);
  assert.match(selectionSource, /requestAnimationFrame\(/);
  assert.match(facilityPopupSource, /h-11 min-h-11 min-w-\[6\.5rem\] flex-1/);
  assert.match(boardingPopupSource, /h-11 min-h-11 min-w-\[6\.5rem\] flex-1/);
  assert.match(facilityPopupSource, /onDirections\?: \(\) => number \| null;/);
  assert.match(boardingPopupSource, /onDirections\?: \(\) => number \| null;/);
  assert.doesNotMatch(facilityPopupSource, /layout\?:|bottom-sheet/);
  assert.doesNotMatch(boardingPopupSource, /layout\?:|bottom-sheet/);
  assert.doesNotMatch(facilityPopupSource, /<h3[^>]*onClick/);
  assert.doesNotMatch(boardingPopupSource, /<h3[^>]*onClick/);
});

test("marker adapter forwards pointer identity/modality before Leaflet click compatibility", async () => {
  const markerSource = await readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  assert.match(markerSource, /addEventListener\("pointerdown"/);
  assert.match(markerSource, /addEventListener\("pointerup"/);
  assert.match(markerSource, /pointerId/);
  assert.match(markerSource, /pointerType/);
  assert.match(markerSource, /isPrimaryPointerActivation/);
  assert.match(markerSource, /isPrimaryCompatibilityClick/);
  assert.match(markerSource, /original\?\.button/);
  assert.match(markerSource, /compatibilityActivationRef/);
  assert.match(markerSource, /element\.removeEventListener\("pointercancel"/);
  assert.match(markerSource, /lastActivationModalityRef\.current = modality/);
  assert.match(markerSource, /if \(isSelected\) requestPopupOpen\(true\)/);
  assert.match(markerSource, /if \(fromActivation\) \{[\s\S]{0,120}cancelPopupOpen\(\)/);
  assert.match(markerSource, /markMapPerformance\([\s\S]{0,120}"marker-activation"/);
});

test("marker popup lifecycle is viewport-independent and controller-owned", async () => {
  const markerSource = await readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  const selectionSource = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(markerSource, /if \(isMobile\)[\s\S]{0,100}closePopup/);
  assert.doesNotMatch(markerSource, /\{!isMobile && \(/);
  assert.match(markerSource, /<MapMarkerPopupShell/);
  assert.match(markerSource, /shouldDeselectAfterPopupClose/);
  assert.match(markerSource, /selectedRef\.current = isSelected/);
  assert.doesNotMatch(markerSource, /marker\.on\("popupclose"/);
  assert.match(markerSource, /data-map-popup-first-control/);
  assert.match(markerSource, /autoPanPaddingBottomRight/);
  assert.match(markerSource, /closeButton=\{false\}/);
  assert.match(markerSource, /closeOnEscapeKey=\{false\}/);
  assert.match(markerSource, /restoreMarkerFocus: requestMarkerRestoreFocus/);
  assert.match(markerSource, /const requestMarkerRestoreFocus = useCallback\(\(\) => \{[\s\S]{0,700}requestAnimationFrame/);
  assert.match(markerSource, /const requestMarkerRestoreFocus = useCallback\(\(\) => \{[\s\S]{0,700}isConnected/);
  assert.match(markerSource, /const requestMarkerRestoreFocus = useCallback\(\(\) => \{[\s\S]{0,700}markerRef\.current\?\.getElement\(\)/);
  assert.match(markerSource, /const requestMarkerRestoreFocus = useCallback\(\(\) => \{[\s\S]{0,700}element\.focus\(\)/);
  assert.match(markerSource, /const requestPopupOpen = useCallback\(\(fromActivation = false\) => \{[\s\S]{0,500}cancelPopupFocus\(\);[\s\S]{0,120}cancelMarkerRestoreFocus\(\);/);
  assert.match(selectionSource, /shouldHandleMapSelectionEscape\(event\)/);
});

test("navigation closes a popup only after the runtime accepts its intent", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /const next = runtime\.dispatch\(\{[\s\S]{0,500}type: "navigation\/requested"/);
  assert.match(pageSource, /next\.navigation\.pendingRequestId !== requestId/);
  assert.match(pageSource, /next\.navigation\.request\?\.destinationId !== item\.id/);
  assert.match(pageSource, /onDirections=\{\(item\) => beginNavigationToItem\(item\)\}/);
  assert.match(pageSource, /publishNavigationSessionId\(requestId\)/);
  assert.match(pageSource, /return requestId;/);
});

test("popup/search presentation never owns committed-route clearing", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(pageSource, /shouldClearRouteForSelectedItem/);
  assert.doesNotMatch(pageSource, /shouldClearRouteForMapSearch/);
});

test("a rejected pending navigation remains retryable", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");

  assert.match(
    pageSource,
    /const acceptedSessionId = beginNavigationToItem\(pendingNavigationFacility\);[\s\S]{0,180}if \(acceptedSessionId !== null\)[\s\S]{0,100}onPendingNavigationConsumed\(\)/,
  );
});

test("rapid accepted marker intents allocate distinct page session tokens", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /navigationSessionIdRef/);
  assert.match(pageSource, /const allocateNavigationSessionId/);
  assert.match(pageSource, /navigationSessionIdRef\.current \+= 1/);
  assert.match(pageSource, /const requestId = allocateNavigationSessionId\(\)/);
  assert.match(pageSource, /const previousSessionId = navigationSessionIdRef\.current/);
  assert.match(pageSource, /dismissRouteFoundAnnouncement\(previousSessionId\)/);
  assert.doesNotMatch(pageSource, /publishNavigationSessionId\(requestId\);[\s\S]{0,80}dismissRouteFoundAnnouncement\(requestId\)/);
});

test("popup width and margin overrides remain scoped to the popup card", async () => {
  const [css, facilitySource, boardingSource] = await Promise.all([
    readFile(new URL("../../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../components/map/map-popup-card.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../components/map/boarding-house-map-popup-card.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /\.map-popup-card \.leaflet-popup-content-wrapper\s*\{[\s\S]*?max-width:\s*calc\(100vw - 1\.5rem\)/,
  );
  assert.match(
    css,
    /\.map-popup-card \.leaflet-popup-content\s*\{[\s\S]*?margin:\s*0/,
  );
  assert.doesNotMatch(css, /(?:^|\n)\s*\.leaflet-popup-content-wrapper\s*\{/);
  assert.doesNotMatch(css, /(?:^|\n)\s*\.leaflet-popup-content\s*\{/);
  assert.match(facilitySource, /onDirections\?: \(\) => number \| null;/);
  assert.match(boardingSource, /onDirections\?: \(\) => number \| null;/);
  assert.doesNotMatch(facilitySource, /layout\?:|bottom-sheet|isBottomSheet|layout\s*===/);
  assert.doesNotMatch(boardingSource, /layout\?:|bottom-sheet|isBottomSheet|layout\s*===/);
});

test("anchored popup auto-pan and height contracts protect compact mobile viewports", async () => {
  const [markerSource, shellSource] = await Promise.all([
    readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/map/map-marker-popup-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(markerSource, /autoPanPaddingTopLeft=\{\[12, 128\]\}/);
  assert.match(markerSource, /autoPanPaddingBottomRight=\{\[12, 248\]\}/);
  assert.match(
    shellSource,
    /max-h-\[min\(60dvh,calc\(100dvh-23\.5rem\),22rem\)\]/,
  );
  assert.match(shellSource, /min-h-0 overflow-y-auto/);
});
