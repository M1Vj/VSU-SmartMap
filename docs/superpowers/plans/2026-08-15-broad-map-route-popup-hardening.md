# Broad Map Route and Popup Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep routes, destination markers, and the basemap spatially synchronized during every zoom frame while replacing the mobile bottom card with a one-tap, marker-anchored, accessible popup.

**Architecture:** Remove every private Leaflet camera driver and use one native Leaflet zoom contract plus a bottom-left native control across all map surfaces. Keep the committed Leaflet route overlay stable, protect runtime-owned marker coordinates at every zoom, and use one Leaflet popup shell for facility and boarding-house quick actions on every viewport. Add an opt-in preview-only evidence probe and Playwright harness for the frame-level and genuine-touch gates that source tests cannot prove.

**Tech Stack:** Next.js 16.2.12, React 19, TypeScript, Leaflet 1.9, MapLibre GL Leaflet adapter, Node test runner with `tsx`, Tailwind CSS, Playwright 1.62.1 using the installed Chrome channel, Vercel preview deployments.

**Approved design:** `docs/superpowers/specs/2026-08-15-broad-map-route-popup-hardening-design.md`

---

## File structure and ownership

- `lib/map/wheel-zoom.ts` — one native Leaflet zoom option contract; no custom animation constants.
- `components/map/leaflet-react.tsx` — add the reusable native `ZoomControl` adapter and keep Leaflet layer wrappers.
- `components/map/map-wrapper.tsx` — public student map basemap and native control.
- `components/map/location-picker-map.tsx` — shared picker map and native control.
- `components/admin/location-preview-map.tsx` — admin preview map and native control.
- `components/admin/navigation/editor-map-content.tsx` — navigation editor map and native control.
- `components/map/smooth-wheel-zoom.tsx` — delete after every consumer is migrated.
- `app/globals.css` — remove the private 30ms zoom transition and define bounded popup presentation.
- `lib/map/declutter.ts` — preserve protected true coordinates at low and high zoom.
- `components/map/map-markers.tsx` — merge runtime-provided protected IDs with compatibility fallbacks.
- `components/map/map-selection-layer.tsx` — forward protected IDs and keep popup actions outside background arbitration.
- `app/(student)/page.tsx` — construct protected IDs from runtime state, remove bottom-card state/rendering, and use fixed safe-area control clearance.
- `lib/navigation/route-endpoint.ts` — pure decision for whether a requested coordinate may be appended after graph routing.
- `components/map/navigation-layer.tsx` — use the endpoint decision, preserve committed-only rendering, and label route layers for evidence.
- `lib/map/popup-close.ts` — pure close-reason rule that prevents stale A-to-B deselection.
- `components/map/map-marker-popup-shell.tsx` — labelled non-modal dialog, custom close button, bounded overflow, and shared popup layout.
- `components/map/map-marker.tsx` — viewport-independent popup lifecycle, focus handling, close-reason guard, and exact-once action wrappers.
- `components/map/map-popup-card.tsx` — compact facility content and 44px actions only.
- `components/map/boarding-house-map-popup-card.tsx` — compact boarding content, semantic Details link, and 44px Navigate action.
- `components/map/map-bottom-card.tsx`, `lib/map/map-card-height.ts`, `lib/map/map-card-height.test.ts`, `components/map/use-is-mobile.ts` — delete after consumer search proves they are unused.
- `lib/map/e2e-probe.ts` — opt-in, preview/local-only spatial and event evidence API; absent without `?mapEvidence=1`.
- `e2e/map-broad-route-popup.spec.ts`, `playwright.config.ts` — repeatable viewport/touch/frame verification.

## Gherkin-to-task map

| Approved behavior/scenario | Automated implementation task | Browser evidence task |
|---|---|---|
| Route stays within 2px: vector and satellite, wheel/pinch/control/double-click/keyboard/programmatic examples | Tasks 1–3 | Task 7, or triggered Task 7B |
| Replacement preserves committed A while B resolves/fails | Task 3 | Task 7 delayed-route state |
| Facility/boarding marker opens one popup by touch/keyboard | Tasks 4–6 | Task 7 center and four-edge fixtures |
| Details and Navigate execute once | Tasks 4–5 | Task 7 correlated event trace |
| Close/Escape preserves active route for destination and another marker | Tasks 4–6 | Task 7 active-route states |
| A-to-B transfer has no intermediate clear | Tasks 4–5 | Task 7 correlated transfer trace |
| Popup actions are not background gestures | Tasks 4–5 | Task 7 correlated input trace |
| One state machine owns idle/acquiring/resolving/active/refreshing/failed/cleared presentation | Existing runtime tests plus Tasks 2–3 | Task 7 state matrix |
| One gateway owns mouse/touch/pen/keyboard compatibility events | Existing gateway tests plus Task 5 | Task 7 real input traces |
| Prepared graph is reused once per authoritative graph revision | Existing route-engine tests plus Task 3 regression run | Not browser-dependent; report automated result |
| Committed overlay stays mounted through location/zoom/selection/replacement | Tasks 2–3 | Task 7 frame and replacement matrix |
| Manual-start candidates stay true-coordinate and actions remain reachable | Tasks 2 and 6 | Task 7 manual-start rows |
| Basemap switching, satellite failure/fallback, reduced motion, rapid zoom, throttled tab, light/dark, and 200% text | Tasks 1–3 and existing basemap tests | Task 7 extended matrix |

Task 8 publishes one row per Gherkin scenario/example with exactly one status: **passed**, **failed**, **blocked**, or **not tested**. A blocked/not-tested hard gate prevents completion rather than being silently omitted.

| Evidence ID | Scenario/example that receives its own result row |
|---|---|
| Z-V-WHEEL | Vector committed route, wheel zoom |
| Z-V-PINCH | Vector committed route, pinch zoom |
| Z-V-CONTROL | Vector committed route, native zoom control |
| Z-V-DBLCLICK | Vector committed route, double-click zoom |
| Z-V-KEYBOARD | Vector committed route, keyboard zoom |
| Z-V-PROGRAMMATIC | Vector committed route, public-API programmatic zoom |
| Z-S-PINCH | Satellite committed route, pinch zoom |
| Z-S-CONTROL | Satellite committed route, native zoom control |
| Z-S-DBLCLICK | Satellite committed route, double-click zoom |
| Z-S-KEYBOARD | Satellite committed route, keyboard zoom |
| Z-S-PROGRAMMATIC | Satellite committed route, public-API programmatic zoom |
| R-REPLACEMENT | Committed A remains while replacement B resolves |
| P-FACILITY-TOUCH | Facility popup opens from one touch |
| P-BOARDING-TOUCH | Boarding popup opens from one touch |
| P-FACILITY-KEYBOARD | Facility popup opens from keyboard |
| P-BOARDING-KEYBOARD | Boarding popup opens from keyboard |
| A-DETAILS | Details opens one full surface and title stays inert |
| A-NAVIGATE | Navigate creates one accepted request/feedback and closes |
| A-CLOSE-DEST | Closing destination popup preserves route |
| A-CLOSE-OTHER | Closing another popup preserves committed A |
| A-TRANSFER | A-to-B popup transfer emits no background clear |
| A-BACKGROUND-GUARD | Close/Details/Navigate are not background gestures |
| B-RUNTIME | One runtime state owns all navigation presentation phases |
| B-GATEWAY | One gateway deduplicates mouse/touch/pen/keyboard compatibility events |
| B-GRAPH | Prepared graph indexes are reused per authoritative revision |
| B-STABILITY | Committed overlay remains mounted through transient updates |

The extended browser ledger separately reports manual-start, failure/fallback, basemap switch, rapid repeated zoom, background-tab throttling, reduced motion, light/dark, and 200% text rows for every viewport where applicable.

### Task 1: Replace private camera animation with native Leaflet zoom

**Dependencies:** approved design only. **Owner/checkpoint:** one zoom-migration worker owns every listed zoom surface and `app/globals.css`; commit, spec review, and code-quality review must pass before Task 2 starts.

**Files:**
- Modify: `lib/map/wheel-zoom.test.ts`
- Modify: `lib/map/wheel-zoom.ts`
- Modify: `components/map/leaflet-react.test.ts`
- Modify: `components/map/leaflet-react.tsx`
- Modify: `components/map/map-wrapper.test.ts`
- Modify: `components/map/map-wrapper.tsx`
- Modify: `components/map/location-picker-map.tsx`
- Modify: `components/admin/location-preview-map.tsx`
- Modify: `components/admin/navigation/editor-map-content.tsx`
- Modify: `app/globals.css`
- Delete: `components/map/smooth-wheel-zoom.tsx`

- [ ] **Step 1: Write the failing native zoom option test**

