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
  assert.match(source, /resolveMarkerActivation/);
  assert.match(source, /sourceCapabilities\?\.firesTouchEvents/);
  assert.match(source, /pointerdown/);
  assert.match(source, /touchstart/);
  assert.match(source, /click: handleMarkerTap/);
  assert.match(source, /keydown:/);
  assert.match(source, /const activateMarker =/);
  assert.match(source, /activateMarker\(now, "keyboard"\)/);
  assert.match(source, /suppressNextKeyboardClickRef/);
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
  assert.match(card, /const useIsomorphicLayoutEffect/);
  assert.match(card, /typeof window === "undefined"[\s\S]*useEffect[\s\S]*useLayoutEffect/);
  assert.match(card, /useIsomorphicLayoutEffect\(\(\) =>/);
  assert.match(card, /reportHeight\(\);\s*const observer/);
  assert.match(card, /onHeightChange/);
  assert.match(card, /onHeightChange\?\.\(0\)/);
  assert.match(card, /observer\?\.disconnect\(\)/);
  assert.match(card, /return resetHeightAndMetric/);
  assert.match(facility, /isBottomSheet \? "h-11 w-full/);
  assert.match(boarding, /isBottomSheet \? "h-11 w-full/);
});

test("route reports and destination markers stay coupled to the committed route during replacement", async () => {
  const [page, routeState, navigation] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../lib/navigation/route-commit-state.ts", import.meta.url), "utf8"),
    readFile(new URL("./navigation-layer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const committedRoute = routeCommitState\.committed/);
  assert.match(page, /const routeFacingDestination = getRouteFacingDestination/);
  assert.match(page, /destination=\{routeFacingDestination\}/);
  assert.match(page, /hasDestination: Boolean\(routeFacingDestination\)/);
  assert.match(page, /routeDestinationId=\{committedRoute\?\.destinationId \?\? null\}/);
  assert.match(page, /destinationId: committedRoute\?\.destinationId \?\? null/);
  assert.match(page, /start: committedRoute\?\.start \?\? null/);
  assert.match(page, /end: committedRoute\?\.end \?\? null/);
  assert.match(page, /totalDistanceMeters: committedRoute\?\.route\.totalDistance \?\? null/);
  assert.match(routeState, /beginRouteRequest/);
  assert.match(routeState, /failRouteRequest/);
  assert.match(routeState, /!state\.pending \|\| !routeContextsEqual/);
  assert.match(navigation, /onRouteRequest\?:/);
  assert.match(navigation, /onRouteRequestFailed\?:/);
  assert.match(navigation, /onRoutesFound\?\.\(\[result\], context\)/);
  assert.match(navigation, /preservePublishedResult: Boolean\(startPoint \|\| endPoint \|\| destinationId\)/);
});

test("selection transitions retain route owners and atomically cancel a replacement", async () => {
  const [page, transition, routeState, navigation] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../lib/navigation/selection-route-transition.ts", import.meta.url), "utf8"),
    readFile(new URL("../../lib/navigation/route-commit-state.ts", import.meta.url), "utf8"),
    readFile(new URL("./navigation-layer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(transition, /resolveRouteSelectionTransition/);
  assert.match(transition, /routeState\.committed/);
  assert.match(transition, /routeState\.pending/);
  assert.match(page, /flowDestinationId: targetFacilityId \?\? null/);
  assert.match(page, /if \(transition\.kind === "cancel-replacement"\)/);
  assert.match(page, /cancelRouteReplacementAndRestore\(transition\.restoreContext\)/);
  assert.match(page, /const handleMapItemSelect = useCallback/);
  assert.match(page, /onSelect=\{handleMapItemSelect\}/);
  assert.match(page, /setNavigationSessionId\(\(sessionId\) => sessionId \+ 1\)/);
  assert.match(page, /setTargetFacilityId\(context\.destinationId \?\? undefined\)/);
  assert.match(page, /setNavStart\(context\.start/);
  assert.match(page, /setNavEnd\(context\.end/);
  assert.match(page, /setNavigationOrigin\(context\.origin\)/);
  assert.match(page, /setNavMode\(context\.mode\)/);
  assert.match(page, /setRouteCommitState\(\(state\) => beginRouteRequest\(state, context\)\)/);
  const failureHandlerStart = page.indexOf("const handleRouteRequestFailed");
  const failureHandlerEnd = page.indexOf("const claimRouteFoundAnnouncement", failureHandlerStart);
  assert.ok(failureHandlerStart >= 0 && failureHandlerEnd > failureHandlerStart);
  assert.doesNotMatch(page.slice(failureHandlerStart, failureHandlerEnd), /setTargetFacilityId/);
  assert.match(page, /cancelMapPerformance\("route_calculation"\)/);
  assert.match(routeState, /cancelPendingRouteReplacement/);
  assert.match(navigation, /sessionId: navigationSessionId/);
  assert.match(navigation, /if \(startedAt !== null && !signal\.aborted\)/);
});

test("restoring a committed route retires the replacement without starting another request", async () => {
  const [page, navigation, coordinator] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./navigation-layer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../lib/navigation/route-request-coordinator.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /canReuseCommittedRoute/);
  assert.match(page, /reuseCommittedRoute=\{shouldReuseCommittedRoute\}/);
  assert.match(navigation, /reuseCommittedRoute\?: boolean/);
  assert.match(
    navigation,
    /if \(reuseCommittedRoute\) \{[\s\S]*?preservePublishedResult: true,[\s\S]*?return coordinator\.start/,
  );
  assert.doesNotMatch(
    navigation.match(/if \(reuseCommittedRoute\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? "",
    /resolve:/,
  );
  assert.match(coordinator, /if \(active\) cancel\(active/);
  assert.match(coordinator, /options\.resolve === undefined/);
});

test("failed replacements restore committed inputs and render only the parent-owned route", async () => {
  const [page, navigation] = await Promise.all([
    readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./navigation-layer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const \[routeDestinationId, setRouteDestinationId\]/);
  assert.match(page, /onRouteRequestFailed=\{handleRouteRequestFailed\}/);
  assert.match(page, /restoreCommittedRouteContext/);
  assert.match(page, /restoreCommittedRouteContext\(transition\.restoreContext, false\)/);
  assert.match(page, /context\.start/);
  assert.match(page, /context\.end/);
  assert.match(page, /setNavigationOrigin\(context\.origin\)/);
  assert.match(page, /setNavMode\(context\.mode\)/);
  assert.match(page, /if \(navStart\?\.lat === routeStart\.lat && navStart\.lng === routeStart\.lng\) return/);
  assert.match(page, /displayedRoute=\{committedRoute\?\.route \?\? null\}/);
  assert.match(page, /destinationId=\{routeDestinationId\}/);
  assert.match(navigation, /displayedRoute\?: PathResult \| null/);
  assert.doesNotMatch(navigation, /const \[path, setPath\] = useState/);
  assert.doesNotMatch(navigation, /setPath\(result\)/);
  assert.match(navigation, /if \(!displayedRoute\) return null/);
  assert.match(navigation, /displayedRoute\.path\.map/);
  assert.match(navigation, /onRouteRequestFailed\?\.\(requestContextStore\.current\)/);
});

test("facility mini-card heading is inert and Details remains the only expansion control", async () => {
  const source = await readFile(new URL("./map-popup-card.tsx", import.meta.url), "utf8");

  assert.match(source, /<h3[\s\S]*facility\.name/);
  assert.doesNotMatch(source, /<h3[^>]*onClick/);
  assert.doesNotMatch(source, /<h3[^>]*>\s*<Button/);
  assert.match(source, /onClick=\{onViewDetails\}/);
});
