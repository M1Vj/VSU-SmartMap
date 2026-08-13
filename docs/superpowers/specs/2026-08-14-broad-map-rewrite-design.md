# Broad Map Runtime Rewrite

## Goal

Build a structurally cleaner alternative to the targeted pass on the same production base. Replace distributed interaction/navigation/render ownership with explicit map-runtime boundaries, while preserving every user-visible happy path and providing comparable performance evidence.

## Behavioral contract

The broad rewrite must pass every Gherkin scenario in the targeted design, plus:

```gherkin
Feature: Explicit map runtime ownership

  Scenario: One state machine owns navigation presentation
    Given navigation is idle, acquiring a start, resolving, active, refreshing, failed, or cleared
    Then exactly one runtime state describes the visible route, marker mode, controls, and announcements
    And no component infers route activity from an asynchronously emptied array

  Scenario: A single interaction gateway owns pointer selection
    Given a mouse, touch, pen, or keyboard activates a marker
    When the platform emits compatibility events for that activation
    Then the facility is selected exactly once
    And map background handlers do not consume the marker activation

  Scenario: Route computation reuses a prepared graph
    Given the navigation graph has loaded
    When one or more routes are calculated
    Then graph indexes and adjacency are prepared once per graph revision
    And route calculations do not repeatedly scan all nodes for identifier lookup

  Scenario: Rendering remains stable under transient updates
    Given a successful route overlay exists
    When location, zoom, selection, or a replacement calculation updates
    Then the overlay instance remains mounted until clear or successful replacement
    And marker presentation derives from runtime phase rather than transient result arrays
```

## Architecture

- Introduce a pure, tested map runtime reducer/controller with explicit phases and events. It owns selected item identity, navigation phase, committed route, pending request identity, destination identity, route-mode marker policy, and HUD presentation.
- Introduce a pure route engine boundary that prepares graph indexes/adjacency once for a graph revision and accepts cancellable route requests. It returns data; it does not own React state, toast UI, or camera motion.
- Introduce one marker interaction gateway based on pointer/keyboard activation with compatibility-event deduplication. Map-background deselection consumes only genuine background gestures.
- Keep Leaflet as the overlay/interaction map and MapLibre as the vector basemap; this experiment rewrites application ownership rather than switching mapping vendors.
- Keep the route overlay mounted from committed runtime state while replacement work is pending. Apply updates imperatively through stable Leaflet layers where that reduces remount/flicker.
- Split map presentation into memoized marker, route overlay, status HUD, action dock, and mobile mini-card surfaces that subscribe only to the state they render.
- Implement the approved Option A layout and measured mini-card clearance.
- Preserve offline cache behavior, map styles, clustering, boarding houses, manual starts, geolocation clamping, accessibility, reduced motion, and desktop behavior.

## Performance and observability contract

- Prepare graph lookup maps/adjacency once per graph revision and benchmark route computation against the base.
- Prevent full marker-layer recomputation for unrelated status/HUD updates; benchmark zoom/pan and interaction at current production marker count and synthetic 100/500 marker sets.
- Add privacy-safe performance marks for map ready, marker activation, route request/commit, and route-refresh continuity. Telemetry uses bounded event names and numeric durations only.
- Use the exact same measurement matrix as the targeted branch and publish a side-by-side results table.

## Non-goals

- No database migration, routing-provider replacement, map-vendor replacement, visual redesign beyond approved controls, admin feature changes, merge, or production deployment.
- Do not copy commits from the targeted branch; equivalent tests may be independently authored so the branches remain comparable alternatives.

## Verification

- Tests are written before behavior changes.
- Run pure reducer/engine tests, adapter tests, complete repository tests, typecheck, lint, build, page benchmark, repeated mobile/desktop browser flows, performance traces, and an independent adversarial architecture review.
- Open an unmerged PR to `main` describing migration risk, rollback (close the PR), measurements, and comparison with the targeted PR.

