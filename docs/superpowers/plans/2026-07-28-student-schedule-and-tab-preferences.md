# Student Schedule and Tab Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an anonymous, offline-first student schedule with campus-map handoff and configurable student navigation tabs.

**Architecture:** Centralize student navigation metadata and validated local preferences. Store normalized schedule-course documents in a new Dexie table behind a typed repository, with pure validation/conflict/time/export modules and focused React components. Keep personal schedule data device-only; `/schedule` is a static client shell and the service worker caches only that shell.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, Dexie 4, Tailwind CSS 3, Radix UI, Node test runner via `tsx`, Playwright/browser DevTools.

**Authoritative patterns:**

- Next.js App Router: keep page metadata in a Server Component and render an interactive Client Component: https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx
- Next.js client navigation hooks come from `next/navigation`: https://github.com/vercel/next.js/blob/v16.2.9/docs/01-app/02-guides/migrating/app-router-migration.mdx
- Dexie schema versions and upgrades: https://dexie.org/docs/Version/Version.upgrade()
- Dexie transactions roll back on thrown errors: https://dexie.org/docs/Tutorial/Design

---

## File map

**Create**

- `lib/navigation/student-navigation.ts` — tab IDs, labels, routes, icons, defaults, preference normalization.
- `lib/navigation/student-navigation.test.ts` — preference and route invariants.
- `lib/schedule/types.ts` — course/meeting/backup types and limits.
- `lib/schedule/validation.ts` / `.test.ts` — normalization, validation, backup document parsing.
- `lib/schedule/conflicts.ts` / `.test.ts` — overlap detection.
- `lib/schedule/time.ts` / `.test.ts` — formatting and Manila next-class logic.
- `lib/schedule/ics.ts` / `.test.ts` — ICS export.
- `lib/schedule/repository.ts` — Dexie CRUD and atomic replacement.
- `components/schedule/schedule-page-client.tsx` — page orchestration and observable data.
- `components/schedule/schedule-header.tsx` — next-class and page actions.
- `components/schedule/schedule-agenda.tsx` — accessible day agenda/TBA list.
- `components/schedule/schedule-week-grid.tsx` — larger-screen timetable.
- `components/schedule/course-dialog.tsx` — add/edit form.
- `components/schedule/schedule-transfer-dialog.tsx` — backup/restore/export.
- `app/(student)/schedule/page.tsx` — metadata and client shell.
- `components/map/navigation-layer.test.tsx` or a pure routing-guard test module — stale request reproduction.

**Modify**

- `lib/db.ts` — Dexie version 10 and `schedule_courses` table.
- `lib/context/app-context.tsx` — central navigation types, visibility state, and routes.
- `components/student-tabs.tsx` — render centralized visible destinations with correct navigation semantics.
- `components/layout/settings-dropdown.tsx` — navigation visibility submenu/reset.
- `components/app-header.tsx` — schedule path behavior only if required.
- `components/map/navigation-layer.tsx` — cancel/ignore stale route requests.
- `components/map/map-selection-layer.tsx` and/or caller contract — suppress competing fly-to during active navigation if browser reproduction confirms it.
- `public/sw.js` — precache `/schedule`, bump cache, repair static-asset fallback.
- `README.md`, `CHANGELOG.md` — feature/offline documentation.

## Task 1: Centralize student navigation and preferences

- [ ] **Step 1: Write failing preference tests**

Create `lib/navigation/student-navigation.test.ts` with cases proving unknown IDs are removed, Map remains visible, defaults include Schedule, duplicates are removed, all optional destinations can be hidden, and route lookup maps `/schedule` to `schedule`.

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VISIBLE_STUDENT_DESTINATIONS,
  normalizeVisibleStudentDestinations,
  studentDestinationForPath,
} from "./student-navigation";

test("defaults include map and schedule", () => {
  assert.deepEqual(
    DEFAULT_VISIBLE_STUDENT_DESTINATIONS.includes("schedule"),
    true,
  );
});

test("normalization keeps map and removes unknown or duplicate ids", () => {
  assert.deepEqual(
    normalizeVisibleStudentDestinations(["chat", "chat", "unknown"]),
    ["map", "chat"],
  );
});