Replace the smooth-option expectations in `lib/map/wheel-zoom.test.ts` with this exact contract:

```ts
test("map zoom options use Leaflet's supported native input lifecycle", () => {
  assert.deepEqual(MAP_LEAFLET_ZOOM_OPTIONS, {
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    keyboard: true,
    zoomSnap: 0,
    zoomDelta: 0.25,
    wheelDebounceTime: 40,
  });
});

test("private smooth zoom option contracts no longer exist", async () => {
  const source = await readFile(new URL("./wheel-zoom.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /MAP_SMOOTH_(WHEEL|CONTROL)_ZOOM_OPTIONS/);
});
```

Add `readFile` from `node:fs/promises` and remove imports of both smooth option constants.

- [ ] **Step 2: Run the zoom option test and capture RED**

Run:

```bash
rtk proxy node --import tsx --test lib/map/wheel-zoom.test.ts
```

Expected: FAIL because `scrollWheelZoom` is `false`, native input keys are absent, and smooth constants still exist.

- [ ] **Step 3: Implement the native option contract**

Make `lib/map/wheel-zoom.ts` contain only:

```ts
export const MAP_LEAFLET_ZOOM_OPTIONS = {
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
  keyboard: true,
  zoomSnap: 0,
  zoomDelta: 0.25,
  wheelDebounceTime: 40,
} as const;

export const MAP_ZOOM_ANIMATION_OPTIONS = {
  zoomAnimation: true,
  fadeAnimation: true,
  markerZoomAnimation: true,
} as const;
```

- [ ] **Step 4: Write the failing native control and surface tests**

Extend `components/map/leaflet-react.test.ts` with source assertions for:

```ts
assert.match(source, /export function ZoomControl/);
assert.match(source, /L\.control\.zoom\(\{ position \}\)\.addTo\(map\)/);
assert.match(source, /control\.remove\(\)/);
```

Extend `components/map/map-wrapper.test.ts` to read these four surfaces:

```ts
const surfaces = await Promise.all([
  readFile(new URL("./map-wrapper.tsx", import.meta.url), "utf8"),
  readFile(new URL("./location-picker-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../admin/location-preview-map.tsx", import.meta.url), "utf8"),
  readFile(new URL("../admin/navigation/editor-map-content.tsx", import.meta.url), "utf8"),
]);

for (const surface of surfaces) {
  assert.doesNotMatch(surface, /SmoothWheelZoom|SmoothZoomControl|smooth-wheel-zoom/);
  assert.match(surface, /<ZoomControl position="bottomleft" \/>/);
}
```

Also read `app/globals.css` and assert:

```ts
assert.doesNotMatch(css, /\.leaflet-zoom-anim\s+\.leaflet-zoom-animated\s*\{[\s\S]*?transition:/);
```

- [ ] **Step 5: Run the control/surface tests and capture RED**

Run:

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test components/map/leaflet-react.test.ts components/map/map-wrapper.test.ts
```

Expected: FAIL because the native adapter is absent, four surfaces mount private controllers, and the 30ms CSS override remains.

- [ ] **Step 6: Add the native bottom-left control adapter**

Add this component to `components/map/leaflet-react.tsx`:

```tsx
type ZoomControlProps = {
  position?: L.ControlPosition;
};

export function ZoomControl({ position = "topleft" }: ZoomControlProps) {
  const map = useMap();

  useEffect(() => {
    const control = L.control.zoom({ position }).addTo(map);
    return () => control.remove();
  }, [map, position]);

  return null;
}
```

- [ ] **Step 7: Migrate all four surfaces and delete the private controller**

In each surface, import `ZoomControl` from `@/components/map/leaflet-react`, keep `zoomControl={false}` to avoid a duplicate top-left control, and replace both smooth mounts with:

```tsx
<ZoomControl position="bottomleft" />
```

Delete `components/map/smooth-wheel-zoom.tsx`. Remove only this rule from `app/globals.css`:

```css
.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.03s ease-out !important;
}
```

- [ ] **Step 8: Run focused GREEN and prove no private consumer remains**

Run:

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/map/wheel-zoom.test.ts components/map/leaflet-react.test.ts components/map/map-wrapper.test.ts
rtk grep "SmoothWheelZoom\|SmoothZoomControl\|smooth-wheel-zoom" app components lib
rtk proxy rg -F "._move(" app components lib
```

Expected: all focused tests PASS; the search returns no application source hit.

- [ ] **Step 9: Commit the native zoom migration**

```bash
rtk git add app/globals.css components/admin/location-preview-map.tsx components/admin/navigation/editor-map-content.tsx components/map/leaflet-react.test.ts components/map/leaflet-react.tsx components/map/location-picker-map.tsx components/map/map-wrapper.test.ts components/map/map-wrapper.tsx components/map/smooth-wheel-zoom.tsx lib/map/wheel-zoom.test.ts lib/map/wheel-zoom.ts
rtk git commit -m "fix(map): restore native zoom synchronization"
```

### Task 2: Keep runtime-owned markers at true coordinates

**Dependencies:** Task 1 approved. **Owner/checkpoint:** one coordinate-ownership worker owns the listed page/selection/marker/declutter files; commit, spec review, and code-quality review must pass before Task 3.

**Files:**
- Modify: `lib/map/declutter.test.ts`
- Modify: `lib/map/declutter.ts`
- Modify: `components/map/map-markers.test.ts`
- Modify: `components/map/map-markers.tsx`
- Modify: `components/map/map-selection-layer.tsx`
- Modify: `app/(student)/page.tsx`
- Modify: `lib/map/route-snapshot-integration.test.ts`

- [ ] **Step 1: Add high-zoom and boundary RED tests**

Add this matrix to `lib/map/declutter.test.ts`:

```ts
test("protected markers remain at true coordinates in every zoom bucket", () => {
  const source = [
    item("selected", 10.745, 124.792),
    item("committed", 10.7450001, 124.7920001),
    item("pending", 10.7450002, 124.7920002),
    item("nearby", 10.7450003, 124.7920003),
  ];
  const protectedIds = new Set(["selected", "committed", "pending"]);

  for (const zoom of [15, 15.99, 16, 16.01, 19, 20]) {
    const spread = spreadCoLocatedItems(source, zoom, { protectedIds });
    for (const id of protectedIds) {
      const rendered = spread.find(({ item: renderedItem }) => renderedItem.id === id);
      const original = source.find((candidate) => candidate.id === id);
      assert.deepEqual(rendered?.displayCoordinates, original?.coordinates);
    }
  }
});

test("high zoom fans only unprotected members", () => {
  const source = [
    item("protected", 10.745, 124.792),
    item("nearby-a", 10.745, 124.792),
    item("nearby-b", 10.745, 124.792),
  ];
  const spread = spreadCoLocatedItems(source, 19, {
    protectedIds: new Set(["protected"]),
  });
  assert.deepEqual(spread[0].displayCoordinates, source[0].coordinates);
  assert.notDeepEqual(spread[1].displayCoordinates, spread[2].displayCoordinates);
});
```

- [ ] **Step 2: Run the declutter test and capture RED**

```bash
rtk proxy node --import tsx --test lib/map/declutter.test.ts
```

Expected: FAIL because high-zoom fan-out still moves the protected member.

- [ ] **Step 3: Filter protected members before both declutter modes**

In the `for (const group of groups)` loop in `lib/map/declutter.ts`, compute once:

```ts
const declutterableMembers = group.filter(({ item }) => !protectedIds.has(item.id));
```

Use `declutterableMembers` for the low-zoom centroid and high-zoom ordered ring. The high-zoom branch becomes:

```ts
if (declutterableMembers.length < 2) continue;

const centroid = getCentroid(
  declutterableMembers.map(({ item }) => item.coordinates),
);
const orderedGroup = [...declutterableMembers].sort((a, b) =>
  a.item.id.localeCompare(b.item.id),
);
```

Keep output entries for protected members unchanged.

- [ ] **Step 4: Add RED source contracts for runtime ownership**

In `components/map/map-markers.test.ts`, assert that `protectedMarkerIds` is accepted and merged, and in `lib/map/route-snapshot-integration.test.ts`, assert page wiring includes:

```ts
assert.match(pageSource, /runtimeState\.navigation\.committed\?\.destinationId/);
assert.match(pageSource, /runtimeState\.navigation\.request\?\.destinationId/);
assert.match(pageSource, /isManualStartPending[\s\S]*filtered\.forEach/);
assert.match(pageSource, /protectedMarkerIds=\{protectedMarkerIds\}/);
```

- [ ] **Step 5: Construct and propagate the authoritative protected set**

In `app/(student)/page.tsx`, add:

