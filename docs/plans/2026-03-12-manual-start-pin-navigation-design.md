# Manual Start Pin Navigation Design

**Date:** 2026-03-12
**Branch:** `feature/manual-start-pin-navigation`

## Goal
When a user starts navigation to a building and live location is unavailable, let them place a starting pin on the map instead of blocking the route flow. Also make the events page count only upcoming events.

## Recommended Approach
1. Keep the current navigation entry points unchanged.
2. Add a manual-start mode in the student map page that activates only when the user requests directions without an available location.
3. Let the user tap the map once to place a temporary start pin, then route from that pin to the selected building.
4. Move upcoming-event filtering into a shared utility so the list tab, calendar tab, and header count all use the same rule.

## UX Flow
- User taps `Navigate` from a facility card or popup.
- If live location exists, routing behaves exactly as it does today.
- If live location does not exist, the app shows a compact prompt telling the user to tap the map to place a starting pin.
- The next valid map tap sets a temporary route start, keeps the selected destination, and renders the route immediately.
- Clearing the route also clears the temporary start pin state.

## Constraints
- Do not remove the existing geolocation permission flow.
- Do not create a second navigation entry point.
- Keep the manual pin temporary and route-scoped only.
- Ignore clicks on controls and facility markers while manual-start mode is active.

## Files Expected To Change
- `app/(student)/page.tsx`
- `components/map/map-selection-layer.tsx`
- `components/map/navigation-layer.tsx`
- `components/events/events-view.tsx`
- `lib/actions/events.ts`
- New shared event utility/test files if needed

## Verification
- Lint passes.
- Navigation still works with live location.
- Navigation works without location by placing a start pin.
- Events page header count excludes ended events in both tabs.