test("schedule path resolves to the schedule destination", () => {
  assert.equal(studentDestinationForPath("/schedule"), "schedule");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `rtk proxy node --experimental-test-module-mocks --import tsx --test lib/navigation/student-navigation.test.ts`  
Expected: FAIL because `student-navigation.ts` does not exist.

- [ ] **Step 3: Implement the centralized model**

Create `lib/navigation/student-navigation.ts` with:

```ts
export const STUDENT_DESTINATION_IDS = [
  "map", "schedule", "boarding", "events", "directory", "chat",
] as const;
export type StudentDestinationId = (typeof STUDENT_DESTINATION_IDS)[number];

export const STUDENT_DESTINATIONS = [
  { id: "map", label: "Map", route: "/", required: true },
  { id: "schedule", label: "Schedule", route: "/schedule" },
  { id: "boarding", label: "Boarding", route: "/boarding-houses" },
  { id: "events", label: "Events", route: "/events" },
  { id: "directory", label: "Directory", route: "/directory" },
  { id: "chat", label: "Chat", route: "/chat" },
] as const;
```

Implement `normalizeVisibleStudentDestinations`, `studentDestinationForPath`, `studentDestinationRoute`, and the versioned local-storage key. Keep icon components in `StudentTabs` so the domain module is serializable.

- [ ] **Step 4: Integrate preferences**

Update `AppContextValue` with `visibleStudentDestinations`, `setStudentDestinationVisible`, and `resetStudentDestinationVisibility`. Hydrate only after mount, catch storage exceptions, and persist the normalized list.

- [ ] **Step 5: Correct navigation semantics**

Update `StudentTabs` to filter centralized destinations and render:

```tsx
<nav aria-label="Student navigation">
  <button aria-current={isActive ? "page" : undefined}>...</button>
</nav>
```

Remove `role="tablist"`, `role="tab"`, `aria-controls`, roving `tabIndex`, and arrow-key behavior because these buttons change routes rather than tabs in one composite widget.

- [ ] **Step 6: Add Settings controls**

Add a `Navigation tabs` submenu using checkbox menu items. Map is checked and disabled; other entries toggle context state. Include `Reset tabs`.

- [ ] **Step 7: Verify GREEN**

Run targeted test, then `rtk npm run typecheck` and `rtk lint`.  
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
rtk git add lib/navigation components/student-tabs.tsx components/layout/settings-dropdown.tsx lib/context/app-context.tsx
rtk git commit -m "feat(navigation): add configurable student destinations"
```

## Task 2: Build the schedule domain test-first

- [ ] **Step 1: Write validation tests**

Cover trimming, length limits, invalid time ranges, no weekdays, no meetings, TBA preservation, facility/free-text locations, and generated IDs.

```ts
test("normalizes a valid recurring meeting", () => {
  const course = normalizeScheduleCourse({
    code: "  CMSC 141 ",
    title: "Data Structures",
    meetings: [{
      days: [1, 3, 5],
      startMinute: 8 * 60,
      endMinute: 9 * 60,
      locationLabel: "TBA",
    }],
  });
  assert.equal(course.code, "CMSC 141");
  assert.deepEqual(course.meetings[0].days, [1, 3, 5]);
});
```

- [ ] **Step 2: Write conflict tests**

Prove strict overlap, containment, same-time, adjacency, different weekday, and TBA behavior.

```ts
assert.equal(meetingsOverlap(mon900to1000, mon1000to1100), false);
assert.equal(meetingsOverlap(mon900to1100, mon1000to1030), true);
assert.equal(meetingsOverlap(mon900to1000, tue900to1000), false);
```

- [ ] **Step 3: Write Manila time tests**

Inject a clock/instant. Prove active class, next class later today, wrap to next week, TBA exclusion, and device-timezone independence.

- [ ] **Step 4: Run tests and verify RED**

Run all three new test files.  
Expected: FAIL because the modules do not exist.

- [ ] **Step 5: Implement types and pure functions**

Use integer minutes and ISO weekdays. `findScheduleConflicts` returns stable pairs; `getNextClassOccurrence` uses `Intl.DateTimeFormat(..., { timeZone: "Asia/Manila" })` for weekday/time parts and never constructs a fake local weekly `Date`.

- [ ] **Step 6: Verify GREEN and refactor**

Run targeted tests and `rtk git diff --check`.  
Expected: all pass with no whitespace errors.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/schedule
rtk git commit -m "feat(schedule): add validated planner domain"
```

## Task 3: Add IndexedDB persistence

- [ ] **Step 1: Add the table and repository**

Modify `lib/db.ts`:

```ts
schedule_courses!: Table<ScheduleCourse, string>;

this.version(10).stores({
  schedule_courses: "id, code, updatedAt",
});
```

Create repository methods `list`, `put`, `remove`, `clear`, and `replaceAll`. Every write normalizes first. `replaceAll` validates the complete input before opening a Dexie `rw` transaction, then clears and bulk-adds atomically.

- [ ] **Step 2: Add error classification**

Map quota/private-mode/open failures to `ScheduleStorageError` with a user-safe message. Never report success before the Dexie promise resolves.

- [ ] **Step 3: Verify schema/runtime contract**

Run typecheck and existing cache tests. In the later browser task, prove persistence across reload and that invalid restore preserves current rows.

- [ ] **Step 4: Commit**

```bash
rtk git add lib/db.ts lib/schedule/repository.ts
rtk git commit -m "feat(schedule): persist courses in IndexedDB"
```

## Task 4: Add backup and ICS export test-first

- [ ] **Step 1: Write backup tests**

Prove versioned round-trip, malformed JSON rejection, invalid course rejection, and duplicate ID regeneration before replacement.

- [ ] **Step 2: Write ICS tests**

Prove CRLF output, required VCALENDAR fields, `Asia/Manila`, escaped comma/semicolon/newline text, recurring weekdays, adjacent date boundaries, and omission of TBA-only meetings.

```ts
assert.match(ics, /BEGIN:VCALENDAR\r\nVERSION:2.0/);
assert.match(ics, /TZID:Asia\/Manila/);
assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE/);
assert.doesNotMatch(ics, /TBA-only course title/);
```

- [ ] **Step 3: Run RED, implement, run GREEN**

Create `backup.ts` and `ics.ts`. Download with a same-document `Blob` URL, revoke it after click, and keep all generation client-side.

- [ ] **Step 4: Commit**

```bash
rtk git add lib/schedule/backup.ts lib/schedule/backup.test.ts lib/schedule/ics.ts lib/schedule/ics.test.ts
rtk git commit -m "feat(schedule): add backup and calendar export"
```

## Task 5: Build the schedule UI

- [ ] **Step 1: Create the route shell**

`app/(student)/schedule/page.tsx` remains a Server Component:

```tsx
export const metadata: Metadata = {
  title: "My Schedule",
  description: "Plan recurring classes and open their campus locations.",
};

export default function SchedulePage() {
  return <SchedulePageClient />;
}
```

- [ ] **Step 2: Build the orchestration component**

Use `useLiveQuery(() => scheduleRepository.list(), [])`, explicit loading/error/empty states, and toast only after completed writes.

- [ ] **Step 3: Build add/edit form**

Use `react-hook-form` and Zod-compatible validation already present in the project. Support one to eight meeting rows, weekday toggle buttons, time inputs, cached/online facility choices, free text, and TBA. Preserve user input when a save fails.

- [ ] **Step 4: Build agenda and grid**

Agenda is always present in semantic markup. The weekly grid is a progressive desktop view with CSS grid, collision columns for conflicts, text labels, and `prefers-reduced-motion` support.

- [ ] **Step 5: Build next-class/map handoff**

Known facility action navigates to `/?facility=${encodeURIComponent(facilityId)}`. Unknown/TBA locations show no misleading route action.

- [ ] **Step 6: Add transfer and destructive dialogs**

Export JSON, restore JSON through validated atomic replacement, export ICS with a term date range, and require confirmation for clear/replace.

- [ ] **Step 7: Verify locally**

Run tests, typecheck, and lint.  
Expected: all pass before browser verification.

- [ ] **Step 8: Commit**

```bash
rtk git add app/'(student)'/schedule components/schedule
rtk git commit -m "feat(schedule): add offline student planner interface"
```

## Task 6: Repair route handoff races and camera polish

- [ ] **Step 1: Reproduce stale route behavior with a failing test**

Extract or inject a request-generation guard so a delayed first route resolving after a second request cannot publish.

```ts
const first = guard.begin();
const second = guard.begin();
assert.equal(guard.canCommit(first.id), false);
assert.equal(guard.canCommit(second.id), true);
```

- [ ] **Step 2: Implement cancellation/current-request guard**

Create an `AbortController` per route request, abort on dependency change/unmount, clear stale path immediately, pass the signal to providers that support it, and check the generation before `setPath`/`onRoutesFound`.

- [ ] **Step 3: Remove double camera movement**

Reproduce in browser. When active navigation already owns the viewport, suppress selection-layer `flyTo`; perform one route-aware `fitBounds` after the winning route resolves. Respect reduced motion.

- [ ] **Step 4: Verify**

Test rapid destination switch, mocked geolocation update, cancellation, and schedule-to-map handoff with delayed routing.

- [ ] **Step 5: Commit**

```bash
rtk git add components/map lib/pathfinding
rtk git commit -m "fix(map): ignore stale routes during class handoff"
```

## Task 7: Make Schedule offline-safe and repair the service worker

- [ ] **Step 1: Add a failing service-worker source test**

Assert `/schedule` is precached, cache name advances, and static-asset fetch failure returns a real `Response` rather than an empty labelled block.

- [ ] **Step 2: Update `public/sw.js`**

Change `vsu-smartmap-v14` to `vsu-smartmap-v15`, add `/schedule`, and replace the malformed catch body with:

```js
return new Response("", {
  status: 503,
  headers: { "Content-Type": "application/javascript" },
});
```

- [ ] **Step 3: Verify offline preview**

Run `NEXT_PUBLIC_ENABLE_LOCAL_OFFLINE_SW=true` build/start, visit `/schedule`, add a course, go offline, reload, and confirm the shell and IndexedDB data remain available. Confirm Cache Storage contains no course/title/location payload.

- [ ] **Step 4: Commit**

```bash
rtk git add public/sw.js public/service-worker.test.mjs
rtk git commit -m "fix(pwa): precache the private local schedule shell"
```

## Task 8: Documentation and full verification

- [ ] **Step 1: Update docs**

Document `/schedule`, local-device privacy, backup responsibility, offline behavior, map handoff, and navigation customization in `README.md` and `CHANGELOG.md`.

- [ ] **Step 2: Run all quality gates**

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Expected: all exit 0.

- [ ] **Step 3: Browser matrix**

Verify at 320, 768, 1024, and 1440 px:

1. defaults and Settings toggles persist;
2. Map cannot be hidden and Reset works;
3. add/edit/delete and multiple meeting rows;
4. conflicts and adjacent blocks;
5. TBA visibility;
6. next-class state with a controlled clock where practical;
7. known location opens the correct facility on Map;
8. JSON backup/restore and ICS download;
9. reload and offline reload;
10. keyboard/focus/accessibility tree;
11. zero console errors/warnings and no failed required network requests.

- [ ] **Step 4: Review performance**

Capture a map handoff trace. Require no stale route publish, one camera transition, no long task above 50 ms attributable to schedule rendering, and no eager map bundle load on `/schedule`.

- [ ] **Step 5: Independent review**

Run a read-only reviewer over the diff for correctness, privacy, accessibility, IndexedDB migration safety, service-worker upgrades, and mobile layout. Fix material findings and rerun affected gates.

- [ ] **Step 6: Commit docs/final fixes**

```bash
rtk git add README.md CHANGELOG.md
rtk git commit -m "docs(schedule): document the local student planner"
```

## Task 9: Synchronize repositories and verify deployability

- [ ] **Step 1: Confirm public branch state**

Ensure only intentional commits are present and the public checkout is clean.

- [ ] **Step 2: Port intentional commits to private history**

Cherry-pick the feature commits into a focused private-history branch. Preserve its package identity and the two unrelated untracked screenshots.

- [ ] **Step 3: Verify parity**

Compare hashes for every product file changed by the feature, excluding repository-specific lockfile/package identity and documentation that intentionally differs. Run targeted tests in the private checkout.

- [ ] **Step 4: Prepare release evidence**

Report branch names, commits, gate results, browser screenshots, remaining risks, and whether a push/PR/deployment occurred. Do not claim production until the served app matches the merged/deployed SHA.
