# Schedule Google Sync and Shared Facility Search Design

## Summary

SmartMap will keep the student schedule anonymous, private, and offline-first by
default. A student may optionally sign in with Google through the existing
Supabase Auth integration and explicitly enable cross-device schedule sync.

The schedule course form will replace its static facility selector with the same
ranked, room-aware, keyboard-accessible facility search used by the map. The map
and schedule will share search behavior so their results cannot drift.

This release does not integrate Google Calendar. Google is used only as an
identity provider. Calendar export remains the existing local ICS download.

## Goals

- Preserve the fully functional anonymous schedule and its offline behavior.
- Let a signed-in student sync a schedule across browsers and devices.
- Prevent silent data loss during first sign-in or concurrent editing.
- Isolate local schedules by account on shared browsers.
- Keep every cloud row private to its owner through PostgreSQL RLS.
- Never place schedule contents in telemetry, URLs, service-worker caches, or
  application logs.
- Reuse the map's facility name, code, alias, and room search behavior in the
  schedule form.
- Preserve the existing 200-course and eight-meeting-per-course bounds.

## Non-goals

- Google Calendar read/write access or additional Google OAuth scopes.
- Schedule sharing, collaboration, public profiles, or administrator access to
  student schedules.
- Realtime subscriptions. Sync on mutation, reconnect, visibility change, and
  page load is sufficient.
- Automatic semantic deduplication of courses with different identifiers.
- Mandatory sign-in.

## Approaches considered

### Account-only schedule

Store all schedules in Supabase and require Google sign-in. This is the simplest
cloud model, but it removes anonymous use, weakens offline reliability, and adds
friction to a public campus map.

### Local schedule with automatic last-write-wins sync

Mirror IndexedDB to Supabase and choose whichever `updatedAt` value is newest.
This looks simple but device clocks are not trustworthy, deletions can be
resurrected, and concurrent devices can silently overwrite one another.

### Local-first schedule with explicit conflict handling

Keep IndexedDB authoritative for immediate UI behavior, add an account-scoped
outbox, and synchronize bounded per-course documents using server revisions and
deletion tombstones. First-sign-in collisions and concurrent edits are reviewed
rather than silently overwritten.

## Decision

Use local-first sync with explicit conflict handling.

Anonymous schedules remain under the local `guest` scope and make no schedule
network requests. Authenticated schedules use `user:<auth-user-id>` scopes.
Google sign-in does not automatically upload the guest schedule. The student
must choose what happens after authentication.

The account-sync UI is additionally guarded by the build-time
`NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED` flag. Missing or non-`true` values
fail closed to the anonymous local planner. This lets the compatible application
deploy before production schema enablement without exposing a broken sync path.

## User experience

### Anonymous schedule

- The schedule works exactly as it does today.
- The account panel explains that the schedule is stored only on this device.
- The primary call to action is `Sync with Google`.
- JSON backup and ICS export remain available without an account.

### Google sign-in

- `Sync with Google` starts the existing Supabase Google PKCE flow with
  `next=/schedule`.
- Only `openid`, email, and profile identity scopes are requested.
- OAuth failures return to `/schedule` with a user-safe error. They never send a
  student to the owner login page.
- Callback destinations use an exact same-origin allowlist for `/schedule` and
  `/owner`, plus the compatibility continuation
  `/boarding-houses/<canonical-slug>` used by review sign-in. Boarding-house
  slugs are constructed through a typed helper and must be 1–90 lowercase
  alphanumeric characters or single hyphen-separated segments. Raw or encoded
  separators, traversal, control characters, fragments, encodings, and query
  parameters are rejected before redirect construction.
- Callback `Location` values are relative approved paths, so the request host
  cannot influence the redirect origin.
- The schedule route remains public and does not require a student role.

### First sign-in reconciliation

The application loads the guest schedule, the account-scoped local schedule, and
the cloud schedule before enabling sync. Reconciliation models all three sources
with explicit `guest`, `account-local`, and `cloud` provenance.

- If all are empty, sync begins with an empty account schedule.
- If cloud is empty and guest has courses, offer `Copy this device to my
  account` or `Start with an empty account`.
- If guest is empty and cloud has courses, offer `Use my cloud schedule`.
- If both contain courses, open a reconciliation dialog with:
  - `Review and merge` as the recommended action;
  - `Replace cloud with this device`;
  - `Use cloud schedule`;
  - `Not now`.
- Distinct course IDs can be combined automatically in the review.
- Same-ID courses with different revisions require a per-course choice among
  every present source.
- A guest schedule is copied, not silently deleted. After a successful copy, the
  student may explicitly remove the guest copy from that device.

Destructive choices show course counts and require confirmation. Closing the
dialog leaves guest and cloud data unchanged.