```tsx
const protectedMarkerIds = useMemo(() => {
  const ids = new Set<string>();
  if (runtimeState.selectedItemId) ids.add(runtimeState.selectedItemId);
  const committedDestinationId = runtimeState.navigation.committed?.destinationId;
  const pendingDestinationId = runtimeState.navigation.request?.destinationId;
  if (committedDestinationId) ids.add(committedDestinationId);
  if (pendingDestinationId) ids.add(pendingDestinationId);
  if (isManualStartPending) filtered.forEach((item) => ids.add(item.id));
  return ids;
}, [
  filtered,
  isManualStartPending,
  runtimeState.navigation.committed?.destinationId,
  runtimeState.navigation.request?.destinationId,
  runtimeState.selectedItemId,
]);
```

Add `protectedMarkerIds?: ReadonlySet<string>` to `MapSelectionLayerProps` and `MapMarkersProps`, forward it, and initialize the local set with:

```ts
const ids = new Set(protectedMarkerIds);
```

Keep the existing selected/route/all-marker compatibility additions.

- [ ] **Step 6: Run focused GREEN**

```bash
rtk proxy node --import tsx --test lib/map/declutter.test.ts components/map/map-markers.test.ts lib/map/route-snapshot-integration.test.ts
```

Expected: all tests PASS, including one output item per source item and high-zoom protection.

- [ ] **Step 7: Commit coordinate ownership**

```bash
rtk git add 'app/(student)/page.tsx' components/map/map-selection-layer.tsx components/map/map-markers.test.ts components/map/map-markers.tsx lib/map/declutter.test.ts lib/map/declutter.ts lib/map/route-snapshot-integration.test.ts
rtk git commit -m "fix(map): anchor runtime-owned markers at every zoom"
```

### Task 3: Preserve honest route endpoints and committed-only overlays

**Dependencies:** Task 2 approved. **Owner/checkpoint:** one route-integrity worker owns `NavigationLayer` and route/runtime tests; commit, spec review, and code-quality review must pass before popup work.

**Files:**
- Create: `lib/navigation/route-endpoint.ts`
- Create: `lib/navigation/route-endpoint.test.ts`
- Modify: `components/map/navigation-layer.tsx`
- Modify: `lib/map/route-snapshot-integration.test.ts`
- Modify: `lib/map/map-runtime.test.ts`

- [ ] **Step 1: Write endpoint RED tests**

Create `lib/navigation/route-endpoint.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { shouldAppendRequestedEndpoint } from "./route-endpoint.ts";

test("building routes never fabricate a centroid segment", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: true,
      snappedNodeType: "node",
    }),
    false,
  );
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: true,
      snappedNodeType: "building_entry",
    }),
    false,
  );
});

test("non-building routes retain the requested endpoint", () => {
  assert.equal(
    shouldAppendRequestedEndpoint({
      destinationHasBuildingEntries: false,
      snappedNodeType: "node",
    }),
    true,
  );
});
```

- [ ] **Step 2: Run endpoint tests and capture RED**

```bash
rtk proxy node --import tsx --test lib/navigation/route-endpoint.test.ts
```

Expected: FAIL with missing `route-endpoint.ts`.

- [ ] **Step 3: Implement and wire the pure endpoint rule**

Create `lib/navigation/route-endpoint.ts`:

```ts
export function shouldAppendRequestedEndpoint({
  destinationHasBuildingEntries,
  snappedNodeType,
}: {
  destinationHasBuildingEntries: boolean;
  snappedNodeType: string | null | undefined;
}) {
  return !destinationHasBuildingEntries && snappedNodeType !== "building_entry";
}
```

In `NavigationLayer`, replace `endSnappedToEntry` with:

```ts
const snappedEndNode = preparedGraph.nodeById.get(endNodeId);
const destinationHasBuildingEntries = Boolean(
  targetId && preparedGraph.buildingEntriesById.has(targetId),
);
const appendRequestedEndpoint = shouldAppendRequestedEndpoint({
  destinationHasBuildingEntries,
  snappedNodeType: snappedEndNode?.type,
});
const finalPath = [startNode, ...route.path];
if (appendRequestedEndpoint) finalPath.push(endNode);
```

- [ ] **Step 4: Add committed-overlay and evidence labels**

Set Leaflet layer class names without changing geometry ownership:

```tsx
<Polyline
  positions={committedRoute.path.map((node) => [node.lat, node.lng])}
  pathOptions={{
    className: "map-route-line",
    color: "#3b82f6",
    weight: 5,
    opacity: 0.9,
  }}
/>
```

Add `className: "map-route-start"` and `className: "map-route-end"` to the two `CircleMarker` path options. Extend `route-snapshot-integration.test.ts` to assert `NavigationLayer` still renders only `committedRoute` and never request-local path state.

- [ ] **Step 5: Run focused route/runtime GREEN**

```bash
rtk proxy node --import tsx --test lib/navigation/route-endpoint.test.ts lib/map/map-runtime.test.ts lib/map/route-snapshot-integration.test.ts lib/navigation/navigation-route-resolver.test.ts lib/pathfinding/route-engine.test.ts
```

Expected: all tests PASS; replacement/failure/stale cases retain the committed path and honest endpoint.

- [ ] **Step 6: Commit endpoint integrity**

```bash
rtk git add components/map/navigation-layer.tsx lib/map/map-runtime.test.ts lib/map/route-snapshot-integration.test.ts lib/navigation/route-endpoint.test.ts lib/navigation/route-endpoint.ts
rtk git commit -m "fix(map): preserve honest committed route endpoints"
```

### Task 4: Build the shared accessible popup shell and close-reason rule

**Dependencies:** Task 3 approved. **Owner/checkpoint:** one popup-primitives worker owns both cards, shell, scoped popup CSS, and pure close tests; commit, spec review, and code-quality review must pass before Task 5. This checkpoint approves only reusable primitives and card semantics; Task 5 owns the callback return-type migration, marker lifecycle, focus transfer, exact-once integration, and A-to-B ownership proof.

**Files:**
- Create: `lib/map/popup-close.ts`
- Create: `lib/map/popup-close.test.ts`
- Create: `lib/map/popup-action.ts`
- Create: `lib/map/popup-action.test.ts`
- Create: `components/map/map-marker-popup-shell.tsx`
- Create: `components/map/map-marker-popup-shell.test.tsx`
- Create: `components/map/map-popup-card.test.tsx`
- Create: `components/map/boarding-house-map-popup-card.test.tsx`
- Modify: `components/map/map-popup-card.tsx`
- Modify: `components/map/boarding-house-map-popup-card.tsx`
- Modify: `app/globals.css`
- Modify: `lib/map/map-option-a.test.ts`

- [ ] **Step 1: Write close-reason RED tests**

Create `lib/map/popup-close.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { shouldDeselectAfterPopupClose } from "./popup-close.ts";

test("only a user dismissal of the current selection deselects", () => {
  assert.equal(shouldDeselectAfterPopupClose(true, "dismiss"), true);
  assert.equal(shouldDeselectAfterPopupClose(false, "dismiss"), false);
  assert.equal(shouldDeselectAfterPopupClose(true, "action"), false);
  assert.equal(shouldDeselectAfterPopupClose(true, "selection-transfer"), false);
});
```

- [ ] **Step 2: Run close-reason tests and capture RED**

```bash
rtk proxy node --import tsx --test lib/map/popup-close.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the close-reason rule**

Create `lib/map/popup-close.ts`:

```ts
export type MarkerPopupCloseReason = "dismiss" | "action" | "selection-transfer";

export function shouldDeselectAfterPopupClose(
  isSelected: boolean,
  reason: MarkerPopupCloseReason,
) {
  return isSelected && reason === "dismiss";
}
```

- [ ] **Step 4: Write popup shell RED tests**

Create a server-render test in `components/map/map-marker-popup-shell.test.tsx` using `renderToStaticMarkup`. Assert the markup contains:

```ts
assert.match(markup, /role="dialog"/);
assert.match(markup, /aria-modal="false"/);
assert.match(markup, /aria-label="DASS quick actions"/);
assert.match(markup, /type="button"/);
assert.match(markup, /aria-label="Close DASS popup"/);
assert.match(markup, /data-map-popup-first-control="true"/);
assert.match(markup, /h-11 w-11/);
assert.match(markup, /max-h-/);
assert.match(markup, /overflow-y-auto/);
```

Also call the exported key handler with a fake Escape event and assert `preventDefault`, `stopPropagation`, and `onClose` each run exactly once. A non-Escape key must call none of them.

- [ ] **Step 5: Implement the shared shell**

Create `components/map/map-marker-popup-shell.tsx` with this public interface and structure:

```tsx
type MapMarkerPopupShellProps = {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function handleMapPopupKeyDown(
  event: Pick<React.KeyboardEvent, "key" | "preventDefault" | "stopPropagation">,
  onClose: () => void,
) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  onClose();
}

