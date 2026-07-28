# Student Schedule and Tab Preferences Design

**Date:** 2026-07-28  
**Status:** Approved autonomously by the product owner  
**Primary implementation repo:** `M1Vj/VSU-SmartMap`  
**Mirror:** `M1Vj/VSU-SmartMap-private-history`

## Problem

Students need a private, quick way to record subjects, recurring meeting times, rooms or campus locations, see conflicts and the next class, and move directly from a class to the map. The student header also needs a setting that controls which primary navigation choices are visible.

The app is anonymous by default, offline-capable, and wrapped on Android as a Trusted Web Activity. The feature must therefore work without an account, survive refreshes and poor connectivity, remain useful on narrow phones, and require no native Android release.

## Reference research

Room TBA demonstrates a valuable loop: find a course or room, inspect its meetings, add it to a plan, and open the linked location on the map. We will reuse those product ideas while writing original SmartMap code and keeping VSU data, branding, and architecture separate. In particular:

- keep TBA meetings visible instead of silently dropping them;
- treat adjacent classes as valid and strictly overlapping classes as conflicts;
- link every known meeting location back to the map;
- use a responsive, accessible HTML timetable instead of a canvas-only renderer;
- avoid Room TBA's heavier always-loaded PGlite/WebGL architecture.

Room TBA is MIT-licensed, but this implementation does not copy its source.

## Approaches considered

### A. Device-only local planner

Store schedules in IndexedDB. It is fast, anonymous, offline-first, and keeps sensitive routine/location data off the server. The cost is no automatic cross-device sync.

### B. Account-only Supabase planner

Store schedules in new RLS-protected Supabase tables. It supports multiple devices but adds sign-in friction, online failure modes, migrations, sensitive behavioral data in the cloud, and a complex offline outbox.

### C. Local-first planner with immediate cloud sync

Mirror normalized schedules in IndexedDB and Supabase, with account-scoped outbox mutations, versioning, tombstones, merge UI, RLS, and account-switch cleanup. This is the strongest long-term architecture but materially expands this release and its privacy surface.

## Decision

Ship approach A with explicit JSON backup/restore and ICS export. Define a typed repository boundary so approach C can be added later without rewriting UI or domain logic.

This is the best first release because browsing is anonymous, the requested behavior does not require collaboration, and schedules reveal predictable times and locations. No schedule content will be sent to Supabase, telemetry, URLs, or service-worker API caches.

## Product behavior

### Navigation preferences

- Add a `Schedule` primary destination, enabled by default.
- Add a `Navigation tabs` submenu to header Settings.
- Every destination can be shown or hidden.
- The Map destination cannot be hidden because it is the app's recovery/home surface.
- At least one destination is always visible.
- Hiding a destination removes only its navigation shortcut; direct routes remain available.
- Preferences are validated and versioned in local storage and apply simultaneously to desktop and mobile navigation.
- Reset restores the product defaults.

Primary navigation metadata—ID, label, route, icon, and default visibility—lives in one module. The existing route navigation will no longer use invalid `tablist`/`tab` semantics; it will be a labelled `nav` with `aria-current="page"`.

### Schedule page

The new `/schedule` route contains:

1. a next-class summary with current/next status and a map action when the location is known;
2. a weekday selector and compact agenda optimized for phones;
3. an accessible weekly timetable for larger screens;
4. add/edit/delete subject actions;
5. conflict and TBA indicators;
6. backup, restore, ICS export, and clear-schedule actions;
7. an honest local-device privacy/offline note.

The empty state explains the feature and opens the add form. Add/edit uses one dialog with subject details and one or more recurring meetings. A meeting supports multiple weekdays, start/end time, and either:

- a known SmartMap facility plus optional room/free-text detail;
- a free-text location; or
- TBA.

Known locations are selected from cached facilities first and refreshed from Supabase when online. Selecting “View on map” navigates to `/?facility=<id>` so the existing selection sheet and routing flow remain the single map interaction.

### Data model

```ts
type ScheduleCourse = {
  id: string;
  code: string;
  title: string;
  instructor?: string;
  color: ScheduleColor;
  notes?: string;
  meetings: ScheduleMeeting[];
  createdAt: string;
  updatedAt: string;
};

type ScheduleMeeting = {
  id: string;
  days: IsoWeekday[];
  startMinute: number;
  endMinute: number;
  facilityId?: string;
  locationLabel?: string;
};
```

`IsoWeekday` is `1..7`. Weekly civil time is stored as integer minutes, not fake timestamps, so the planner is stable when a device uses a timezone other than Asia/Manila. “Now” calculations explicitly use `Asia/Manila`.

Courses are stored in a dedicated Dexie table under schema version 10. The repository validates every record on write and read, drops malformed imports with an actionable error, and exposes observable CRUD methods to React.

