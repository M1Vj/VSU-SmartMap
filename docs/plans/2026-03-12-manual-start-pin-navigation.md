# Manual Start Pin Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a manual start-pin fallback for navigation when geolocation is unavailable and make events counting consistently upcoming-only.

**Architecture:** Keep route state in the student map page, add a small manual-start state machine there, and pass a map-click callback into the selection layer. Extract upcoming-event filtering into a shared utility so UI count logic and any server-side filtering rules stay consistent.

**Tech Stack:** Next.js App Router, React 19, TypeScript, React Leaflet, Sonner, ESLint, Node test runner

---

### Task 1: Document The Branch

**Files:**
- Create: `docs/plans/2026-03-12-manual-start-pin-navigation-design.md`
- Create: `docs/plans/2026-03-12-manual-start-pin-navigation.md`
- Create: `.agents/features/02-manual-start-pin-navigation.md`
- Modify: `.agents/checklist.md`

**Step 1: Add the new branch guide and checklist entries**

Record the mission, implementation targets, verification checklist, and suggested atomic commits for this branch.

**Step 2: Review the docs**

Run: `sed -n '1,220p' docs/plans/2026-03-12-manual-start-pin-navigation.md`
Expected: plan content is present and references the correct branch/files.

**Step 3: Commit**

```bash
git add docs/plans .agents/features/02-manual-start-pin-navigation.md .agents/checklist.md
git commit -m "docs: add manual start pin navigation plan"
```

### Task 2: Upcoming Events Filtering

**Files:**
- Create: `lib/events/upcoming.ts`
- Create: `lib/events/upcoming.test.ts`
- Modify: `components/events/events-view.tsx`

**Step 1: Write the failing test**

Add tests for:
- events ending before now are excluded
- events ending exactly at now are included
- count is based on the filtered array

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/events/upcoming.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Implement a shared helper that returns only upcoming events based on `endTime >= now`.

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/events/upcoming.test.ts`
Expected: PASS

**Step 5: Wire the helper into the events view**

Use the helper for the visible count and list/calendar data that should only represent upcoming events.

**Step 6: Commit**

```bash
git add lib/events/upcoming.ts lib/events/upcoming.test.ts components/events/events-view.tsx
git commit -m "fix(events): count only upcoming events"
```

### Task 3: Manual Start Pin Navigation

**Files:**
- Create: `lib/navigation/manual-start.ts`
- Create: `lib/navigation/manual-start.test.ts`
- Modify: `app/(student)/page.tsx`
- Modify: `components/map/map-selection-layer.tsx`
- Modify: `components/map/navigation-layer.tsx`

**Step 1: Write the failing test**

Add tests for:
- manual-start mode should activate when navigation is requested without a live position
- manual-start mode should not activate when a position exists
- placing a pin should convert map coordinates into a route start

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/navigation/manual-start.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Implement a small pure helper for deciding whether the flow should wait for GPS or request a manual start pin.

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/navigation/manual-start.test.ts`
Expected: PASS

**Step 5: Wire the UI flow**

- Track whether the map is waiting for a manual start pin.
- Show an on-map instruction banner while waiting.
- Accept the next plain map click as the route start.
- Render the route immediately from that temporary point.
- Clear manual-start state when the route is cleared or replaced by live location.

**Step 6: Commit**

```bash
git add lib/navigation/manual-start.ts lib/navigation/manual-start.test.ts app/(student)/page.tsx components/map/map-selection-layer.tsx components/map/navigation-layer.tsx
git commit -m "feat(navigation): add manual start pin fallback"
```

### Task 4: Verify End To End

**Files:**
- Modify: none

**Step 1: Run lint**

Run: `npm run lint`
Expected: exit code 0

**Step 2: Run targeted tests**

Run: `node --test --experimental-strip-types lib/events/upcoming.test.ts lib/navigation/manual-start.test.ts`
Expected: PASS

**Step 3: Run the app**

Run: `npm run dev`
Expected: dev server starts without runtime errors

**Step 4: Browser smoke check**

Use Playwright to verify:
- events header count excludes past events
- navigation without location shows the manual start instruction
- clicking the map sets the starting pin and route

**Step 5: Commit if any verification-driven fixes were needed**

```bash
git add <files>
git commit -m "fix: address verification feedback"
```
