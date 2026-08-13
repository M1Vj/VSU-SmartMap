# Targeted Measured Map Performance Pass

## Goal

Fix the reported mobile marker, route continuity, and route-control UX defects without replacing the current Leaflet/MapLibre architecture. Preserve the established happy path and compare measured behavior against both the production baseline and the broad-rewrite alternative.

## Behavioral contract

```gherkin
Feature: Responsive mobile map interactions

  Scenario: A marker opens its mini card on one tap
    Given the student map is displayed on a mobile viewport
    When the user taps a facility marker once
    Then exactly one mini card for that facility is visible
    And no full facility dialog opens

  Scenario: The mini-card title has no action
    Given a facility mini card is visible
    When the user taps its title
    Then the same mini card remains visible
    And the full facility dialog remains closed
    When the user taps Details
    Then the full facility dialog opens once

Feature: Stable active-route rendering

  Scenario: Zoom preserves an active route
    Given a route is active and non-destination markers are dots
    When the user zooms in or out
    Then the current route remains visible throughout the gesture
    And non-destination markers remain dots
    And the destination remains a full pin

  Scenario: A route refresh preserves the last successful route
    Given a route is active
    When a newer route calculation begins
    Then the last successful route remains visible
    And marker route mode remains active
    Until the replacement succeeds or the user explicitly clears the route

Feature: Route action placement

  Scenario: Route actions use the selected split layout
    Given navigation state is visible
    Then status and route metrics remain top-center
    And Clear or Cancel Route and Report Route are bottom-center
    And each action has at least a 44 by 44 CSS-pixel touch target
    And the action dock clears the mobile navigation safe area
    And it does not overlap a visible mini card
```

## Implementation boundaries

- Keep `MapWrapper`, `MapSelectionLayer`, `MapMarkers`, and `NavigationLayer` as the current architectural units.
- Correct gesture/event ownership at the smallest boundary that explains the reproduced double-tap behavior. One physical gesture must produce one selection.
- Keep facility names as semantic headings, not buttons or links. `Details` remains the sole expansion action.
- Keep the existing latest-request route coordinator and camera policy; harden only gaps proven by tests/runtime instrumentation.
- Extract the route action dock from the top status cluster and implement the approved split layout. Use a shared CSS custom property or measured layout signal for mini-card clearance; do not guess a fixed variable card height.
- Preserve desktop popup behavior, manual-start flows, boarding-house markers, keyboard activation, map-click deselection, clustering, and reduced-motion behavior.
- Do not change persistence, database schema, public APIs, or deploy/merge behavior.

## Measurement contract

- Record the same metrics before and after: 16-route warm server p50/p95, map JS transfer/decoded size, mobile cold/warm navigation timing, long tasks, marker first-interaction latency, route calculation time, and route continuity during repeated zoom.
- Use the same production SHA base, seeded destination, viewport/device presets, sample counts, and network/CPU conditions for both experiment branches.
- Add only bounded, privacy-safe telemetry. No labels, search text, coordinates, facility names, or user data may be logged.
- Report limitations honestly when the browser surface cannot emulate a real low-end CPU or real touch hardware.
- The canonical inputs, statistics, gates, commands, and result artifacts are defined in `2026-08-14-map-experiment-comparison-protocol.md` and apply unchanged to both PRs.

## Verification

- New tests must fail before fixes and map directly to the scenarios above.
- Run focused map/navigation tests, all repository tests, typecheck, lint, build, page benchmark, and mobile/desktop runtime scenarios.
- Open an unmerged PR to `main` with a results table and explicit comparison link to the broad rewrite PR.
- Coordinator/page integration tests must cover replacement success, replacement failure with the committed route retained, stale completion rejection, and explicit clear.
- Interaction integration must emit pointer/touch compatibility clicks and prove exactly one selection/card with no full dialog.
- Layout runtime checks must cover facility and boarding-house cards, safe-area insets, 44x44 targets, and non-overlap at every mobile viewport.