### Validation and conflicts

- course code: required, trimmed, max 24 characters;
- title: required, trimmed, max 120 characters;
- instructor: optional, max 100 characters;
- notes: optional, max 500 characters;
- one to eight meetings per course;
- at least one weekday per scheduled meeting;
- `0 <= startMinute < endMinute <= 1440`;
- free-text location: max 160 characters;
- duplicate IDs are regenerated on import;
- strict overlaps on the same weekday are warnings;
- adjacent meetings are not conflicts;
- TBA meetings remain in an Unscheduled section.

Users may save intentional conflicts. Conflict messaging identifies both subjects and the shared day/time.

### Backup and calendar export

- JSON backup includes a version number and all locally stored courses.
- Restore validates the whole document before a single transactional replacement; invalid backups do not partially overwrite data.
- ICS export expands recurring weekly meetings across an optional term range chosen in export settings, uses `Asia/Manila`, escapes user text, and omits TBA meetings from timed events while listing them in the UI.
- Exports are generated entirely in the browser.

## Components and boundaries

- `lib/navigation/student-navigation.ts`: single source of navigation metadata and visibility rules.
- `lib/schedule/types.ts`: domain types and validation limits.
- `lib/schedule/validation.ts`: normalization and validation.
- `lib/schedule/conflicts.ts`: pure overlap logic.
- `lib/schedule/time.ts`: Manila “now,” formatting, next-class calculation.
- `lib/schedule/backup.ts`: JSON backup/restore validation.
- `lib/schedule/ics.ts`: standards-compliant calendar export.
- `lib/schedule/repository.ts`: IndexedDB CRUD contract and implementation.
- `components/schedule/*`: focused UI units; no component should own persistence and rendering together.
- `app/(student)/schedule/page.tsx`: metadata and schedule shell only.

The existing `AppProvider` owns navigation state and preference hydration, but schedule data remains behind the schedule repository.

## Offline and service worker

- Add `/schedule` to the precache list and bump the application cache version.
- The route is a static client shell; personal data remains in IndexedDB and never enters cached HTML or API responses.
- Fix the malformed static-asset network fallback in the existing service worker while touching this path.
- Export/restore works offline.
- The Android TWA needs no source change because it trusts the entire deployed origin.

## Accessibility and motion

- Navigation uses normal links/buttons with `aria-current`, not route-as-tab semantics.
- Dialog fields have visible labels, descriptions, and inline errors.
- Conflict and TBA states use text/icons as well as color.
- Agenda markup remains the screen-reader source of truth even when the weekly grid is visible.
- All touch targets are at least 44 CSS pixels.
- The six-destination mobile bar remains usable at 320 px through compact labels and horizontal overflow protection.
- Animations use existing motion utilities and collapse under `prefers-reduced-motion`.

## Error handling

- IndexedDB unavailable/quota errors show a persistent “not saved” message.
- Restore failures leave current data untouched.
- Facility refresh failures fall back to the local cache and allow free-text/TBA locations.
- A missing or deleted facility keeps its saved display label and disables only the map handoff.
- Destructive clear/replace operations require confirmation.

## Testing and verification

Test-driven coverage will include:

- preference parsing, invariants, reset behavior, and hidden-current-route behavior;
- course validation and normalization;
- conflict containment, adjacency, different-day, and TBA cases;
- next-class calculation in Asia/Manila;
- backup round-trip and atomic invalid-import rejection;
- ICS escaping and recurrence output;
- repository CRUD and schema upgrade;
- service-worker precache/cache-version behavior;
- browser flows for add/edit/delete, conflicts, TBA, persistence, settings, map handoff, export/restore;
- desktop and 320/768/1024/1440 px layouts;
- keyboard navigation, focus behavior, accessible names, clean console, and offline reload.

Final gates are tests, typecheck, lint, production build, local browser/runtime verification, offline preview, and a public/private source-parity check.

## Deployment and synchronization

Implementation starts in `VSU-SmartMap-public`. After verification, intentional source commits are ported to `VSU-SmartMap-private-history` without copying repository-specific metadata or unrelated artifacts. The mobile repository remains unchanged unless live TWA verification proves a wrapper problem.

Production rollout must verify the merged/deployed SHA at `https://vsumap.vercel.app`, confirm `/schedule` resolves, confirm an existing service-worker-controlled client upgrades, and test the Android deep link.

## Deferred work

Authenticated cross-device sync is intentionally deferred. If added, it requires normalized user-owned Supabase tables, explicit authenticated-only grants, RLS, account-scoped IndexedDB namespaces, an idempotent versioned outbox, merge/conflict UI, and sign-out cleanup. The local repository interface in this design is the compatibility boundary for that future work.
