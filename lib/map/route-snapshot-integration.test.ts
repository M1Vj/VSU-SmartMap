import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shouldClearRouteForSelectedItem } from "@/lib/navigation/selection-route-reset";

test("map page presents committed route metadata while a replacement request is pending", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPresentedNavigationSnapshot/);
  assert.match(source, /committedNavigation/);
  assert.match(source, /reportContext/);
  assert.match(source, /routeRequestDestinationId/);
  assert.match(source, /context=\{reportContext\}/);
  assert.match(source, /routeDestinationId/);
  assert.match(source, /selectionDestinationId/);
  assert.match(source, /routeSelectionDestinationId = runtimeState\.navigation\.selectionDestinationId/);
  assert.match(source, /committedRouteDestinationId: committedNavigation\?\.destinationId \?\? null/);
  assert.match(source, /shouldRestoreCommittedRouteForSelectedItem/);
  assert.match(source, /shouldRestoreCommittedRouteForSelectedItem\([\s\S]{0,500}restoreCommittedRoute\(\)/);
  assert.match(source, /onSelect=\{\(item\) => \{[\s\S]{0,700}restoreCommittedRoute\(item\.id\)/);
  assert.match(source, /type: "navigation\/restored"/);
  assert.match(source, /clearMapPerformanceRequest\(pendingRequestId\)/);
  assert.match(source, /const restored = runtime\.dispatch\([\s\S]{0,260}if \(restored === current\) return false;/);
  assert.match(source, /setNavStart\(\s*committed\.start/);
  assert.match(source, /setNavEnd\(\s*committed\.end/);
  assert.match(source, /setNavMode\(committed\.mode\)/);
  assert.match(source, /setNavigationSessionId\(\(sessionId\) => sessionId \+ 1\)/);
  assert.match(source, /canReuseCommittedRoute/);
  assert.match(source, /reuseCommittedRoute=\{shouldReuseCommittedRoute\}/);
  assert.match(source, /destination=\{routeFacingEnd\}/);
  assert.match(source, /hasDestination: Boolean\(routeFacingEnd\)/);
  assert.match(source, /navigationOrigin=\{navigationOrigin\}/);
});

test("pending replacement selection does not clear a committed route", () => {
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-new",
      routeDestinationId: "facility-new",
      committedRouteDestinationId: "facility-old",
      hasNavigationState: true,
    }),
    false,
  );
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-old",
      routeDestinationId: "facility-new",
      committedRouteDestinationId: "facility-old",
      hasNavigationState: true,
    }),
    false,
  );
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "unrelated",
      routeDestinationId: "facility-new",
      committedRouteDestinationId: "facility-old",
      hasNavigationState: true,
    }),
    true,
  );
});

test("route adapter allocates fresh IDs for calculations and forwards metadata", async () => {
  const source = await readFile(new URL("../../components/map/navigation-layer.tsx", import.meta.url), "utf8");
  assert.match(source, /requestStarted: \(requestId\) => onRouteRequestStarted/);
  assert.match(source, /onRouteRequestStarted\?\.\(requestId, requestMetadata\)/);
  assert.doesNotMatch(source, /resolve: resolveRoute,[\s\S]{0,120}requestId: navigationSessionId/);
  assert.doesNotMatch(source, /let requestSignal/);
  assert.match(source, /buildInternalRoute[\s\S]{0,260}signal\?: AbortSignal/);
  assert.match(source, /reuseCommittedRoute\?: boolean/);
  assert.match(source, /if \(!enabled \|\| reuseCommittedRoute\)/);
});

test("selection gateway keeps its seen activation set across parent rerenders", async () => {
  const source = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(source, /class InteractionCallbackRegistry/);
  assert.match(source, /useIsomorphicLayoutEffect/);
  assert.match(source, /const \[interactionGateway\] = useState\(/);
  assert.match(source, /createInteractionGateway/);
});

test("map-ready timing starts at Leaflet readiness and ends after a rendered frame", async () => {
  const source = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(source, /map\.whenReady\(/);
  assert.match(source, /requestAnimationFrame\(/);
  assert.match(source, /cancelAnimationFrame\(/);
});

test("background map interaction has one pointer/compatibility gateway", async () => {
  const source = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(source, /pointerdown/);
  assert.match(source, /pointerup/);
  assert.match(source, /shouldDedupeCompatibilityClick/);
  assert.match(source, /interactionGateway\.dispatch\(\{ type: "background"/);
  assert.doesNotMatch(source, /touchstart/);
  assert.doesNotMatch(source, /touchend/);
});

test("marker rendering keeps activation and direction adapters stable across status rerenders", async () => {
  const selectionSource = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  const markersSource = await readFile(new URL("../../components/map/map-markers.tsx", import.meta.url), "utf8");
  const markerSource = await readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  assert.match(selectionSource, /const handleMarkerActivate = useCallback/);
  assert.match(selectionSource, /const handleMarkerSelect = useCallback/);
  assert.match(selectionSource, /const handleMarkerDirections = useCallback/);
  assert.match(markersSource, /export const MapMarkers = memo\(/);
  assert.match(markerSource, /export const MapMarker = memo\(/);
});
