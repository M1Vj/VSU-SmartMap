# Map Selection Routing Behavior Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve map deselection, stabilize marker switching, and minimize non-destination markers during active routing without removing marker interactivity.

**Architecture:** Keep selection and route ownership in the student map page, teach the selection layer to remember and restore the previous map view, and pass a routing-aware display mode into the marker renderer. Fix the Leaflet crash by keeping marker child structure stable while selection changes instead of conditionally tearing down tooltip bindings.

**Tech Stack:** Next.js App Router, React 19, TypeScript, React Leaflet, Leaflet, ESLint, Node test runner

---

### Task 1: Document The Branch

**Files:**
- Create: `docs/plans/2026-03-12-map-selection-routing-behavior-design.md`
- Create: `docs/plans/2026-03-12-map-selection-routing-behavior.md`
- Create: `.agents/features/04-map-selection-routing-behavior.md`
- Modify: `.agents/checklist.md`

**Step 1: Add the branch guide and checklist entry**

Record the mission, interaction targets, verification checklist, and suggested atomic commits for this fix branch.

**Step 2: Review the docs**

Run: `sed -n '1,240p' docs/plans/2026-03-12-map-selection-routing-behavior.md`
Expected: the implementation plan references the correct branch and map files.

**Step 3: Commit**

```bash
git add docs/plans .agents/features/04-map-selection-routing-behavior.md .agents/checklist.md
git commit -m "docs: add map selection routing behavior plan"
```

### Task 2: Capture And Restore Deselect View

**Files:**
- Create: `lib/map/selection-view.ts`
- Create: `lib/map/selection-view.test.ts`
- Modify: `components/map/map-selection-layer.tsx`

**Step 1: Write the failing test**

Add tests for:
- saving a pre-selection view snapshot
- restoring that view on deselect
- falling back to a one-level zoom-out when no previous view exists

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/map/selection-view.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Implement a small pure helper that decides which view to restore after deselection.

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/map/selection-view.test.ts`
Expected: PASS

**Step 5: Wire the helper into the selection layer**

- capture the current center and zoom before a new selection fly-to
- restore the saved view when selection is cleared by an outside click
- keep the current map click behavior for manual-start placement untouched

**Step 6: Commit**

```bash
git add lib/map/selection-view.ts lib/map/selection-view.test.ts components/map/map-selection-layer.tsx
git commit -m "feat(map): restore previous view on deselect"
```

### Task 3: Stabilize Marker Switching

**Files:**
- Modify: `components/map/map-marker.tsx`

**Step 1: Write the failing test or minimal reproduction note**

If a component test is not practical, create a small reproduction checklist in the commit scope and confirm the runtime failure path before code changes.

**Step 2: Implement the minimal fix**

- keep tooltip or equivalent label wiring stable during selection changes
- make popup open and close logic resilient when switching directly between markers

**Step 3: Verify the bug is gone**

Run the app and switch between markers repeatedly.
Expected: no `this._tooltip._source = layer` runtime error.

**Step 4: Commit**

```bash
git add components/map/map-marker.tsx
git commit -m "fix(map): stabilize marker tooltip switching"
```

### Task 4: Minimize Non-Destination Markers During Routing

**Files:**
- Modify: `app/(student)/page.tsx`
- Modify: `components/map/map-markers.tsx`
- Modify: `components/map/map-marker.tsx`
- Modify: `lib/map/pins.ts`

**Step 1: Write the failing test or helper coverage**

Add helper coverage if marker-display decisions are extracted, or define the manual verification case if the behavior is UI-only.

**Step 2: Implement the routing-aware display mode**

- when a route exists, render non-destination markers in their minimized dot form
- keep the destination marker in its normal selected or full-size state
- keep all markers clickable so routing does not isolate the map

**Step 3: Verify the behavior**

Run the app and confirm:
- route active: other markers are dots
- destination marker stays full-sized
- clicking a dot marker still selects it

**Step 4: Commit**

```bash
git add app/(student)/page.tsx components/map/map-markers.tsx components/map/map-marker.tsx lib/map/pins.ts
git commit -m "feat(map): minimize non-destination markers during routing"
```

### Task 5: Verify End To End

**Files:**
- Modify: any files touched by verification-driven fixes

**Step 1: Run targeted tests**

Run: `node --test --experimental-strip-types lib/map/selection-view.test.ts`
Expected: PASS

**Step 2: Run lint**

Run: `npm run lint`
Expected: exit code 0 or only known pre-existing warnings.

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Run the app**

Run: `npm run dev`
Expected: dev server starts without map runtime errors.

**Step 5: Browser smoke check**

Verify:
- clicking outside a selected marker clears it and zooms out
- switching between markers does not crash
- active routing minimizes non-destination markers while keeping them clickable

**Step 6: Commit if any verification-driven fixes were needed**

```bash
git add <files>
git commit -m "fix(map): address routing interaction verification feedback"
```
