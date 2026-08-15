import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(source, /const allocateNavigationSessionId = useCallback/);
  assert.match(source, /navigationSessionIdRef\.current \+= 1/);
  assert.match(source, /canReuseCommittedRoute/);
  assert.match(source, /canReuseCommittedRoute\(\{[\s\S]{0,500}origin: navigationOrigin/);
  assert.match(source, /reuseCommittedRoute=\{shouldReuseCommittedRoute\}/);
  assert.match(source, /destination=\{routeFacingEnd\}/);
  assert.match(source, /hasDestination: Boolean\(routeFacingEnd\)/);
  assert.match(source, /navigationOrigin=\{navigationOrigin\}/);
});

test("map page hydrates valid persisted navigation and restores committed metadata after replacement failure", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /persistedDestinationId/);
  assert.match(source, /persistedNavigationMode/);
  assert.match(source, /persistedNavigationOrigin/);
  assert.match(source, /hydratedNavigationRequestRef/);
  assert.match(source, /type: "navigation\/requested"/);
  assert.match(source, /setNavigationRoute\(/);
  assert.match(source, /next\.navigation\.phase === "failed"/);
  assert.match(source, /const committed = next\.navigation\.committed[\s\S]{0,700}setNavigationRoute\([\s\S]{0,500}committed\.destinationId[\s\S]{0,300}committed\.origin/);
  assert.match(source, /runtimeState\.navigation\.phase === "failed"[\s\S]{0,260}runtimeState\.navigation\.error[\s\S]{0,320}role="alert"/);
});

test("map page wires one memoized runtime-owned marker protection set through selection", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  const selectionSource = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /const protectedMarkerIds = useMemo\(\(\) => \{/);
  assert.match(pageSource, /if \(runtimeState\.selectedItemId != null\) ids\.add\(runtimeState\.selectedItemId\);/);
  assert.match(pageSource, /if \(committedNavigation\?\.destinationId != null\) ids\.add\(committedNavigation\.destinationId\);/);
  assert.match(pageSource, /if \(pendingNavigation\?\.destinationId != null\) ids\.add\(pendingNavigation\.destinationId\);/);
  assert.match(pageSource, /if \(isManualStartPending\) \{[\s\S]{0,220}filtered\.forEach\(\(item\) => ids\.add\(item\.id\)\);/);
  assert.match(pageSource, /protectedMarkerIds=\{protectedMarkerIds\}/);
  assert.match(selectionSource, /protectedMarkerIds\?: ReadonlySet<string>;/);
  assert.match(selectionSource, /protectedMarkerIds=\{protectedMarkerIds\}/);
});

test("terminal graph-load failure retires only the exact pending route request", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /navigationGraphError/);
  assert.match(source, /if \(!cachedGraphAvailable\) \{[\s\S]{0,180}setNavigationGraphError/);
  assert.match(source, /handleRouteFailed\(navigationGraphError, requestId\)/);
  assert.match(source, /before\.navigation\.pendingRequestId !== requestId/);
});

test("popup selection and changed search never own committed-route clearing", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /shouldClearRouteForSelectedItem|shouldClearRouteForMapSearch/);
  assert.match(source, /onSelect=\{\(item\) => \{/);
  assert.match(source, /runtime\.dispatch\(\{ type: "selection\/set", itemId: item\.id \}\)/);
  assert.match(source, /debouncedQuery/);
  assert.match(source, /clearRouteState/);

  const selectedHandler = source.slice(source.indexOf("onSelect={(item) => {"), source.indexOf("onDirections="));
  assert.doesNotMatch(selectedHandler, /clearRouteState\(\)/);
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

test("navigation keeps destination geometry honest and renders only the committed route", async () => {
  const source = await readFile(new URL("../../components/map/navigation-layer.tsx", import.meta.url), "utf8");

  assert.match(source, /getRenderableRouteEndpoints,[\s\S]{0,100}shouldAppendRequestedEndpoint[\s\S]{0,100}from "@\/lib\/navigation\/route-endpoint"/);
  assert.match(source, /const snappedEndNode = preparedGraph\.nodeById\.get\(endNodeId\)/);
  assert.match(source, /const destinationHasBuildingEntries = Boolean\(targetId && preparedGraph\.buildingEntriesById\.has\(targetId\)\)/);
  assert.match(source, /shouldAppendRequestedEndpoint\(\{[\s\S]{0,220}destinationHasBuildingEntries[\s\S]{0,220}snappedNodeType: snappedEndNode\?\.type/);
  assert.match(source, /if \(shouldAppendRequestedEndpoint\([\s\S]{0,260}finalPath\.push\(endNode\)/);

  assert.match(source, /if \(!committedRoute\) return null/);
  assert.match(source, /const routeEndpoints = getRenderableRouteEndpoints\(committedRoute\.path\)/);
  assert.match(source, /if \(!routeEndpoints\) return null/);
  assert.match(source, /positions=\{committedRoute\.path\.map/);
  assert.doesNotMatch(source, /positions=\{path\.map/);
  assert.doesNotMatch(source, /committedRoute\.path\[0\]/);
  assert.doesNotMatch(source, /committedRoute\.path\[committedRoute\.path\.length - 1\]/);
  assert.match(source, /center=\{\[routeEndpoints\.start\.lat, routeEndpoints\.start\.lng\]\}/);
  assert.match(source, /center=\{\[routeEndpoints\.end\.lat, routeEndpoints\.end\.lng\]\}/);
  assert.match(source, /className: "map-route-line"/);
  assert.match(source, /className: "map-route-start"/);
  assert.match(source, /className: "map-route-end"/);
});

test("route request identity stays coordinator-owned after calculation starts", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  const coordinatorSource = await readFile(new URL("../../lib/navigation/route-request-coordinator.ts", import.meta.url), "utf8");
  assert.match(coordinatorSource, /requestId: options\.requestId \?\? \+\+nextRequestId/);
  assert.match(coordinatorSource, /callbacks\.requestStarted\?\.\(request\.requestId\)/);
  assert.match(pageSource, /type: "navigation\/requested"[\s\S]{0,260}requestId/);
  assert.match(pageSource, /beginMapPerformanceRequest\(\s*requestId/);
  assert.match(pageSource, /commitMapPerformanceRequest\(requestId\)/);
  assert.match(pageSource, /failMapPerformanceRequest\(requestId\)/);
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