export function MapMarkerPopupShell({
  label,
  onClose,
  children,
}: MapMarkerPopupShellProps) {
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`${label} quick actions`}
      data-map-control="marker-popup"
      className="relative flex max-h-[min(60vh,22rem)] w-[min(260px,calc(100vw-1.5rem))] flex-col overflow-hidden"
      onKeyDown={(event) => handleMapPopupKeyDown(event, onClose)}
    >
      <button
        type="button"
        aria-label={`Close ${label} popup`}
        data-map-popup-first-control="true"
        onClick={onClose}
        className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}
```

Import `X` from `lucide-react`.

- [ ] **Step 6: Collapse facility and boarding cards to popup-only layouts**

Remove both `layout` props and every bottom-sheet branch. Facility actions become:

```tsx
<div className="flex gap-2">
  <Button
    type="button"
    size="sm"
    variant="outline"
    className="h-11 min-h-11 flex-1 gap-2 text-xs"
    onClick={onViewDetails}
  >
    <Info className="h-3 w-3" aria-hidden />
    Details
  </Button>
  <Button
    type="button"
    size="sm"
    className="h-11 min-h-11 flex-1 gap-2 bg-blue-600 text-xs text-white hover:bg-blue-700"
    onClick={handleDirections}
  >
    <Route className="h-3 w-3" aria-hidden />
    Navigate
  </Button>
</div>
```

Keep both card contracts as `onDirections?: () => void` in this primitives checkpoint so existing callers continue to typecheck. Task 5 atomically changes the complete `MapMarker` → registry → page callback chain to `() => number | null`; a request ID then means the parent accepted a navigation intent, while `null` means the popup remains open. The card does not invent acceptance or progress from a timer.

Give the first header row in both cards `pr-10` so names, badges, and images cannot sit beneath the shell's absolute 44px close control. Keep the action row full width.

Reset Leaflet's default content margin only for this popup class so the shell's viewport width calculation is authoritative:

```css
.map-popup-card .leaflet-popup-content-wrapper {
  max-width: calc(100vw - 1.5rem);
  overflow: hidden;
  border-radius: 0.875rem;
}

.map-popup-card .leaflet-popup-content {
  width: auto !important;
  max-width: calc(100vw - 1.5rem);
  margin: 0;
}
```

Keep the global hidden `.leaflet-popup-close-button` rule because the shell supplies the single visible close control. Extend `map-option-a.test.ts` to assert these two scoped selectors and that no unscoped Leaflet popup width/margin override was added.

Use a production-used pure helper in `lib/map/popup-action.ts` so the same-task guard can be executed under `node:test` without a DOM renderer:

```ts
export type MutableFlag = { current: boolean };

export function runMapPopupActionOnce(
  pending: MutableFlag,
  action: () => void,
) {
  if (pending.current) return false;
  pending.current = true;
  try {
    action();
    return true;
  } finally {
    queueMicrotask(() => {
      pending.current = false;
    });
  }
}
```

Each card keeps one `useRef(false)` and calls `runMapPopupActionOnce(directionsPendingRef, () => onDirections?.())`. Remove the obsolete fake `loading` state. Boarding-house Details remains `<Link href={`/boarding-houses/${listing.slug}`}>`; its Navigate button uses this same guard and 44px contract.

Add render tests for both cards. They must prove that facility Details/Navigate and boarding Navigate are explicit `type="button"` controls with `h-11 min-h-11`, boarding Details remains a semantic link with the same 44px minimum, both header rows reserve `pr-10`, and no `setTimeout` or fake loading state remains. In `popup-action.test.ts`, call the production helper twice synchronously and prove the callback runs once, then prove a later task can run it again. The real browser matrix in Task 7 owns computed-size and 200% text-scale bounds.

- [ ] **Step 7: Run popup unit/source GREEN**

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/map/popup-close.test.ts lib/map/popup-action.test.ts components/map/map-marker-popup-shell.test.tsx components/map/map-popup-card.test.tsx components/map/boarding-house-map-popup-card.test.tsx lib/map/map-option-a.test.ts
```

Expected: all new pure/render tests PASS; title source has no action handler and boarding Details remains a link.

- [ ] **Step 8: Commit the popup primitives**

```bash
rtk git add app/globals.css components/map/boarding-house-map-popup-card.test.tsx components/map/boarding-house-map-popup-card.tsx components/map/map-marker-popup-shell.test.tsx components/map/map-marker-popup-shell.tsx components/map/map-popup-card.test.tsx components/map/map-popup-card.tsx lib/map/map-option-a.test.ts lib/map/popup-action.test.ts lib/map/popup-action.ts lib/map/popup-close.test.ts lib/map/popup-close.ts
rtk git commit -m "feat(map): add accessible anchored popup shell"
```

### Task 5: Unify marker popup lifecycle and exact-once actions

**Dependencies:** Task 4 approved. **Owner/checkpoint:** one popup-lifecycle worker owns `MapMarker`, selection/gateway integration, and selection-route reset behavior; commit, spec review, and code-quality review must pass before Task 6.

**Files:**
- Create: `lib/map/popup-lifecycle.ts`
- Create: `lib/map/popup-lifecycle.test.ts`
- Modify: `components/map/map-marker.tsx`
- Modify: `components/map/map-markers.tsx`
- Modify: `components/map/map-markers.test.ts`
- Modify: `components/map/map-selection-layer.tsx`
- Modify: `app/(student)/page.tsx`
- Modify: `lib/map/interaction-gateway.test.ts`
- Modify: `lib/map/map-option-a.test.ts`
- Modify: `lib/navigation/selection-route-reset.ts`
- Modify: `lib/navigation/selection-route-reset.test.ts`

- [ ] **Step 1: Add lifecycle RED source contracts**

In `lib/map/map-option-a.test.ts`, assert:

```ts
assert.doesNotMatch(markerSource, /if \(isMobile\)[\s\S]{0,100}closePopup/);
assert.doesNotMatch(markerSource, /\{!isMobile && \(/);
assert.match(markerSource, /<MapMarkerPopupShell/);
assert.match(markerSource, /shouldDeselectAfterPopupClose/);
assert.match(markerSource, /selectedRef\.current = isSelected/);
assert.doesNotMatch(markerSource, /marker\.on\("popupclose"/);
assert.match(markerSource, /data-map-popup-first-control/);
assert.match(markerSource, /autoPanPaddingBottomRight/);
```

Extend interaction tests with A-to-B marker activation followed by A popup close and assert the gateway emits marker B once and no background event.

Create a production-used pure controller in `lib/map/popup-lifecycle.ts` and execute it in `popup-lifecycle.test.ts` with fake marker, focus, selection, and background callbacks. The controller owns an open-selection token and close guard; a token resets only after that marker is no longer selected and can therefore reject duplicate callbacks before React commits. Execute these invariants: keyboard open requests first-control focus while pointer open does not; Escape/custom Close delivered twice for the same token closes and dismisses once, returns focus once, and produces zero document/background events; a `defaultPrevented` Escape is ignored by the document-selection predicate; activating B while A is open closes A as `selection-transfer`, opens B once, and emits no deselect/background/route-clear action; Navigate returning `null` leaves the popup open with zero request/feedback/close, while a request ID closes once and forwards that same identity. Deliver a repeated compatibility callback for one physical activation and prove Details/Navigate still invoke once. Task 7 verifies the corresponding DOM focus and physical-input behavior in a real browser.

Add a route-preservation regression to `lib/navigation/selection-route-reset.test.ts`:

```ts
test("dismissing a popup does not infer that an active route should clear", () => {
  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "DASS",
      selectedItemName: null,
      hasNavigationState: true,
    }),
    false,
  );
});
```

