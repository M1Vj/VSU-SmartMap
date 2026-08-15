# Broad Map Route and Popup Hardening

## Status

Approved product direction for the broad map rewrite. This design is additive to `2026-08-14-broad-map-rewrite-design.md` and supersedes its mobile mini-card presentation for selected facilities and boarding houses. The deployed browser matrix and the Task 7B renderer-trigger decision remain pending; this document does not claim a release pass.

## Goal

Make the broad map feel geographically and interactively trustworthy:

- a committed route must stay attached to the basemap throughout every zoom frame;
- route-mode markers must not jump between declutter positions and true coordinates;
- one marker activation must open one compact popup anchored above that marker on every viewport;
- popup actions must respond on the first activation and execute exactly once;
- facility, boarding-house, manual-start, route-replacement, failure, satellite, and desktop behavior must remain intact.

This work applies only to the broad rewrite branch. It does not modify the targeted candidate and does not authorize a merge.

## Confirmed current behavior and causes

### Renderer synchronization

The committed route is a Leaflet SVG overlay while the default vector basemap is a MapLibre canvas hosted by the MapLibre-Leaflet adapter. The custom smooth-wheel controller advances Leaflet with private `_move` calls. That animation path does not supply the adapter's expected native `zoomanim` lifecycle, so the SVG overlay and MapLibre canvas can render different camera frames temporarily. Hiding or remounting the route would conceal rather than correct the defect.

### Marker coordinate changes

The declutter system protects selected and route-owned markers only below the high-zoom fan-out threshold. At high zoom, an overlapping protected marker may be assigned a display coordinate that differs from its true map coordinate, then snap when the zoom bucket is recomputed. Route and manual-start ownership must protect true coordinates at every zoom.

### Mobile presentation

The marker component intentionally closes and omits Leaflet popups on mobile. A fixed bottom mini-card is rendered elsewhere instead. The approved product choice is Option A: use the compact marker-anchored Leaflet popup on mobile and desktop and remove the mobile bottom-card presentation.

### Action activation

The existing action buttons do not require two clicks by design. The exact first-tap loss can depend on hit testing and event ordering across the fixed card, map capture listeners, and touch compatibility events. Moving the actions into Leaflet's popup interaction boundary removes the fixed-overlay ambiguity, but the result is accepted only after a real touch trace proves one physical activation invokes one callback.

## User experience contract

### One anchored popup

- A single facility or boarding-house marker activation opens one compact popup above that marker on mobile, tablet, and desktop.
- The mobile bottom mini-card is removed, not retained as a parallel or viewport-edge fallback.
- Only one popup is open at a time.
- The popup title is informational text. It never reselects the marker or expands the full details view.
- `Details` is the only popup action that opens the full facility or boarding-house details surface.
- `Navigate` creates one navigation intent and closes the popup after that intent is accepted. Selection and any committed route state remain owned by the map runtime.
- Closing the popup, pressing Escape, or tapping genuine map background closes the popup once. It does not clear a committed route.
- A marker activation while another popup is open transfers selection and opens the new marker's popup without an intermediate blank state.

### Responsive popup

- Content width is bounded by both a compact desktop maximum and the available mobile viewport (`min(260px, viewport width minus safe margins)` as the starting constraint).
- Popup height is bounded by the usable map viewport after header, bottom-navigation, action-dock, and safe-area clearance. Under text scaling or unusually long content, the descriptive body scrolls within the popup while the labelled close control and action row remain reachable.
- `Close`, `Details`, and `Navigate` provide at least 44 by 44 CSS pixels on touch viewports.
- Actions remain side by side when their labels fit without truncation; they may stack only for localization, extreme text scaling, or a viewport too narrow to preserve the target size.
- Leaflet auto-pan keeps the popup within the usable map viewport, accounting for the header/search area, bottom navigation, route action dock, and safe-area insets.
- Popup clearance uses measured visible obstacle rectangles (including safe-area-aware controls) and coalesces updates through one settled frame; it must not depend on stale card-height state, timers, or per-observer thrash.
- The popup arrow remains visually anchored to its marker after auto-pan.
- Popup content must not cover or disable the Clear/Cancel and Report controls once navigation is active.

### Accessibility

- Popup content is a labelled, non-modal dialog associated with the selected item's name.
- The popup supplies a custom visible `<button type="button">` close control with an accessible name and focus treatment; it does not depend on Leaflet's default close anchor, which current global styling hides.
- Marker Enter or Space activation opens the popup using the same selection gateway as pointer activation.
- For keyboard activation, focus moves to the first popup control; closing returns focus to the originating marker when it still exists.
- Pointer activation does not force a disruptive focus jump.
- Escape closes the popup without creating a navigation request or clearing an active route.
- All button controls use explicit `type="button"`. Popup actions do not invent timer-based loading; accepted navigation closes the popup and the existing route-status UI owns progress, while a rejected navigation intent leaves the enabled popup available for retry. A Details action that navigates to a boarding-house route remains a semantic link.