### Ongoing sync

- Every create, edit, delete, clear, or restore commits locally first in one
  IndexedDB transaction with an outbox mutation.
- The UI updates immediately while offline.
- A compact account status shows `Saved`, `Syncing`, `Offline`, `Changes
  pending`, or `Needs review`.
- Outbox mutations are sent sequentially and are safe to retry.
- Pulls run after pushes so a device does not overwrite unseen server changes.
- A revision mismatch pauses only the affected course and opens a comparison
  dialog. Other courses may continue syncing.
- Signing out immediately switches the UI to the guest scope. Another account
  can never render the prior account's local schedule.
- Unsynced account data remains isolated under its account scope so it can be
  recovered when the same account returns. The account panel provides a
  deliberate `Remove local account data from this device` action.

## Local data architecture

Upgrade the Dexie database with scoped internal rows. Because IndexedDB primary
keys cannot be changed safely in place, add a new scoped course store and copy
the legacy rows instead of mutating the v10 object store's primary key:

- `schedule_scoped_courses`
  - stable encoded key derived from `scope` and course ID;
  - indexed by `scope` and local update time;
  - contains the validated `ScheduleCourse` document plus its known server
    revision.
- `schedule_outbox`
  - ordered local sequence;
  - at most one pending desired mutation per scope and course;
  - unique mutation ID for the current desired state;
  - scope, course ID, expected server revision, operation, and validated course
    payload when applicable.
- `schedule_sync_state`
  - one row per account scope;
  - pull cursor, consent state, last successful sync time, and bounded error
    state.
- `schedule_conflicts`
  - one row per unresolved course conflict;
  - source-tagged guest, account-local, and cloud validated versions plus their
    revisions.

The v11 upgrade copies every existing unscoped course to
`schedule_scoped_courses` under `guest`, validates the copied row, and clears the
legacy store only after the copy succeeds. The empty legacy object store remains
for this release to avoid a destructive schema transition. No course is uploaded
or deleted during migration.

Repeated offline changes to one course coalesce transactionally into the latest
desired state while retaining the last known server revision. Creating and then
deleting a never-synced course removes the net-zero outbox mutation. If a newer
local mutation arrives while an older mutation is in flight, acknowledging the
older mutation rebases the newer mutation to the returned canonical revision
instead of deleting it.

`ScheduleRepository` becomes scope-aware but retains its validation and
transactional behavior. A `ScheduleSyncCoordinator` owns network activity,
outbox replay, pull cursors, revision rebasing, and conflict transitions. React
components consume repository state and a small sync status interface; they do
not issue raw cloud writes.

## Cloud data architecture

Use one bounded per-course document table rather than a whole-schedule JSON
document or three child tables. A course is the conflict unit, and its one to
eight meetings are atomically stored in the course payload.

### `student_schedule_courses`

- `user_id uuid not null references auth.users(id) on delete cascade`
- `id uuid not null`
- `payload jsonb`
- `revision bigint not null`
- `server_version bigint not null`
- `last_mutation_id uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`
- primary key `(user_id, id)`

The payload contains the bounded course fields and meetings but not ownership or
server metadata. Active payloads must be JSON objects below a strict byte limit,
and the payload's course ID must equal the row ID. Tombstones set `payload` to
null so deleted schedules do not retain routine, location, instructor, or notes
data.

A database sequence supplies monotonically increasing `server_version` values.
Clients pull rows where `server_version` is greater than their cursor, ordered by
version and ID.

### Mutation RPC

`apply_student_schedule_mutation` derives ownership from `auth.uid()` and
accepts a mutation UUID, course UUID, expected revision, operation, and bounded
payload. It is the only cloud write surface.

Within one transaction it:

1. rejects unauthenticated calls;
2. serializes mutations for the user;
3. returns the prior result when the row's last mutation ID matches;
4. enforces the expected revision;
5. enforces the 200-active-course limit;
6. inserts, updates, or tombstones the course;
   deleting a missing course at expected revision `0` is a non-persisting,
   deterministic `deleted` no-op, while a nonzero expected revision conflicts;
7. increments the course revision and global server version;
8. returns the canonical row or an explicit conflict result.

Database checks and triggers enforce ownership immutability, payload size,
server timestamps, revision changes, and the active-course limit.

The function uses `SECURITY DEFINER` only because authenticated clients are not
granted direct table writes. It has an empty fixed search path, fully
schema-qualified object references, and a dedicated non-login owner whose
privileges are limited to this table and sequence. It performs an explicit
`auth.uid()` check before any data access.

## RLS and database privileges

The schedule table is in the exposed `public` schema and must have RLS enabled
before any client grant.