- [ ] **Step 2: Run lifecycle tests and capture RED**

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/map/popup-lifecycle.test.ts lib/map/map-option-a.test.ts lib/map/interaction-gateway.test.ts components/map/map-markers.test.ts
```

Expected: FAIL because mobile is gated, the shell is absent, and popup close captures stale `isSelected`.

- [ ] **Step 3: Add the production lifecycle controller and modality ref**

Implement `createMarkerPopupLifecycleController()` in `lib/map/popup-lifecycle.ts` and use that exact controller from `MapMarker`. Its public operations must cover `selectionChanged(isSelected)`, `opened(modality, focusFirstControl)`, `close(reason, effects)`, and `navigate(action, effects)`. `close` returns whether it accepted the close token. `navigate` must acquire its attempt guard before invoking `action: () => number | null`; a synchronous duplicate therefore never invokes the parent callback. A `null` result schedules release of only the attempt guard so a later genuine retry remains possible and does not close; a request ID permanently accepts that open token, forwards the exact ID to its feedback effect, and closes once. The controller, not a React render timing assumption, prevents a second Close/Escape/action callback for the same selected-open token. `selectionChanged(false)` retires that token so a later genuine selection can open and close normally.

In `MapMarker`, keep the latest selection and modality available to the controller:

```ts
const selectedRef = useRef(isSelected);
selectedRef.current = isSelected;
const lastActivationModalityRef = useRef<"mouse" | "touch" | "pen" | "keyboard">("mouse");
```

Record the modality in pointer, compatibility-click, and keyboard activation paths. Route `closePopup(reason)` through the controller with explicit `closePopup`, `onDeselect`, and `restoreMarkerFocus` effects; do not call those effects before the controller accepts the token.

- [ ] **Step 4: Replace the viewport-gated lifecycle**

Remove the `popupclose` listener entirely. Genuine background activation already clears through `MapSelectionLayer`; automatic Leaflet close and A-to-B transfer must never dispatch deselection themselves. Use this selected-only effect:

```ts
useEffect(() => {
  const marker = markerRef.current;
  if (!marker) return;
  marker.closeTooltip();
  if (onMarkerTapOverride) {
    if (marker.isPopupOpen()) closePopup("selection-transfer");
    return;
  }
  if (!isSelected) {
    if (marker.isPopupOpen()) closePopup("selection-transfer");
    return;
  }
  const frameId = requestAnimationFrame(() => {
    marker.openPopup();
  });
  return () => cancelAnimationFrame(frameId);
}, [closePopup, isSelected, onMarkerTapOverride]);
```

The custom close button calls `closePopup("dismiss")` and therefore emits one deselection per selected-open token. Details calls `closePopup("action")`; Navigate calls controller `navigate(() => onDirections?.(item) ?? null, effects)`, which gates the parent callback before invocation and closes only for a non-null accepted request ID. Both preserve selection/navigation ownership. On `popupopen`, close the tooltip and route focus through the controller; only keyboard modality schedules focus for `[data-map-popup-first-control="true"]`:

```ts
popupopen: () => {
  const marker = markerRef.current;
  marker?.closeTooltip();
  if (lastActivationModalityRef.current !== "keyboard") return;
  requestAnimationFrame(() => {
    marker?.getPopup()?.getElement()
      ?.querySelector<HTMLElement>('[data-map-popup-first-control="true"]')
      ?.focus();
  });
},
```

Do not add a `popupclose` listener that infers selection state from a stale render.

Update `shouldClearRouteForMapSearch` so `selectedItemName === null` returns `false`. Popup dismissal may clear selection, but it is not a route-clear intent. A genuine changed search while an item remains selected still clears when its normalized name no longer matches.

- [ ] **Step 5: Render the popup on every viewport and close after actions**

Remove `useIsMobile` and render one `Popup` unconditionally when `onMarkerTapOverride` is absent. Use:

```tsx
<Popup
  offset={[0, -20]}
  className="map-popup-card"
  autoPan
  autoPanPaddingTopLeft={[12, 96]}
  autoPanPaddingBottomRight={[12, 168]}
>
  <MapMarkerPopupShell
    label={accessibleName}
    onClose={() => closePopup("dismiss")}
  >
    {item.kind === "boarding_house" ? (
      <BoardingHouseMapPopupCard
        listing={item.summary}
        onDetails={() => closePopup("action")}
        onDirections={() => popupLifecycle.navigate(
          () => onDirections?.(item) ?? null,
          navigationPopupEffects,
        )}
      />
    ) : (
      <MapPopupCard
        facility={item as unknown as Facility}
        onViewDetails={() => {
          setFacilitySheetOpen(true);
          closePopup("action");
        }}
        onDirections={() => popupLifecycle.navigate(
          () => onDirections?.(item) ?? null,
          navigationPopupEffects,
        )}
      />
    )}
  </MapMarkerPopupShell>
</Popup>
```

Add `onDetails?: () => void` to the boarding card and call it from the Details link's `onClick` before navigation.

Change both popup-card contracts plus `MapMarkerProps`, `MapMarkersProps`, `MapSelectionLayerProps`, and `InteractionCallbackRegistry.directions` to propagate `(item: MapItem) => number | null`; the registry returns `this.onDirections?.(item) ?? null`. In `beginNavigationToItem`, capture the dispatch result and reject mismatched state before mutating persistence/performance state:

```ts
const next = runtime.dispatch({
  type: "navigation/requested",
  requestId,
  destinationId: item.id,
  origin: decision.mode,
  mode: navMode,
  awaitingStart: decision.mode === "manual",
  start: decision.mode === "live"
    ? { lat: decision.start.lat, lng: decision.start.lng }
    : null,
  end,
});
if (
  next.navigation.pendingRequestId !== requestId ||
  next.navigation.request?.destinationId !== item.id
) {
  return null;
}
```

Only after that guard, set the new navigation session and begin performance/persistence work. Both live-start and manual-start accepted branches return `requestId`. Add a test/source contract proving a rejected callback leaves the popup open and an accepted callback closes once with that request identity.

- [ ] **Step 6: Make Escape popup-aware**

Export a pure `shouldHandleMapSelectionEscape({ key, defaultPrevented })` from `popup-lifecycle.ts`, execute it in `popup-lifecycle.test.ts`, and use it from `MapSelectionLayer` so already-handled events are ignored:

```ts
if (event.key === "Escape" && !event.defaultPrevented) {
  onClearSelection?.();
}
```

The popup close handler calls `preventDefault()` and `stopPropagation()` when it owns Escape so the document handler cannot emit a second clear.

- [ ] **Step 7: Run lifecycle GREEN**

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/map/popup-close.test.ts lib/map/popup-lifecycle.test.ts lib/map/interaction-gateway.test.ts lib/map/map-option-a.test.ts components/map/map-markers.test.ts lib/map/pointer-activation.test.ts lib/navigation/selection-route-reset.test.ts
```

Expected: all tests PASS; mobile gate is absent, one popup owns selection, and A-to-B transfer emits no clear.

- [ ] **Step 8: Commit unified popup lifecycle**

```bash
rtk git add 'app/(student)/page.tsx' components/map/boarding-house-map-popup-card.tsx components/map/map-marker.tsx components/map/map-markers.test.ts components/map/map-markers.tsx components/map/map-popup-card.tsx components/map/map-selection-layer.tsx lib/map/interaction-gateway.test.ts lib/map/map-option-a.test.ts lib/map/popup-lifecycle.test.ts lib/map/popup-lifecycle.ts lib/navigation/selection-route-reset.test.ts lib/navigation/selection-route-reset.ts
rtk git commit -m "fix(map): open marker actions on the first tap"
```

### Task 6: Remove the mobile bottom-card path and restore fixed safe-area controls

**Dependencies:** Task 5 approved. **Owner/checkpoint:** one layout-cleanup worker owns page layout, My Location, dead-card deletion, and layout tests; commit, spec review, and code-quality review must pass before evidence harness work.

**Files:**
- Modify: `app/(student)/page.tsx`
- Modify: `components/map/my-location-button.tsx`
- Modify: `components/map/mobile-map-control-layout.test.ts`
- Modify: `lib/map/map-option-a.test.ts`
- Delete: `components/map/map-bottom-card.tsx`
- Delete: `components/map/use-is-mobile.ts`
- Delete: `lib/map/map-card-height.ts`
- Delete: `lib/map/map-card-height.test.ts`

- [ ] **Step 1: Rewrite layout tests to RED against the old bottom card**

Assert in `mobile-map-control-layout.test.ts` and `map-option-a.test.ts`:

```ts
assert.doesNotMatch(pageSource, /MapBottomCard|mapBottomCardHeight|--map-mini-card-height/);
assert.doesNotMatch(pageSource, /onHeightChange=\{setMapBottomCardHeight\}/);
assert.match(pageSource, /bottom-\[calc\(10rem\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(pageSource, /bottom-\[calc\(7\.5rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
assert.match(locationButtonSource, /h-11 w-11 min-w-11/);
assert.doesNotMatch(optionASource, /ResizeObserver|observeMapCardHeight|layout="bottom-sheet"/);
```

- [ ] **Step 2: Run layout tests and capture RED**

```bash
rtk proxy node --import tsx --test components/map/mobile-map-control-layout.test.ts lib/map/map-option-a.test.ts lib/map/map-card-height.test.ts
```

Expected: FAIL because the bottom card, height variable, 30px location button, and helper still exist.

- [ ] **Step 3: Remove page state/rendering and set safe-area positions**

In `app/(student)/page.tsx`:

- remove `MapBottomCard`, `CSSProperties`, `mapBottomCardHeight`, both CSS-variable styles, and the bottom-card render;
- keep `selectedMapItem` because search/route reset announcements still use its name;
- set `UserLocationControl` to:

```tsx
className="left-[12px] bottom-[calc(10rem+env(safe-area-inset-bottom))] md:bottom-[80px]"
```

- set the action dock to:

```tsx
className="pointer-events-none fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] z-[1000] flex flex-wrap justify-center gap-2 px-3 md:absolute md:bottom-8"
```

Keep the selected-item mobile `Submit Location` suppression until the popup browser matrix proves it can coexist without overlap.

- [ ] **Step 4: Enlarge My Location and delete dead files**

Change the mobile target in `my-location-button.tsx` to:

```ts
"h-11 w-11 min-w-11 rounded-full md:bottom-[80px]"
```

Delete the four obsolete files listed above. Run:

```bash
rtk grep "MapBottomCard\|observeMapCardHeight\|map-card-height\|components/map/use-is-mobile\|--map-mini-card-height" app components lib
```

Expected: no application source hit.

- [ ] **Step 5: Run layout GREEN**

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test components/map/mobile-map-control-layout.test.ts lib/map/map-option-a.test.ts components/map/map-markers.test.ts
```

Expected: all tests PASS; action dock and location control remain safe-area-aware with no measured-card dependency.

- [ ] **Step 6: Commit bottom-card removal**

```bash
rtk git add 'app/(student)/page.tsx' components/map/map-bottom-card.tsx components/map/mobile-map-control-layout.test.ts components/map/my-location-button.tsx components/map/use-is-mobile.ts lib/map/map-card-height.test.ts lib/map/map-card-height.ts lib/map/map-option-a.test.ts
rtk git commit -m "refactor(map): replace mobile card with anchored popup"
```

### Task 7: Add opt-in frame and touch evidence harness

**Dependencies:** Tasks 1–6 approved. **Owner/checkpoint:** one evidence worker owns the gated probe, Playwright dependency/config/spec, and probe registrations; commit, spec review, security/privacy cleanup review, and code-quality review must pass before any deployment evidence is accepted.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `lib/map/e2e-probe.ts`
- Create: `lib/map/e2e-probe.test.ts`
- Modify: `components/map/leaflet-react.tsx`
- Modify: `components/map/map-wrapper.tsx`
- Modify: `components/map/navigation-layer.tsx`
- Modify: `components/map/map-marker.tsx`
- Modify: `components/map/map-selection-layer.tsx`
- Create: `e2e/map-broad-route-popup.spec.ts`

- [ ] **Step 1: Verify and install the pinned browser harness dependency**

Run the provenance check:

```bash
rtk proxy npm view @playwright/test@1.62.1 version license dist.unpackedSize --json
```

Expected: version `1.62.1`, license `Apache-2.0`, unpacked package size `28544` bytes. Then install without downloading a browser binary:

```bash
rtk proxy npm install --save-dev @playwright/test@1.62.1
```

Use the installed Chrome channel; do not run `playwright install`.

- [ ] **Step 2: Write probe RED tests**

Create `lib/map/e2e-probe.test.ts` that imports the probe module with no browser global and asserts:

```ts
assert.equal(isMapEvidenceEnabled("https://example.com/?mapEvidence=1"), false);
assert.equal(isMapEvidenceEnabled("http://localhost:3000/?mapEvidence=1"), true);
assert.equal(
  isMapEvidenceEnabled("https://vsu-smartmap-git-perf-map-broad-rewrite.example.vercel.app/?mapEvidence=1"),
  true,
);
assert.equal(
  isMapEvidenceEnabled("https://vsu-smartmap-git-perf-map-broad-rewrite-attacker.example.com/?mapEvidence=1"),
  false,
);
assert.equal(isMapEvidenceEnabled("http://localhost:3000/"), false);
```

Add a bounded event-buffer test proving more than 100 events retains only the latest 100 and only numeric/string enum fields are recorded.

Add pure geometry tests for exported `sampleScreenPolyline(points, maxSamples)` and `getSymmetricPolylineError(expected, rendered)`: identical multi-segment paths return `0`, a path translated by 3px returns `3`, and a rendered path with matching endpoints but a 5px middle bow returns at least `5`. This prevents endpoint-only evidence from passing.

- [ ] **Step 3: Implement the gated evidence registry**

Create `lib/map/e2e-probe.ts` with these exported contracts:

```ts
export type MapEvidenceEventName =
  | "marker-activation"
  | "background-activation"
  | "popup-open"
  | "popup-close"
  | "details"
  | "navigate"
  | "route-request"
  | "navigation-feedback";

export type MapFrameSample = {
  at: number;
  routeVisible: boolean;
  routeErrorPx: number | null;
  destinationErrorPx: number | null;
  rendererErrorPx: number | null;
};