## Route spatial-integrity contract

### Renderer-aware zoom

The implementation removes both private camera controllers, `SmoothWheelZoom` and `SmoothZoomControl`, from every basemap mode and uses Leaflet's supported native wheel, pinch, plus/minus control, keyboard, double-click, and programmatic zoom lifecycle. The map options must explicitly enable Leaflet's native wheel handler rather than retaining the current `scrollWheelZoom: false` setting. This also eliminates the request-animation-frame tail previously observed when a tab was throttled. The application must not directly drive private Leaflet camera methods to animate zoom.

The route remains mounted from the committed runtime snapshot during zoom, refresh, replacement, and recoverable failure. Zoom never recalculates route geometry, clears the committed path, restores full-size markers, or swaps in an uncommitted path.

The production Leaflet route keeps its normal/default `smoothFactor` behavior. The evidence probe measures the rendered path as it exists in production and must not force a probe-only simplification setting or otherwise change the happy path.

If the native synchronization implementation cannot keep intermediate-frame route drift within the acceptance threshold, the final broad implementation must render the vector-mode route from a MapLibre GeoJSON source/layer so the vector basemap and route share one renderer. Leaflet remains the raster/satellite fallback. This is an acceptance-controlled escalation, not permission to ship a partially synchronized route.

### Coordinate ownership

- Selected, committed-destination, pending-destination, and manual-start markers use their true geographic coordinates at every zoom.
- Protection inputs come from the authoritative broad runtime: `selectedItemId`, `navigation.committed.destinationId`, and `navigation.request.destinationId`. While the page is in manual-start selection mode, all candidate markers remain protected so the tapped coordinate and displayed coordinate cannot diverge.
- Protected markers are never moved by low-zoom centroiding or high-zoom fan-out.
- Unprotected co-located markers remain individual dots and may use deterministic fan-out for discoverability.
- Fan-out recomputation must not change protected marker positions at an integer zoom boundary.
- The route's arrival endpoint remains the routable graph endpoint (including a building entry when applicable) and is visibly represented by the route endpoint indicator. The UI does not fabricate an inaccessible straight-line segment to a building centroid.

### Frame-level acceptance

During wheel, pinch, plus/minus, double-click, keyboard, and programmatic zoom:

- the route remains visible at every sampled animation frame;
- a projected route coordinate and its rendered overlay differ by no more than 2 CSS pixels;
- the destination marker stays on its projected true coordinate within the same tolerance;
- the MapLibre camera, Leaflet camera, route overlay, and protected marker settle without a visible post-zoom snap;
- rapid consecutive zoom intents retire or coalesce correctly without a delayed 10-15 second animation tail on a throttled or hidden tab.

### Evidence oracle and harness boundary

- The opt-in evidence surface is behind a tiny exact-origin bridge. Only `http://localhost:3000`, `http://127.0.0.1:3000`, and the exact stable Broad preview alias `https://vsu-smartmap-git-perf-map-broad-rewrite-vjs-projects-def7d06b.vercel.app` with exactly one `?mapEvidence=1` value may load the heavy probe core; credentials, duplicate query values, other ports, and deployment-specific or attacker origins remain inert.
- Production map components statically import only the bridge. The geometry/event core is dynamically imported after opt-in, and default-page evidence uses two fresh browser contexts on the same route: the opted-in page waits for `window.__VSU_MAP_E2E__` and records its hashed `/_next/static/chunks/` requests; the default page records the same requests without evidence. The opt-in-only chunk set must be non-empty, none may appear in the default set, and the default global must remain absent.
- Frame expectations use the live rendered frame: MapLibre `project()` local (already-padded) coordinates are normalized through the current canvas client dimensions and `getBoundingClientRect()` into the Leaflet map-container space; satellite expectations include the live Leaflet pane affine transform. Destination expectations use independently registered runtime coordinates and the configured icon anchor, never marker `getLatLng()`.
- Visible route segments retain order and every visible vertex, are clipped to the map rectangle, and are bounded to at most 16 CSS pixels between samples and 256 samples. Expected and rendered polylines are resampled by normalized cumulative arc length to one bounded count and compared pointwise. Missing, invalid, stale, unready, incompatible, or uncapped geometry records a typed failure rather than passing with a nullable sample.