- Revoke all access from `PUBLIC` and `anon`.
- Grant table `SELECT` only to `authenticated` after policies exist.
- Revoke direct table `INSERT`, `UPDATE`, and `DELETE` from `authenticated`;
  every write must use the validated mutation function.
- `SELECT TO authenticated, student_schedule_mutator USING ((select
  auth.uid()) = user_id)`.
- `INSERT TO student_schedule_mutator WITH CHECK ((select auth.uid()) =
  user_id)`.
- `UPDATE TO student_schedule_mutator USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id)`.
- `DELETE TO student_schedule_mutator USING ((select auth.uid()) = user_id)`.
- Grant the mutation function only to `authenticated`; revoke it from `PUBLIC`
  and `anon`. Its dedicated non-login owner has no unrelated privileges.
- Never authorize by email, Google domain, user metadata, or a browser-supplied
  user ID.
- Never expose a service-role credential to the browser.

Adversarial tests must prove that anonymous callers and user B cannot read,
create, update, delete, attach, or discover user A's schedule rows. They must
also prove authenticated direct table DML fails for the row owner.

## Authentication hardening

The current owner/admin role system is separate from student identity. Ordinary
Google users receive no application role.

Before student OAuth is enabled:

- Remove the `ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK` authorization path.
- Remove the `ALLOW_LEGACY_USER_METADATA_ROLES` authorization path.
- Continue to fail closed when `app_user_roles` is unavailable.
- Retain only the explicit `BREAK_GLASS_ADMIN_USER_IDS` owner-controlled
  emergency allowlist.
- Verify the removed flags are absent from preview and production environments.
- Apply `harden_authenticated_student_access` before enabling the provider.
  Its catalog gate must prove that ordinary authenticated users cannot mutate
  facilities or rooms, discover/delete suggestions, or execute trigger and
  cleanup `SECURITY DEFINER` functions. Public facility/room reads and the
  server-controlled pending-suggestion RPC remain unchanged.
- Verify the six legacy `SECURITY DEFINER` functions have empty search paths and
  exact ACLs: only `has_app_role(app_user_role)` is callable by
  `authenticated`, and cleanup remains callable only by postgres-owned
  operations plus `service_role`.
- Verify `search_ai_knowledge_entries(text, integer, integer)` retains its
  result contract and public/authenticated read behavior with an empty search
  path and a fully qualified source relation.
- Recheck that the legacy `event-images` bucket has no upload, update, or delete
  policy for authenticated callers, and that postgres future-function defaults
  do not implicitly expose execution to API roles.

This prevents a missing role table or editable user metadata from promoting an
ordinary authenticated student.

