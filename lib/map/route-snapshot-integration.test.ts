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
});

test("selection gateway keeps its seen activation set across parent rerenders", async () => {
  const source = await readFile(new URL("../../components/map/map-selection-layer.tsx", import.meta.url), "utf8");
  assert.match(source, /class InteractionCallbackRegistry/);
  assert.match(source, /useIsomorphicLayoutEffect/);
  assert.match(source, /const \[interactionGateway\] = useState\(/);
  assert.match(source, /createInteractionGateway/);
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
  assert.match(selectionSource, /const handleMarkerDirections = useCallback/);
  assert.match(markersSource, /export const MapMarkers = memo\(/);
  assert.match(markerSource, /export const MapMarker = memo\(/);
});