## State and event ownership

- The existing broad runtime remains the authority for selected identity, navigation phase, committed route, pending request, destination identity, and marker presentation mode.
- Popup visibility derives from selected identity plus marker existence; it is not a second source of selection state.
- One physical pointer, touch, pen, or keyboard activation maps to one interaction-gateway activation ID.
- Popup action events never pass through background-selection handling.
- `Navigate` may create only one coordinator-owned request ID. Compatibility click events cannot create a second request or toast.
- Popup close changes presentation only. Explicit Clear/Cancel remains the only user action that removes a committed route.
- Removing the bottom card also removes its height-measurement dependency from location-control and action-dock positioning. Controls fall back to safe-area-aware positions and must be verified not to overlap the popup.

## Error and fallback behavior

- A popup rendering or auto-pan problem must not clear selection, corrupt route state, or trigger navigation.
- Route failure preserves the last committed route and its endpoint while displaying the existing actionable failure feedback.
- Satellite tile failure and the current client-owned raster fallback remain unchanged by this work.
- Basemap switching must preserve the same committed route geometry and popup selection.
- Reduced-motion mode uses immediate or native bounded camera transitions while retaining the same spatial-integrity assertions.

## Alternatives considered

### Chosen: native camera synchronization plus unified Leaflet popup

This is the smallest architecture change that removes the unsupported private zoom path from all modes, preserves the established Leaflet interaction model, eliminates the mobile fixed-card split, and keeps raster/satellite fallback straightforward.

### Conditional escalation: MapLibre GeoJSON route in vector mode

This gives the strongest same-renderer guarantee but adds dual-renderer route ownership, source/layer lifecycle management, styling duplication, and basemap-switch integration. It is required only if the chosen native synchronization path fails the frame-level acceptance gate.

Task 7B is therefore a pending conditional gate, not a completed or passed renderer change. It may be marked not triggered only after two consecutive same-SHA native vector runs pass the complete required matrix and their artifacts are retained.

### Rejected: keep the bottom card and patch hit testing

This could reduce the immediate double-tap risk but does not satisfy the approved anchored-popup UX and preserves duplicate mobile/desktop presentation paths.

### Rejected: hide or redraw the route after zoom

This recreates the reported disappearing-route defect and does not provide geographic continuity.

### Rejected: custom screen-positioned HTML overlay

Projecting a free-standing card with `latLngToContainerPoint` would require parallel move/zoom/resize synchronization and would recreate the renderer coordination problem in application code.

## Gherkin acceptance contract

```gherkin
Feature: Broad map spatial and interaction integrity

  Rule: A committed route remains geographically anchored

    Scenario Outline: Zooming never detaches a committed route
      Given a committed route is visible over the <basemap> map
      When the user zooms using <method>
      Then the route remains visible during every sampled animation frame
      And the route stays within 2 CSS pixels of its projected coordinates
      And the protected destination marker stays within 2 CSS pixels of its true projected coordinate
      And neither the route nor destination marker jumps after zoom completes

      Examples:
        | basemap   | method            |
        | vector    | wheel             |
        | vector    | pinch             |
        | vector    | zoom control      |
        | vector    | double-click      |
        | vector    | keyboard          |
        | vector    | programmatic zoom |
        | satellite | pinch             |
        | satellite | zoom control      |
        | satellite | double-click      |
        | satellite | keyboard          |
        | satellite | programmatic zoom |

    Scenario: Replacement work preserves the committed overlay
      Given a committed route to facility A is visible
      And a replacement route to facility B is resolving
      When the user zooms the map
      Then the committed route to facility A stays visible and anchored
      And no uncommitted route to facility B is rendered

  Rule: A marker activation opens one anchored popup

    Scenario Outline: One activation opens the matching popup
      Given an individual <kind> marker is visible on a mobile viewport
      When the user activates the marker once using <input>
      Then one compact popup opens above that marker
      And the popup remains within the usable map viewport
      And no bottom mini-card opens

      Examples:
        | kind           | input    |
        | facility       | touch    |
        | boarding house | touch    |
        | facility       | keyboard |
        | boarding house | keyboard |

    Scenario: Details activates once
      Given a marker popup is open
      When the user activates Details once
      Then the matching full details surface opens exactly once
      And the title does not act as a second Details control

    Scenario: Navigate activates once
      Given a marker popup is open
      When the user activates Navigate once
      Then one route request is created for that destination
      And one navigation feedback event is emitted
      And the popup closes without clearing the accepted destination

    Scenario: Closing a popup preserves navigation
      Given a committed route is visible and its destination popup is open
      When the user closes the popup
      Then the popup closes exactly once
      And the committed route remains visible
      And no route request or clear event is emitted

    Scenario: Closing another marker's popup preserves navigation
      Given a committed route to facility A is visible
      And the popup for marker B is open
      When the user closes the popup for marker B
      Then the popup closes exactly once
      And the committed route to facility A remains visible
      And no route request or clear event is emitted

    Scenario: Selection transfers directly between anchored popups
      Given the popup for marker A is open
      When the user activates marker B once
      Then the popup for marker A closes
      And exactly one popup opens above marker B
      And no intermediate background-clear event is emitted

    Scenario: Popup actions are not background gestures
      Given a marker popup is open
      When the user activates Close, Details, or Navigate
      Then map background selection handling does not consume the activation
      And the chosen action completes on the first activation
```