The hosted project has no `pg_cron` extension, so the historical conditional
database schedule does not create a cleanup job. The existing daily Vercel
`/api/cron/storage-retention` job is the owner-controlled cleanup mechanism: it
keeps the exact `CRON_SECRET` bearer boundary, uses the server-only service-role
client to claim at most 100 expired rows with bounded leases, validates the
fixed private bucket/path, deletes each physical object through the Supabase
Storage API, and only then completes deletion of the exactly claimed database
row. Missing objects are treated as removed; invalid paths and transient
Storage failures release their exact claims, while completion failures retain
the claim for stale-lease recovery. The legacy metadata-only SQL cleanup is
disabled and uncallable, because direct deletion from `storage.objects` can
orphan physical files. All three daily retention jobs start independently;
any failure produces only a generic no-store non-2xx response without
preventing the other jobs from running. Production requires `CRON_SECRET`,
`NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; after deployment,
invoke the job and monitor its Vercel execution logs for a successful daily run.

The browser client uses the existing Supabase SSR integration and PKCE callback.
Cloud authorization always relies on Supabase's verified access token and RLS.
Offline UI may use the locally cached session only to select its isolated local
scope; it is never an authorization boundary for cloud access.

## Shared facility search

Extract the map's facility search into focused shared units:

- a pure ranked suggestion model based on `getSearchSuggestions`;
- a cache-first room search hook with the existing two-character threshold,
  cancellation, and bounded result display;
- an accessible controlled `FacilitySearchCombobox`.

The map and schedule both use those units.

The schedule's `Campus facility` mode replaces the native facility `<select>`
with `Search campus facility`. Results match the map by:

1. exact facility code;
2. code prefix and substring;
3. facility name prefix and substring;
4. description aliases;
5. matching room code or room name.

Results show facility name, code/category, and a matched room indicator. Choosing
a room result selects its parent facility but does not silently overwrite the
separate optional room/detail field.

The combobox supports a programmatic label, `aria-autocomplete`, listbox and
option relationships, active-descendant state, Arrow Up/Down, Enter, Escape,
pointer selection, click outside, loading, offline-cache, unavailable, and
no-results states. Results remain capped at eight.

Cached facility and room results are published before a deferred network refresh
resolves. A successful remote empty result is canonical and clears stale cached
results; it is not treated as a network failure.

Map-only side effects such as opening the map sheet, changing categories, TBA
help, and recent navigation history remain in the map parent. Schedule selection
only writes the form's facility ID and clears its validation error.

## Privacy and disclosure

Schedules reveal predictable routines and locations. The schedule page will
state:

- anonymous schedules remain on the device;
- account sync is optional;
- signed-in schedules are stored in the student's private Supabase rows;
- account data is not shared with Google or Google Calendar;
- JSON and ICS exports contain schedule details;
- deleting an account schedule clears active payloads and leaves only
  content-free synchronization tombstones.

No course code, title, instructor, notes, meeting time, location, sync payload,
OAuth code, provider token, or conflict document may enter analytics,
observability logs, URLs, or service-worker API caches.

## Error handling

- Auth failure: return to `/schedule`, preserve all local data, show retry.
- Facility refresh failure: use cached facilities and rooms; distinguish
  unavailable data from no match.
- Expired session: pause cloud sync, preserve the outbox, request sign-in.
- Offline: continue local writes and display pending count.
- Invalid remote payload: quarantine the affected course as a sync conflict; do
  not replace valid local data.
- Revision conflict: preserve both versions and request a per-course choice.
- RLS or server error: use a generic message and never log schedule content.
- IndexedDB quota/unavailable: retain the existing persistent storage error and
  do not claim that a change was saved.
- Course limit: enforce locally and in PostgreSQL; a remote over-limit state
  enters review instead of truncating courses.

## Testing

### Unit and repository

- Scope selection and account switching.
- v10-to-v11 guest migration.
- Atomic local course plus outbox writes.
- Idempotent mutation replay.
- Pull cursor ordering.
- Offline create, edit, delete, clear, and restore.
- Same-ID and distinct-ID reconciliation.
- Tombstones never resurrect deleted courses.
- Invalid remote payload quarantine.
- Existing validation, conflict, backup, ICS, and 200-course boundaries.

### Database

- Fresh migration reset and migration-list verification.
- Anonymous denial.
- User A/user B isolation for every CRUD operation.
- Ownership reassignment denial.
- Mutation RPC authentication, idempotency, revision conflicts, and quota.
- Concurrent insert protection at 200 active courses.
- Tombstone payload erasure.
- Security and performance advisors after migration.

### Browser

- Anonymous schedule makes no schedule API requests.
- Google sign-in returns to the schedule.
- First-sign-in choices preserve both sources until confirmed.
- Two accounts in one browser never render one another's local data.
- Offline mutations survive reload and sync after reconnect.
- Conflict dialog is keyboard and screen-reader usable.
- Map and schedule return the same facility ordering for name, code, alias, and
  room queries.
- Facility picker works at 320, 768, 1024, and 1440 CSS pixels.
- Existing map handoff opens the selected facility.
- Service-worker caches contain the shell but no schedule API response or
  personal payload.

Final gates are tests, typecheck, lint, production build, local Supabase reset
and RLS harness, browser checks, public/private parity, preview deployment, and
production verification against the merged SHA.

## Rollout and rollback

1. Pin the existing Supabase packages to exact versions before changing auth or
   sync code.
2. Add and verify the migration locally.
3. Deploy the application to production with the sync flag disabled, and deploy
   schema plus the enabled UI to preview/staging.
4. Verify Google provider configuration, exact redirect allowlists, removed
   fallback flags, the authenticated-student database-hardening catalog/runtime
   gates, the secured daily storage-retention job and its monitored
   verification-document cleanup result, RLS advisors, and preview browser
   flows.
5. Enable sync in preview and complete two-account/offline/conflict tests.
6. Merge through protected `main`.
7. Apply the production migration and verify it while the production flag
   remains disabled.
8. Set the production flag to `true`, redeploy the same merge commit, and verify
   `vsumap.vercel.app` plus the Android TWA route.

Before any schedule rows exist, rollback may use a new migration that removes
the additive tables. After user data exists, rollback disables sync and revokes
authenticated grants while preserving data. Production schedule data is never
dropped without an approved retention/export process.

## Acceptance criteria

- Anonymous use and offline reload remain fully functional.
- Google sign-in is optional and returns safely to `/schedule`.
- A student explicitly chooses whether local data is copied to the account.
- Concurrent changes never silently overwrite a course.
- All cloud rows are private to `auth.uid()` under adversarial testing.
- Account switching cannot reveal another account's local schedule.
- Map and schedule facility searches share ranking and accessible behavior.
- No schedule content enters logs, URLs, analytics, or service-worker caches.
- Preview and production are verified against their exact deployed revisions.
