# Map Selection Routing Behavior Design

**Date:** 2026-03-12
**Branch:** `fix/map-selection-routing-behavior`

## Goal
Make map selection feel reversible and stable by clearing selection on empty-map clicks, restoring a broader map view, preventing the Leaflet tooltip crash when switching markers, and minimizing non-destination markers during active routing without disabling their interactivity.

## Recommended Approach
1. Track the last non-selected map view before a marker is focused.
2. Restore that saved view when the user deselects by clicking empty map space, with a small zoom-out fallback if no previous view was captured.
3. Keep marker tooltip and popup wiring stable while selection changes so Leaflet does not try to rebind a removed tooltip source.
4. Add a routing-aware marker display mode that forces non-destination markers into their minimized dot presentation while a route is active, but still allows them to be clicked and selected.

## UX Flow
- User clicks a facility marker and the map zooms to it as it does today.
- User clicks empty map space and the selected marker clears.
- After deselection, the map returns to the view the user had before selecting the marker, or zooms out slightly if no prior view was saved.
- When a route is active, other facilities stay clickable but render as dots to reduce clutter.
- The destination marker remains full-sized so the route target stays obvious.

## Constraints
- Do not block selecting other markers while a route exists.
- Do not change destination marker styling into a minimized dot during routing.
- Keep manual start pin routing behavior intact.
- Avoid Leaflet child mount churn that can invalidate popup or tooltip internals.

## Files Expected To Change
- `app/(student)/page.tsx`
- `components/map/map-selection-layer.tsx`
- `components/map/map-markers.tsx`
- `components/map/map-marker.tsx`
- `lib/map/pins.ts`
- New small helper and test files for view restoration logic if needed

## Verification
- Empty-map clicks clear the selected marker.
- Deselecting restores the prior map view or zooms out slightly.
- Switching directly from one marker to another no longer throws the tooltip runtime error.
- During active routing, non-destination markers render as dots but remain selectable.
- The destination marker remains full-sized during routing.