## Verification matrix

### Automated

- Pure declutter tests prove protected true coordinates below, at, and above the fan-out threshold and across integer zoom buckets.
- Pointer/gateway tests cover touch compatibility clicks, mouse, pen, keyboard, cancellation, non-primary input, and exact-once action dispatch.
- Popup component tests cover facility and boarding-house rendering, explicit button types or semantic links as appropriate, accessible labels, 44-pixel mobile targets, absence of fake timer loading, and title inertness.
- Map integration tests cover single-popup ownership, direct selection transfer, destination and non-destination close semantics, committed-route preservation, auto-pan configuration, bounded popup height/overflow, and removal of the mobile bottom card.
- Zoom-controller tests prove that neither `SmoothWheelZoom` nor `SmoothZoomControl` is mounted in a map surface, native Leaflet wheel zoom is enabled, no basemap mode uses the private `_move` controller, and reduced-motion/native paths are bounded.
- Route/runtime tests cover active, refreshing, replacement, failure, stale completion, clear, and basemap-switch presentation.
- Run the focused map/navigation suite, full repository tests, typecheck, lint, build, and diff checks.

### Real browser

Run on the deployed broad preview using genuine mobile emulation where touch behavior matters:

- 320x568, 390x844, 412x915, 768x900, 1024x768, and 1440x900;
- facility and boarding-house markers near the center and each viewport edge;
- idle, selected, active route, pending replacement, failed replacement, and manual-start states;
- vector and satellite basemaps;
- wheel, pinch, zoom controls, keyboard zoom, rapid repeated zoom, background tab throttling, and reduced motion;
- Details, Navigate, Close, Escape, background tap, and selection transfer;
- light/dark appearance and text zoom where available.

Record per-frame route/projection samples, callback/request counts, popup and control bounding boxes, console errors, long tasks, and relevant screenshots or recordings. A source-pattern test or final-frame screenshot is not sufficient evidence for the route synchronization or first-tap requirements.

Frame evidence must use an independent authoritative oracle in the same rendered screen coordinate space as the current animation frame. Vector expectations are normalized through the rendered MapLibre canvas transform; satellite expectations include the rendered Leaflet pane transform. Destination expectations come from the runtime item's true coordinates and configured icon anchor, never from the marker's own possibly displaced `getLatLng()`. Visible route segments remain ordered and bounded to 16-pixel sampling; missing, clipped-incompatibly, undersampled, stale, or unready geometry is a typed failed row rather than a nullable pass.

Report native and synthetic evidence separately. Native evidence includes the installed Chrome channel's real mouse/touch/keyboard paths and native Leaflet controls. CDP pinch/pen, safe-area overrides, root-font scaling, forced tile failures, and lifecycle throttling are synthetic controls; they cannot be presented as hardware or native browser proof. Missing deployed fixtures or unavailable capabilities are explicit **blocked** rows. The deployed matrix, served-SHA check, and the two-run Task 7B trigger decision remain pending until Task 8 records them.

## Completion and release gates

- Every Gherkin scenario is mapped to automated and/or browser evidence and reported as passed, failed, blocked, or not tested.
- No route or marker drift exceeds the 2-pixel frame threshold in the required matrix.
- Details and Navigate each complete on the first physical activation with exactly one callback/request.
- No popup/control overlap or clipped action is present at the required viewports.
- Full tests, typecheck, lint, build, and diff checks pass.
- At least one independent implementation review and one adversarial integration review report PASS or have all actionable findings resolved.
- The broad draft PR is updated with evidence and residual risks. It remains unmerged until the user explicitly chooses to merge it.

## Non-goals

- No targeted-branch edits.
- No map-vendor, routing-provider, database, authentication, or PWA architecture replacement.
- No marker clustering; individual marker dots remain the approved presentation.
- No redesign of the full facility or boarding-house details surfaces.
- No automatic merge or production promotion.