export function isMapEvidenceEnabled(url: string) {
  const parsed = new URL(url);
  const localHost =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  const broadPreview =
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(".vercel.app") &&
    parsed.hostname.startsWith("vsu-smartmap-git-perf-map-broad-rewrite-");
  const allowedHost = localHost || broadPreview;
  return allowedHost && parsed.searchParams.get("mapEvidence") === "1";
}
```

The module also exports these exact integration functions:

```ts
export function initializeMapEvidence(url: string): () => void;
export function registerLeafletMapForEvidence(map: LeafletMap): () => void;
export function registerMapLibreForEvidence(map: MapLibreMap): () => void;
export function registerRouteForEvidence(input: {
  map: LeafletMap;
  polyline: LeafletPolyline;
  path: readonly { lat: number; lng: number }[];
}): () => void;
export function registerDestinationMarkerForEvidence(marker: LeafletMarker): () => void;
export function recordMapEvidenceEvent(
  name: MapEvidenceEventName,
  correlation?: string | number,
  modality?: "mouse" | "touch" | "pen" | "keyboard",
): void;
export async function waitForMapEvidenceRouteDelay(signal: AbortSignal): Promise<void>;
export function sampleScreenPolyline(
  points: readonly { x: number; y: number }[],
  maxSamples?: number,
): { x: number; y: number }[];
export function getSymmetricPolylineError(
  expected: readonly { x: number; y: number }[],
  rendered: readonly { x: number; y: number }[],
): number;
```

The module stores registered Leaflet map, MapLibre map, route polyline/path, route-destination marker, a maximum 100-event buffer, frame samples, and an E2E-only route delay. It maps every raw activation/request correlation to a session-local increasing integer before storage; the public event record exposes only `{ sequence, name, correlationOrdinal, modality }` and never exposes item IDs, raw request IDs, coordinates, URLs, or user data. `initializeMapEvidence` is the sole global-lifecycle owner: it installs `window.__VSU_MAP_E2E__` only when `isMapEvidenceEnabled(url)` is true, is idempotent for React Strict Mode, and its final cleanup cancels RAF/timers, clears every layer/map reference, correlation map, and buffer, and deletes the global only when it still points to the same API object. Registration cleanups clear only the exact matching object they installed. Its public methods are `snapshot()`, `events()`, `reset()`, `startFrameProbe()`, `stopFrameProbe()`, `setRouteDelayMs(number)`, and `zoomTo(number)`. `waitForMapEvidenceRouteDelay` uses an abort-aware timer, removes its abort listener on settle, and resolves immediately when the probe is disabled or its delay is zero.

Add lifecycle tests which install against an isolated fake `window`, start a fake RAF and delayed route, then call cleanup and assert the global, RAF, timer, map/layer references, and listeners are gone. Restore `window`, `globalThis`, RAF, cancelRAF, timers, and `matchMedia` in `test.afterEach`, even when an assertion fails.

- [ ] **Step 4: Register real map layers without changing default behavior**

Mount one `MapEvidenceLifecycle` under `MapContainer`; it calls `initializeMapEvidence(window.location.href)` and registers its `useMap()` result in one effect. Register the MapLibre map inside `OpenFreeMapVectorLayer` immediately after `getMaplibreMap()` and dispose that exact registration before removing the layer. Use cleanup-returning registration calls:

```ts
useEffect(() => registerLeafletMapForEvidence(map), [map]);
useEffect(() => registerMapLibreForEvidence(mapLibreMap), [mapLibreMap]);
useEffect(
  () => registerRouteForEvidence({ map, polyline, path: committedRoute.path }),
  [committedRoute.path, map, polyline],
);
useEffect(
  () => {
    if (!isRouteDestination) return;
    const marker = markerRef.current;
    if (!marker) return;
    return registerDestinationMarkerForEvidence(marker);
  },
  [isRouteDestination],
);
```

`registerDestinationMarkerForEvidence` is used only by the protected facility/boarding `L.Marker`, not by the route-end `L.CircleMarker`. Import `Map as LeafletMap`, `Marker as LeafletMarker`, and `Polyline as LeafletPolyline` from `leaflet`, plus `Map as MapLibreMap` from `maplibre-gl`; declare `Window.__VSU_MAP_E2E__` in this module so application and Playwright types agree.

Forward a ref from `Polyline` in `leaflet-react.tsx` so the probe can read the SVG path. Keep the latest marker activation ID in a ref so its `popup-open` event reuses the same opaque correlation ordinal. When Navigate is accepted, record `navigate`, `route-request`, and `navigation-feedback` with the returned/coordinator request ID; all three public records must share one correlation ordinal. Record Details/Close after a mandatory `events.reset()` baseline in the browser spec. The default URL must not create the global or retain event data.

At the start of the coordinator-owned `resolveRoute` function in `NavigationLayer`, add:

```ts
await waitForMapEvidenceRouteDelay(signal);
```

This makes the replacement-route scenario deterministic only when the opt-in probe sets a delay; the normal route path resolves immediately.

- [ ] **Step 5: Implement frame error sampling**

For each animation frame, compute:

- an expected projected polyline by calling `map.latLngToContainerPoint` for every committed route vertex and subdividing each segment so adjacent samples are at most 16 CSS pixels apart (cap the deterministic sample set at 256 points by increasing the interval when needed);
- a rendered polyline sample set from `SVGPathElement.getPointAtLength` at at most 256 evenly spaced lengths, transformed through `getScreenCTM()` and normalized to the map-container rectangle;
- `routeErrorPx` as the maximum of both nearest-neighbor directions between expected and rendered sample sets (a bounded symmetric Hausdorff approximation), not merely endpoint error;
- expected destination from `map.latLngToContainerPoint(marker.getLatLng())`;
- rendered destination from the marker element's bottom-center anchor;
- renderer alignment from the same coordinate projected by MapLibre and Leaflet.

Set the Leaflet `Polyline` to `smoothFactor={0}` so committed route vertices are not discarded before measurement. Store maximum Euclidean errors in `MapFrameSample`. A missing path, CTM, map, marker, projection, or zero-sample set records `routeVisible: false` plus a typed sample-failure enum rather than a passing `null`. Stop after 600 frames or explicit `stopFrameProbe()` so a failed test cannot leak a RAF loop.

- [ ] **Step 6: Add Playwright configuration and exact matrix tests**

Add this script to `package.json`:

```json
"test:map-e2e": "playwright test e2e/map-broad-route-popup.spec.ts"
```

Configure `playwright.config.ts` to use `process.env.MAP_E2E_BASE_URL`, Chrome channel, one worker, traces on first retry, screenshots on failure, and `.playwright-mcp/map-broad` output. In the spec, loop over:

```ts
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
```

Use `touchscreen.tap` in touch-enabled contexts for facility and `/?boarding=1` markers. Assert exactly one visible `.leaflet-popup`, no bottom card, all popup controls at least 44px on mobile, popup bounds within usable map bounds, Details opens once, Navigate creates one request and feedback event, close/Escape emits no route clear, and A-to-B transfer records no background event.

For keyboard rows, assert `document.activeElement` becomes the shell's first control after Enter/Space and returns to the originating marker after Close/Escape. For pointer rows, assert activation does not force focus into the popup.

For route tests, open the popup, Navigate, choose Main Gate, start the frame probe, then run wheel, CDP pinch, native plus/minus, double-click, keyboard, and probe `zoomTo`. Assert every sampled frame has `routeVisible === true` and every non-null error is `<= 2`. Set a 500ms route delay to verify committed A remains during B replacement.

Implement these explicit matrix loops rather than one representative test:

- route frames: each required viewport × `vector`/`satellite` × wheel, pinch, control, double-click, keyboard, and programmatic zoom (the additional satellite-wheel row is reported separately from the approved minimum examples);
- marker popup: facility and boarding fixtures at center, north, east, south, and west map edges; touch on 320/390/412/768 widths and keyboard on all widths;
- compatibility input: real touch, mouse, CDP pen, and keyboard traces; reset the probe before each physical activation and require one activation/popup/action record with the expected shared correlation ordinal and zero background record;
- state: idle, selected, active route, delayed replacement, failed replacement, manual-start, basemap switch, and forced satellite fallback;
- stress/accessibility: rapid repeated zoom, a second-page background-tab/throttling row, `reducedMotion: "reduce"`, light/dark appearance, and browser text scaling at 200%; use the longest available facility and boarding descriptions and verify body scrolling plus reachable Close/Details/Navigate;
- popup bounds: measure against the map rectangle after header/search, bottom navigation, action dock, and computed safe-area inset; require the arrow/marker anchor and every action target to remain visible with target size at least 44×44 CSS px on touch viewports.

Before Details, Navigate, Close, Escape, and A-to-B transfer, call `window.__VSU_MAP_E2E__.reset()`. After the single physical action, assert the entire event list, not only counts: Details has one `details`; accepted Navigate has one each of `navigate`, `route-request`, and `navigation-feedback` sharing one correlation ordinal; Close/Escape has one `popup-close` and no request/background event; transfer has B activation/open and no background event. If CDP pinch/pen, boarding data, text scaling, or background throttling cannot be exercised, mark its required row BLOCKED and do not declare completion.

- [ ] **Step 7: Prove the probe is absent by default and run local browser RED/GREEN**

Run the Node probe test, build normally, serve it, and verify a default page evaluates `window.__VSU_MAP_E2E__ === undefined`. Then run the instrumented query against the broad preview:

```bash
rtk proxy node --import tsx --test lib/map/e2e-probe.test.ts
MAP_E2E_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1" rtk npm run test:map-e2e
```

Expected: probe unit tests PASS; the normal page exposes no global; every browser matrix row passes or is explicitly reported BLOCKED with the missing fixture/browser capability.

- [ ] **Step 8: Commit the evidence harness**

```bash
rtk git add package.json package-lock.json playwright.config.ts e2e/map-broad-route-popup.spec.ts lib/map/e2e-probe.test.ts lib/map/e2e-probe.ts components/map/leaflet-react.tsx components/map/map-wrapper.tsx components/map/navigation-layer.tsx components/map/map-marker.tsx components/map/map-selection-layer.tsx
rtk git commit -m "test(map): add route and popup browser evidence"
```

### Task 7B: Conditionally move the vector route into MapLibre when the native gate fails

**Dependencies:** Task 7 approved and trigger reproduced. **Owner/checkpoint:** one renderer worker owns the MapLibre context/layer plus `NavigationLayer` renderer split; commit, spec review, adversarial architecture review, and code-quality review must pass before Task 8.

**Trigger:** Any clean vector row with `routeVisible === false`, a typed missing-sample failure, or `routeErrorPx`/`rendererErrorPx` above `2.0` immediately BLOCKS release. Rerun that exact method and viewport at the same SHA after clearing cache and restarting the context. Two consecutive failures of the same row trigger this task. A pass after a failure does not erase the block until the same row produces two consecutive passes at that SHA. If the complete native matrix produces two consecutive passes, mark this task **not triggered** with both run artifacts; do not add a second renderer speculatively.

**Files when triggered:**
- Create: `components/map/maplibre-map-context.tsx`
- Create: `components/map/maplibre-route-layer.tsx`
- Create: `components/map/maplibre-route-layer.test.ts`
- Modify: `components/map/map-wrapper.tsx`
- Modify: `components/map/navigation-layer.tsx`
- Modify: `lib/map/e2e-probe.ts`
- Modify: `lib/map/e2e-probe.test.ts`
- Modify: `e2e/map-broad-route-popup.spec.ts`

- [ ] **Step 1: Capture the two-run native failure before renderer work**

Run the vector route matrix twice against the same exact implementation SHA and record both failing maxima:

```bash
MAP_E2E_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1" rtk npm run test:map-e2e -- --grep "vector route frame alignment"
MAP_E2E_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1" rtk npm run test:map-e2e -- --grep "vector route frame alignment"
```

Expected trigger output: both commands identify the same visibility, sample, or `>2.0` CSS-pixel failure for the same row. A one-off failure blocks release and starts the bounded rerun audit; it does not by itself authorize the architectural fallback.

- [ ] **Step 2: Write the MapLibre renderer RED contract**

Create `components/map/maplibre-route-layer.test.ts` as a source/contract test asserting:

```ts
assert.match(contextSource, /createContext<MapLibreMap \| null>/);
assert.match(wrapperSource, /onMapReady=\{setVectorMap\}/);
assert.match(wrapperSource, /MapLibreMapProvider value=\{vectorMap\}/);
assert.match(layerSource, /type: "geojson"/);
assert.match(layerSource, /type: "line"/);
assert.match(layerSource, /line-join": "round"/);
assert.match(layerSource, /line-cap": "round"/);
assert.match(layerSource, /setData\(routeFeatureCollection\)/);
assert.match(layerSource, /removeLayer/);
assert.match(layerSource, /removeSource/);
assert.match(navigationSource, /mapLibreMap \? \(/);
```

Run:

```bash
rtk proxy node --import tsx --test components/map/maplibre-route-layer.test.ts
```

Expected: FAIL because the context and renderer do not exist.

- [ ] **Step 3: Add one vector-map context with explicit lifetime**

`components/map/maplibre-map-context.tsx` owns `MapLibreMapProvider` and `useMapLibreMap`. Change `OpenFreeMapVectorLayer` to accept `onMapReady(map: MapLibreMap | null)`, call it with the adapter map immediately after creation, and call it with `null` before layer cleanup. `MapWrapper` stores `vectorMap` and wraps only its map children:

```tsx
<MapLibreMapProvider value={vectorMap}>
  {children}
</MapLibreMapProvider>
```

Satellite mode never creates a vector map and therefore keeps `value={null}`.

- [ ] **Step 4: Render the committed vector route as one GeoJSON source**

Implement `MapLibreRouteLayer({ route }: { route: PathResult })`. Its feature collection contains one `LineString` using `[node.lng, node.lat]` coordinates and two `Point` features for start/end. When the style is ready, add source `vsu-navigation-route` and layers `vsu-navigation-route-line`, `vsu-navigation-route-start`, and `vsu-navigation-route-end`; on updates call `GeoJSONSource.setData`. Reinstall after `styledata` only when the source is absent. Cleanup removes the listener, then existing layers in reverse order, then the source.

Use these route paint/layout values to preserve the approved visual:

```ts
layout: { "line-join": "round", "line-cap": "round" },
paint: { "line-color": "#3b82f6", "line-width": 5, "line-opacity": 0.9 },
```

Start/end circle layers use radius `6` with green/red fill and stroke. In `NavigationLayer`, first import `Polyline as LeafletPolyline` from `leaflet` and extract the existing committed Leaflet fragment into a module-local `LeafletCommittedRoute({ route }: { route: PathResult })` that owns its declared `useRef<LeafletPolyline | null>`, registers that ref for evidence, renders `smoothFactor={0}`, and retains the `.map-route-line`, `.map-route-start`, and `.map-route-end` classes from Task 3. Then obtain `mapLibreMap = useMapLibreMap()` and render exactly one owner:

```tsx
return mapLibreMap ? (
  <MapLibreRouteLayer route={committedRoute} />
) : (
  <LeafletCommittedRoute route={committedRoute} />
);
```

The Leaflet renderer remains the satellite fallback. Neither branch may read or render a pending route.

- [ ] **Step 5: Extend the evidence probe for the active renderer**

Register the MapLibre route layer IDs and committed path. When the vector renderer is active, project the same bounded all-segment sample set with `mapLibreMap.project`; for every sample query a 2px screen box against `vsu-navigation-route-line` and treat any missing rendered feature as `routeVisible: false`. Compute `rendererErrorPx` as the maximum MapLibre-vs-Leaflet projection distance across that whole sample set, not only the endpoint, and compare the protected destination anchor independently. Do not attempt an SVG measurement in this branch. The sample keeps the same `routeVisible`, `routeErrorPx`, `destinationErrorPx`, and `rendererErrorPx` schema so the browser assertion is unchanged.

- [ ] **Step 6: Run focused and browser GREEN for both basemaps**

```bash
rtk proxy node --import tsx --test components/map/maplibre-route-layer.test.ts lib/map/e2e-probe.test.ts lib/map/route-snapshot-integration.test.ts
MAP_E2E_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1" rtk npm run test:map-e2e -- --grep "route frame alignment"
```

Expected: vector uses exactly one MapLibre source/line and every sampled error is `<= 2.0`; satellite continues using the committed Leaflet overlay and also stays `<= 2.0`. If either mode still exceeds the gate, stop with BLOCK rather than weakening the threshold.

- [ ] **Step 7: Commit the triggered renderer escalation**

```bash
rtk git add components/map/maplibre-map-context.tsx components/map/maplibre-route-layer.test.ts components/map/maplibre-route-layer.tsx components/map/map-wrapper.tsx components/map/navigation-layer.tsx e2e/map-broad-route-popup.spec.ts lib/map/e2e-probe.test.ts lib/map/e2e-probe.ts
rtk git commit -m "fix(map): render vector routes in the basemap renderer"
```

### Task 8: Run complete gates, independent reviews, and update the draft PR

**Dependencies:** Tasks 1–7 approved and Task 7B either approved or explicitly not triggered by two passing native runs. **Owner/checkpoint:** Sol root owns integration, actual-diff inspection, deployment/SHA validation, final Gherkin ledger, and the unmerged draft PR decision.

**Files:**
- Modify only if a failing gate or accepted review finding requires a scoped correction.

- [ ] **Step 1: Run focused affected tests**

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/map/wheel-zoom.test.ts components/map/leaflet-react.test.ts components/map/map-wrapper.test.ts lib/map/declutter.test.ts components/map/map-markers.test.ts lib/navigation/route-endpoint.test.ts lib/map/map-runtime.test.ts lib/map/route-snapshot-integration.test.ts lib/map/popup-close.test.ts components/map/map-marker-popup-shell.test.tsx lib/map/interaction-gateway.test.ts lib/map/pointer-activation.test.ts lib/map/map-option-a.test.ts components/map/mobile-map-control-layout.test.ts lib/map/e2e-probe.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run repository release gates once**

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Expected: every command exits 0. A pre-existing dependency advisory is reported separately and is not silently treated as a code failure or success.

- [ ] **Step 3: Deploy/push only the broad branch and verify the served SHA**

```bash
rtk git status --short --branch
rtk git rev-parse HEAD
rtk git push origin perf/map-broad-rewrite
rtk gh pr view perf/map-broad-rewrite --json number,url,state,isDraft,headRefOid,headRefName,baseRefName,statusCheckRollup
rtk gh pr checks perf/map-broad-rewrite --watch --fail-fast
rtk gh pr checks perf/map-broad-rewrite --json name,state,link
```

Expected: clean tracked worktree, the one open Broad PR remains draft/unmerged, `headRefOid` equals the printed local `HEAD`, and the Vercel check succeeds for that exact SHA. Open the Vercel check's returned `link`, read the deployment-specific preview URL and commit metadata, and require its commit SHA to equal local `HEAD` before using the stable branch alias. A successful older deployment is not acceptable evidence.

- [ ] **Step 4: Run browser evidence against the exact preview**

```bash
MAP_E2E_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app/?mapEvidence=1" rtk npm run test:map-e2e
PERF_BASE_URL="https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app" PERF_WARMUPS=3 PERF_SAMPLES=30 PERF_BUDGET_MS=50 rtk npm run perf:pages
```

Expected: the deployment-specific URL and stable branch alias both serve the just-verified SHA before testing; required matrix rows PASS, no route/marker frame exceeds 2px, exact-once event counts hold, no popup/control overlap appears, and page timing evidence is recorded without claiming causality from noisy samples. If the alias does not resolve to the deployment verified through the Vercel check link, test the deployment-specific URL and BLOCK the alias row.

- [ ] **Step 5: Dispatch parallel independent reviews**

Give separate read-only agents the exact implementation SHA and focused evidence:

- popup/touch/accessibility review;
- route/renderer/declutter review;
- performance/regression review;
- Sol adversarial integration and release-readiness review.

Require each to return PASS, REVISE, or BLOCK with reproducible findings. Read the actual implementation diff at root. Return every accepted finding to the owning implementation lane, rerun only affected focused checks, then rerun one final release gate batch.

- [ ] **Step 6: Update the Broad draft PR without merging**

Update the draft PR body with the exact SHA, preview URL, Gherkin result table, command exit codes, viewport/touch/frame evidence, performance evidence, resolved review findings, residual risks, and rollback instruction: close or revert the PR; no production merge occurred.

Verify:

```bash
rtk gh pr view perf/map-broad-rewrite --json number,url,state,isDraft,headRefOid,body,statusCheckRollup
```

Expected: the Broad PR remains draft and unmerged with evidence for the verified SHA.

---

## Execution decision

Use **subagent-driven development**. Route zoom, declutter, popup primitives, popup lifecycle, bottom-card cleanup, and evidence-harness tasks are executed sequentially when they share files; independent verification and review lanes run in parallel. The Sol root inspects every material diff and retains final integration judgment.
