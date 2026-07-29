# Schedule Google Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Google-authenticated, RLS-protected, offline-first cross-device schedule sync without changing anonymous schedule behavior.

**Architecture:** IndexedDB remains the immediate data source and gains account-scoped courses, a transactional outbox, pull cursors, and explicit conflicts. Supabase stores bounded per-course documents with owner RLS, server revisions, tombstones, and an idempotent mutation RPC. Google OAuth supplies identity only; reconciliation and sync begin only after user consent.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/PostgREST, `@supabase/ssr`, Dexie 4, React Hook Form, Node test runner, local Supabase CLI 2.107.0, Playwright, Vercel.

---

### Task 1: Pin Supabase clients and remove unsafe role fallbacks

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/auth/roles.ts`
- Modify: `lib/auth/roles.test.ts`
- Modify: `lib/auth/server.ts`
- Modify: `lib/auth/server.test.ts`
- Modify: `lib/supabase/middleware.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write failing fail-closed role tests**

Replace the fallback expectations with:

```ts
test("missing role data never grants admin access", () => {
  assert.equal(canAccessAdminArea([]), false);
});

test("user metadata is never an authorization source", () => {
  assert.deepEqual(getMetadataAppRoles({
    app_metadata: {},
    user_metadata: { role: "admin", roles: ["admin"] },
  } as never), []);
});
```

In `lib/auth/server.test.ts`, change the missing-role-table test to assert that
`assertAdminAction` rejects and never constructs a service-role client.

- [ ] **Step 2: Run the auth tests and verify RED**

Run:

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/auth/roles.test.ts lib/auth/server.test.ts
```

Expected: FAIL because the explicit environment fallback still authorizes.

- [ ] **Step 3: Remove both legacy fallback paths**

Delete `shouldAllowMissingRoleTableAdminFallback`,
`shouldAllowLegacyUserMetadataRoles`, and their call sites. Role resolution must
be:

```ts
const roles = user
  ? mergeAppRoles(
      normalizeAppRoles(roleResult?.data?.map((row) => row.role)),
      isBreakGlassAdmin(user.id) ? ["admin"] : [],
    )
  : [];
```

If the role query fails, keep `roles` empty except for the explicit break-glass
user-ID allowlist. Do not read `user_metadata` for authorization.

- [ ] **Step 4: Remove obsolete environment documentation**

Delete `ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK` and
`ALLOW_LEGACY_USER_METADATA_ROLES` from `.env.example` and README. Retain
`BREAK_GLASS_ADMIN_USER_IDS` with its existing owner-controlled semantics.

- [ ] **Step 5: Pin the installed Supabase versions**

Set:

```json
"@supabase/ssr": "0.7.0",
"@supabase/supabase-js": "2.78.0"
```

Then refresh lock metadata without upgrading:

```bash
rtk proxy npm install --package-lock-only --ignore-scripts
```

Expected: the root dependency declarations become exact and resolved package
versions remain `0.7.0` and `2.78.0`.

- [ ] **Step 6: Run auth, type, and dependency checks**

Run:

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/auth/roles.test.ts lib/auth/server.test.ts lib/auth/route-access.test.ts
rtk proxy npm ls @supabase/ssr @supabase/supabase-js --depth=0
rtk npm run typecheck
```

Expected: tests PASS, exact versions are reported, and typecheck PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json package-lock.json lib/auth/roles.ts lib/auth/roles.test.ts lib/auth/server.ts lib/auth/server.test.ts lib/supabase/middleware.ts .env.example README.md
rtk git commit -m "fix(auth): fail closed before student OAuth"
```

### Task 2: Make the OAuth callback schedule-safe

**Files:**
- Create: `lib/auth/oauth-return.ts`
- Create: `lib/auth/oauth-return.test.ts`
- Modify: `lib/auth/oauth.ts`
- Modify: `app/auth/callback/route.ts`
- Create: `app/auth/callback/route.test.ts`
- Modify: `components/boarding-houses/review-form.tsx` (compatibility caller)

- [ ] **Step 1: Write failing redirect-policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  boardingHouseOAuthNext,
  oauthFailurePath,
  safeOauthNext,
} from "./oauth-return.ts";

test("accepts typed schedule, owner, and boarding-house return paths", () => {
  assert.equal(safeOauthNext("/schedule"), "/schedule");
  assert.equal(safeOauthNext("/owner"), "/owner");
  assert.equal(
    safeOauthNext("/boarding-houses/green-gate-abc123"),
    boardingHouseOAuthNext("green-gate-abc123"),
  );
});

test("rejects absolute and protocol-relative destinations", () => {
  assert.equal(safeOauthNext("https://evil.test"), "/");
  assert.equal(safeOauthNext("//evil.test"), "/");
  assert.equal(safeOauthNext("/\\evil.test"), "/");
  assert.equal(safeOauthNext("/%5cevil.test"), "/");
  assert.equal(safeOauthNext("/%2fevil.test"), "/");
  assert.equal(safeOauthNext("/schedule#token"), "/");
  assert.equal(safeOauthNext("/schedule?next=//evil.test"), "/");
});

test("returns failures to the initiating product surface", () => {
  assert.equal(oauthFailurePath("/schedule"), "/schedule?auth_error=oauth");
  assert.equal(oauthFailurePath("/owner"), "/owner/login?error=oauth");
});
```

Compatibility amendment: preserve the existing review sign-in continuation
only for `/boarding-houses/<canonical-slug>`. Construct that path through a
typed helper; accept 1–90 lowercase alphanumeric characters arranged as
single-hyphen-separated segments, and reject encoding, traversal, extra
segments, query, and fragment variants. Review failures return to the validated
listing path with `auth_error=oauth`.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/auth/oauth-return.test.ts
```

Expected: FAIL because `oauth-return.ts` is absent.

- [ ] **Step 3: Implement the return policy**

```ts
declare const boardingHouseOAuthNextBrand: unique symbol;
export type BoardingHouseOAuthNext = string & {
  readonly [boardingHouseOAuthNextBrand]: true;
};
export type OAuthNext = "/schedule" | "/owner" | BoardingHouseOAuthNext;

const BOARDING_HOUSE_PREFIX = "/boarding-houses/";
const BOARDING_HOUSE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function boardingHouseOAuthNext(
  slug: string,
): BoardingHouseOAuthNext {
  if (slug.length > 90 || !BOARDING_HOUSE_SLUG.test(slug)) {
    throw new Error("Invalid boarding-house slug");
  }
  return `${BOARDING_HOUSE_PREFIX}${slug}` as BoardingHouseOAuthNext;
}

export function safeOauthNext(value: string | null): OAuthNext | "/" {
  if (
    !value ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    /%(?:2f|5c)/i.test(value)
  ) return "/";
  let parsed: URL;
  try {
    parsed = new URL(value, "https://smartmap.invalid");
  } catch {
    return "/";
  }
  if (
    parsed.origin !== "https://smartmap.invalid" ||
    parsed.hash ||
    parsed.search ||
    parsed.pathname !== value
  ) return "/";
  if (parsed.pathname === "/schedule" || parsed.pathname === "/owner") {
    return parsed.pathname;
  }
  if (parsed.pathname.startsWith(BOARDING_HOUSE_PREFIX)) {
    const slug = parsed.pathname.slice(BOARDING_HOUSE_PREFIX.length);
    if (slug.length <= 90 && BOARDING_HOUSE_SLUG.test(slug)) {
      return parsed.pathname as BoardingHouseOAuthNext;
    }
  }
  return "/";
}

export function oauthFailurePath(next: OAuthNext | "/"): string {
  if (next === "/schedule") return "/schedule?auth_error=oauth";
  if (next.startsWith(BOARDING_HOUSE_PREFIX)) {
    return `${next}?auth_error=oauth`;
  }
  return "/owner/login?error=oauth";
}
```

Change `signInWithGoogle` to require an explicit safe `next`:

```ts
import type { OAuthNext } from "@/lib/auth/oauth-return";

export async function signInWithGoogle(next: OAuthNext): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo =
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Update and test the callback**

Use `safeOauthNext` before exchange. On success redirect to `next`; on missing
code, initialization, cookie handling, thrown exchange, or returned exchange
error redirect to `oauthFailurePath(next)` without logging sensitive details.
Collect and forward any cookies Supabase emits by applying them to the actual
returned `NextResponse`. The pinned SDK's returned-error path emits no cookies;
tests model that behavior separately from a synthetic adapter-contract case
that proves emitted cookies are forwarded. Emit only relative allowlisted `Location` values so request-host
input cannot control the destination. Add mocked route tests proving schedule
success/failure, owner and review compatibility, response cookie propagation,
generic exception handling, hostile-host isolation, and rejection of external
`next`.

- [ ] **Step 5: Run callback and auth tests**

Run:

```bash
rtk proxy node --experimental-test-module-mocks --import tsx --test lib/auth/oauth-return.test.ts app/auth/callback/route.test.ts
rtk npm run typecheck
```

Expected: all tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add lib/auth/oauth-return.ts lib/auth/oauth-return.test.ts lib/auth/oauth.ts app/auth/callback/route.ts app/auth/callback/route.test.ts
rtk git commit -m "feat(auth): return student OAuth safely to schedule"
```

### Task 3: Add the RLS-protected schedule schema and mutation RPC

**Files:**
- Create with CLI: the exact migration path printed by
  `supabase migration new student_schedule_sync`
- Create: `tools/qa/rls-student-schedules.mjs`
- Create: `tools/qa/rls-student-schedules.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the migration through the pinned CLI**

Run:

```bash
rtk proxy npx --yes supabase@2.107.0 migration new student_schedule_sync
```

Expected: Supabase prints the exact new migration path. Use that CLI-created path
for every remaining step; do not rename it or invent a timestamp.

- [ ] **Step 2: Write a failing migration contract test**

```ts
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function readScheduleSyncMigration() {
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  const matches = (await readdir(directory))
    .filter((name) => name.endsWith("_student_schedule_sync.sql"))
    .sort();
  assert.equal(matches.length, 1);
  return readFile(new URL(matches[0]!, directory), "utf8");
}

test("student schedule migration is owner-scoped and deny-by-default", async () => {
  const migration = await readScheduleSyncMigration();
  for (const pattern of [
    /CREATE TABLE public\.student_schedule_courses/i,
    /ENABLE ROW LEVEL SECURITY/i,
    /TO authenticated[\s\S]+auth\.uid\(\)[\s\S]+user_id/i,
    /REVOKE ALL[\s\S]+FROM PUBLIC, anon/i,
    /apply_student_schedule_mutation/i,
    /SECURITY DEFINER/i,
    /GRANT SELECT ON TABLE public\.student_schedule_courses TO authenticated/i,
    /REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC, anon/i,
  ]) assert.match(migration, pattern);
  assert.doesNotMatch(migration, /user_metadata|auth\.email/i);
  assert.doesNotMatch(
    migration,
    /GRANT[^;]*\b(?:INSERT|UPDATE|DELETE)\b[^;]*TO authenticated/i,
  );
});
```

- [ ] **Step 3: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test tools/qa/rls-student-schedules.test.ts
```

Expected: FAIL because the empty migration lacks the schema and policies.

- [ ] **Step 4: Implement the schema**

The migration must create:

```sql
CREATE SEQUENCE public.student_schedule_server_version_seq AS BIGINT;

CREATE TABLE public.student_schedule_courses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  payload JSONB,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  server_version BIGINT NOT NULL
    DEFAULT nextval('public.student_schedule_server_version_seq'),
  last_mutation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, id),
  CHECK (
    (
      deleted_at IS NULL
      AND jsonb_typeof(payload) = 'object'
      AND octet_length(convert_to(payload::text, 'UTF8')) <= 32768
      AND payload ->> 'id' = id::text
    )
    OR (deleted_at IS NOT NULL AND payload IS NULL)
  )
);

CREATE INDEX student_schedule_courses_pull_idx
  ON public.student_schedule_courses (user_id, server_version, id);
```

Add trigger functions that:

- derive all server timestamps;
- keep `user_id` and `id` immutable;
- increment `revision` and `server_version` on update;
- serialize active-course inserts per user with `pg_advisory_xact_lock`;
- reject more than 200 active rows;
- erase payload when tombstoning.

- [ ] **Step 5: Implement the mutation RPC**

Create a dedicated `student_schedule_mutator` `NOLOGIN NOINHERIT` role if it
does not exist. Grant it only schema usage plus the schedule table/sequence
privileges needed by this function.

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'student_schedule_mutator'
  ) THEN
    EXECUTE 'CREATE ROLE student_schedule_mutator NOLOGIN NOINHERIT';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public, auth TO student_schedule_mutator;
```

Create `public.apply_student_schedule_mutation` as `SECURITY DEFINER`, owned by
that dedicated role, with `SET search_path = ''` and fully schema-qualified
references. It accepts:

```sql
p_mutation_id UUID,
p_course_id UUID,
p_expected_revision BIGINT,
p_operation TEXT,
p_payload JSONB DEFAULT NULL
```

It derives `v_user_id := (select auth.uid())`, rejects null before data access,
locks the user's mutation stream, returns the existing canonical result when
`last_mutation_id` matches, returns `status = 'conflict'` when the expected
revision differs, and otherwise inserts, updates, or tombstones. New rows
require expected revision `0`; operations are only `upsert` and `delete`.
Deleting a missing course with expected revision `0` returns a deterministic
canonical `deleted` no-op without creating a tombstone row or consuming a
server version. A missing delete with a nonzero expected revision conflicts.

Temporarily grant the role `CREATE` on `public` only for ownership transfer,
then revoke it immediately:

```sql
GRANT CREATE ON SCHEMA public TO student_schedule_mutator;
ALTER FUNCTION public.apply_student_schedule_mutation(
  UUID, UUID, BIGINT, TEXT, JSONB
) OWNER TO student_schedule_mutator;
REVOKE CREATE ON SCHEMA public FROM student_schedule_mutator;
```

Return:

```sql
status TEXT,
id UUID,
payload JSONB,
revision BIGINT,
server_version BIGINT,
created_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ,
deleted_at TIMESTAMPTZ
```

- [ ] **Step 6: Add RLS and privileges in the safe order**

```sql
ALTER TABLE public.student_schedule_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_schedule_select_own
ON public.student_schedule_courses FOR SELECT
TO authenticated, student_schedule_mutator
USING ((select auth.uid()) = user_id);

CREATE POLICY student_schedule_insert_own
ON public.student_schedule_courses FOR INSERT TO student_schedule_mutator
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY student_schedule_update_own
ON public.student_schedule_courses FOR UPDATE TO student_schedule_mutator
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY student_schedule_delete_own
ON public.student_schedule_courses FOR DELETE TO student_schedule_mutator
USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.student_schedule_courses
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.student_schedule_courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.student_schedule_courses TO student_schedule_mutator;
REVOKE ALL ON SEQUENCE public.student_schedule_server_version_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT
  ON SEQUENCE public.student_schedule_server_version_seq
  TO student_schedule_mutator;
REVOKE ALL ON FUNCTION public.apply_student_schedule_mutation(
  UUID, UUID, BIGINT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_student_schedule_mutation(
  UUID, UUID, BIGINT, TEXT, JSONB
) TO authenticated;
```

- [ ] **Step 7: Build the local adversarial harness**

Follow `tools/qa/rls-boarding-houses.mjs` and its loopback guard. Seed two local
users, authenticate as anon/user A/user B, and assert:

```js
await deny(anon.from("student_schedule_courses").select("*"));
await allow(userA.rpc("apply_student_schedule_mutation", userAMutation));
await deny(userB.from("student_schedule_courses")
  .select("*").eq("user_id", userAId));
await deny(userB.from("student_schedule_courses")
  .update({ user_id: userBId }).eq("user_id", userAId));
await deny(userB.from("student_schedule_courses")
  .delete().eq("user_id", userAId));
```

Also assert idempotent replay, expected-revision conflict, tombstone payload
erasure, the concurrent 200-course boundary, and that user A's direct
`INSERT`/`UPDATE`/`DELETE` requests fail even against user A's own rows.

- [ ] **Step 8: Start/reset local Supabase and verify**

Run:

```bash
rtk npm run db:start
rtk npm run db:reset
rtk proxy npx --yes supabase@2.107.0 migration list --local
rtk proxy node tools/qa/rls-student-schedules.mjs
rtk proxy npx --yes supabase@2.107.0 db lint --local
```

Expected: migration is applied, adversarial matrix PASS, and lint reports no new
errors. If the container runtime is unavailable, repair/start the existing local
runtime rather than applying unverified SQL to production.

- [ ] **Step 9: Run advisors against the verified development target**

Run security and performance advisors through the connected Supabase tooling.
Expected: no new missing-RLS, unsafe-function, or unindexed-policy findings.

- [ ] **Step 10: Commit**

```bash
rtk git add supabase/migrations tools/qa/rls-student-schedules.mjs tools/qa/rls-student-schedules.test.ts package.json
rtk git commit -m "feat(schedule): add private sync schema and RLS"
```

### Task 3B: Gate student OAuth on database hardening

**Files:**
- Create: `supabase/migrations/20260728163845_harden_authenticated_student_access.sql`
- Create: `tools/qa/authenticated-student-db-hardening.test.ts`
- Create: `tools/qa/rls-authenticated-student-hardening.mjs`

- [ ] Generate the migration with pinned Supabase CLI 2.107.0.
- [ ] First capture failing contract tests for dangerous hosted policy names,
  function ACLs/search paths, legacy event-image writes, future-function
  defaults, and the public AI search RPC.
- [ ] Apply a fresh local reset and prove with catalog plus adversarial runtime
  checks that ordinary authenticated students cannot mutate facilities/rooms,
  read or delete arbitrary suggestions, or execute cleanup/trigger routines.
- [ ] Prove public facility/room reads, authenticated `has_app_role`, admin RLS,
  service operations, postgres-owner cleanup invocation, and public AI search
  remain valid.
- [ ] Run the database lint warning gate and all proportional quality gates.
- [ ] Before provider enablement, deploy and invoke the existing daily
  `/api/cron/storage-retention` job with `CRON_SECRET` plus service-role
  credentials, confirm its bounded verification-document claim → Storage API
  removal → exact completion/release summaries, and monitor non-2xx Vercel cron
  executions. Confirm all three cleanup jobs run even when one fails. Hosted
  `pg_cron` remains absent; the disabled legacy metadata-only cleanup and new
  lease RPCs must remain unavailable to browser roles.

This task is a blocking OAuth rollout gate and requires security review before
the provider or schedule-sync flag is enabled.

### Task 4: Migrate IndexedDB to account-scoped storage

**Files:**
- Create: `lib/schedule/scope.ts`
- Create: `lib/schedule/scope.test.ts`
- Create: `lib/schedule/local-types.ts`
- Modify: `lib/db.ts`
- Modify: `lib/schedule/repository.ts`
- Modify: `lib/schedule/repository.test.ts`

- [ ] **Step 1: Write failing scope and migration tests**

```ts
test("builds stable guest and account scopes without accepting arbitrary text", () => {
  assert.equal(GUEST_SCHEDULE_SCOPE, "guest");
  assert.equal(
    accountScheduleScope("11111111-1111-4111-8111-111111111111"),
    "user:11111111-1111-4111-8111-111111111111",
  );
  assert.throws(() => accountScheduleScope("not-a-uuid"));
});

test("database v11 copies v10 courses to guest before clearing legacy rows", async () => {
  const source = await readFile(new URL("../db.ts", import.meta.url), "utf8");
  assert.match(source, /version\(11\)/);
  assert.match(source, /schedule_scoped_courses/);
  assert.match(source, /scope:\s*GUEST_SCHEDULE_SCOPE/);
  assert.match(source, /schedule_courses[\s\S]+clear/);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/scope.test.ts lib/schedule/repository.test.ts
```

Expected: FAIL because scope types and v11 stores do not exist.

- [ ] **Step 3: Add scoped local types**

```ts
export const GUEST_SCHEDULE_SCOPE = "guest" as const;
export type ScheduleScope = typeof GUEST_SCHEDULE_SCOPE | `user:${string}`;

export interface StoredScopedScheduleCourse {
  key: string;
  scope: ScheduleScope;
  id: string;
  course: ScheduleCourse;
  serverRevision?: number;
}

export interface ScheduleOutboxMutation {
  sequence?: number;
  mutationId: string;
  scope: ScheduleScope;
  courseId: string;
  expectedRevision: number;
  operation: "upsert" | "delete";
  course?: ScheduleCourse;
  createdAt: string;
}

export const scopedCourseKey = (scope: ScheduleScope, id: string) =>
  `${scope}|${id}`;
```

Validate account IDs through the existing canonical UUID helper.

- [ ] **Step 4: Add the non-destructive Dexie v11 migration**

Declare:

```ts
schedule_scoped_courses!: Table<StoredScopedScheduleCourse, string>;
schedule_outbox!: Table<ScheduleOutboxMutation, number>;
schedule_sync_state!: Table<ScheduleSyncState, string>;
schedule_conflicts!: Table<StoredScheduleConflict, string>;
```

Add:

```ts
this.version(11).stores({
  schedule_scoped_courses: "&key, scope, id, course.updatedAt",
  schedule_outbox: "++sequence, &[scope+courseId], scope, mutationId, createdAt",
  schedule_sync_state: "&scope",
  schedule_conflicts: "&key, scope, courseId",
}).upgrade(async (tx) => {
  const legacy = await tx.table("schedule_courses").toArray();
  const migrated = legacy.map((value) => {
    const course = parseStoredScheduleCourse(value);
    return {
      key: scopedCourseKey(GUEST_SCHEDULE_SCOPE, course.id),
      scope: GUEST_SCHEDULE_SCOPE,
      id: course.id,
      course,
    };
  });
  await tx.table("schedule_scoped_courses").bulkPut(migrated);
  await tx.table("schedule_courses").clear();
});
```

Keep the empty v10 store declaration for this release. If parsing fails, the
upgrade transaction must abort and leave legacy data untouched.

- [ ] **Step 5: Make the repository scope-aware**

```ts
export class ScheduleRepository {
  constructor(
    private readonly scope: ScheduleScope = GUEST_SCHEDULE_SCOPE,
    private readonly storeFactory: ScopedScheduleStoreFactory = productionStore,
  ) {}
}
```

Every query filters `scope`; every key uses `scopedCourseKey`. Keep public
methods and validation behavior unchanged. Guest CRUD must not create outbox
rows. Account CRUD gains separate atomic methods in Task 5.

- [ ] **Step 6: Run scoped repository and schema tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/scope.test.ts lib/schedule/repository.test.ts
rtk npm run typecheck
```

Expected: legacy migration contract, guest isolation, account isolation, course
limit, corruption handling, and typecheck PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/schedule/scope.ts lib/schedule/scope.test.ts lib/schedule/local-types.ts lib/db.ts lib/schedule/repository.ts lib/schedule/repository.test.ts
rtk git commit -m "feat(schedule): isolate local data by account"
```

### Task 5: Add atomic outbox-backed account writes

**Files:**
- Create: `lib/schedule/outbox.ts`
- Create: `lib/schedule/outbox.test.ts`
- Modify: `lib/schedule/repository.ts`
- Modify: `lib/schedule/repository.test.ts`

- [ ] **Step 1: Write failing atomic-write tests**

```ts
test("account put writes course and mutation in one transaction", async () => {
  const store = new FakeScopedStore();
  const repository = new ScheduleRepository(USER_SCOPE, () => store);
  await repository.put(courseInput);
  assert.equal(store.transactions.length, 1);
  assert.equal(store.courses.length, 1);
  assert.deepEqual(store.outbox.map((item) => item.operation), ["upsert"]);
});

test("guest put never creates a cloud mutation", async () => {
  const store = new FakeScopedStore();
  await new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).put(courseInput);
  assert.equal(store.outbox.length, 0);
});

test("failed outbox persistence rolls back the course change", async () => {
  const store = new FakeScopedStore({ failOutbox: true });
  await assert.rejects(
    new ScheduleRepository(USER_SCOPE, () => store).put(courseInput),
  );
  assert.deepEqual(store.courses, []);
});

test("repeated offline edits coalesce to one latest desired mutation", async () => {
  const store = new FakeScopedStore();
  const repository = new ScheduleRepository(USER_SCOPE, () => store);
  await repository.put(courseInput);
  await repository.put({ ...courseInput, title: "Latest title" });
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0]?.course?.title, "Latest title");
  assert.equal(store.outbox[0]?.expectedRevision, 0);
});

test("create then delete before first sync leaves no cloud mutation", async () => {
  const store = new FakeScopedStore();
  const repository = new ScheduleRepository(USER_SCOPE, () => store);
  const created = await repository.put(courseInput);
  await repository.remove(created.id);
  assert.equal(store.outbox.length, 0);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/outbox.test.ts lib/schedule/repository.test.ts
```

Expected: FAIL because account mutations are not transactional.

- [ ] **Step 3: Implement mutation creation**

```ts
export function createScheduleMutation(input: {
  scope: ScheduleScope;
  courseId: string;
  expectedRevision?: number;
  operation: "upsert" | "delete";
  course?: ScheduleCourse;
  now?: Date;
}): ScheduleOutboxMutation {
  if (input.scope === GUEST_SCHEDULE_SCOPE) {
    throw new Error("Guest schedules do not create sync mutations.");
  }
  return {
    mutationId: crypto.randomUUID(),
    scope: input.scope,
    courseId: input.courseId,
    expectedRevision: input.expectedRevision ?? 0,
    operation: input.operation,
    course: input.course,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}
```

Inject ID/time functions in tests so mutation output is deterministic.

- [ ] **Step 4: Implement atomic account CRUD**

Within one Dexie transaction over `schedule_scoped_courses` and
`schedule_outbox`, write the normalized course and coalesce its pending desired
mutation. Preserve the original expected server revision across repeated edits.
A create followed by delete before revision 1 removes the net-zero outbox row.
A delete followed by recreate becomes one upsert against the original known
revision. Clear and restore compute bounded per-course desired mutations and
apply all course/outbox changes atomically. Preserve the shared 200-course
limit.

- [ ] **Step 5: Run outbox and regression tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/outbox.test.ts lib/schedule/repository.test.ts lib/schedule/backup.test.ts
rtk npm test
```

Expected: all tests PASS and anonymous behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
rtk git add lib/schedule/outbox.ts lib/schedule/outbox.test.ts lib/schedule/repository.ts lib/schedule/repository.test.ts
rtk git commit -m "feat(schedule): queue account changes atomically"
```

### Task 6: Implement pure reconciliation and sync transitions

**Files:**
- Create: `lib/schedule/sync/types.ts`
- Create: `lib/schedule/sync/reconcile.ts`
- Create: `lib/schedule/sync/reconcile.test.ts`
- Create: `lib/schedule/sync/state.ts`
- Create: `lib/schedule/sync/state.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Cover the complete matrix:

```ts
test("distinct IDs merge without overwriting either source", () => {
  const result = reconcileScheduleSources({
    guest: [guestCourse],
    accountLocal: [localCourse],
    cloud: [remoteCourse],
  });
  assert.equal(result.kind, "merge-ready");
  assert.deepEqual(result.courses.map((item) => ({
    id: item.course.id,
    source: item.source,
  })).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: guestCourse.id, source: "guest" },
    { id: localCourse.id, source: "account-local" },
    { id: remoteCourse.id, source: "cloud" },
  ].sort((a, b) => a.id.localeCompare(b.id)));
});

test("same ID retains every source for explicit review", () => {
  const cloudVersion = { ...localCourse, title: "Cloud title" };
  const result = reconcileScheduleSources({
    guest: [{ ...localCourse, title: "Guest title" }],
    accountLocal: [localCourse],
    cloud: [cloudVersion],
  });
  assert.equal(result.kind, "conflict");
  assert.equal(result.conflicts[0]?.courseId, localCourse.id);
  assert.deepEqual(
    result.conflicts[0]?.versions.map((item) => item.source),
    ["guest", "account-local", "cloud"],
  );
});

test("remote tombstone prevents offline resurrection", () => {
  assert.equal(resolvePulledRow({
    accountLocal: localCourse,
    cloud: tombstone,
    pendingMutation: undefined,
  }).kind, "delete-local");
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/reconcile.test.ts lib/schedule/sync/state.test.ts
```

Expected: FAIL because sync modules are absent.

- [ ] **Step 3: Define explicit sync types**

```ts
export type CloudScheduleRow = {
  id: string;
  payload: unknown | null;
  revision: number;
  serverVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type ReconciliationSource = "guest" | "account-local" | "cloud";
export type ReconciliationVersion = {
  source: ReconciliationSource;
  course: ScheduleCourse;
  revision?: number;
};

export type SyncStatus =
  | { kind: "guest" }
  | { kind: "saved"; lastSyncedAt: string }
  | { kind: "syncing"; pending: number }
  | { kind: "offline"; pending: number }
  | { kind: "pending"; pending: number }
  | { kind: "needs-review"; conflicts: number }
  | { kind: "auth-required"; pending: number }
  | { kind: "error"; message: string; pending: number };
```

Use discriminated unions for reconciliation and mutation results. Do not use
booleans whose invalid combinations must be inferred.

- [ ] **Step 4: Implement deterministic reconciliation**

Validate every cloud payload with `parseStoredScheduleCourse`. Accept guest,
account-local, and cloud inputs separately and retain provenance on every
candidate. Distinct IDs merge; identical same-ID documents coalesce; divergent
same-ID documents produce conflicts containing every present source. Tombstones
delete only when no newer pending account-local mutation exists. Sort all
outputs by stable course ID. Never compare client clocks to choose a winner.

- [ ] **Step 5: Implement the sync state reducer**

The reducer accepts `AUTH_CHANGED`, `ONLINE`, `OFFLINE`, `PUSH_STARTED`,
`PUSH_ACKNOWLEDGED`, `PULL_APPLIED`, `CONFLICT`, `AUTH_EXPIRED`, and `FAILED`.
It must retain pending/conflict counts and never claim `saved` while either is
nonzero.

- [ ] **Step 6: Run pure sync tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/reconcile.test.ts lib/schedule/sync/state.test.ts
```

Expected: all matrix and transition tests PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/schedule/sync
rtk git commit -m "feat(schedule): define deterministic sync reconciliation"
```

### Task 7: Add the Supabase schedule gateway and coordinator

**Files:**
- Create: `lib/schedule/sync/cloud-gateway.ts`
- Create: `lib/schedule/sync/cloud-gateway.test.ts`
- Create: `lib/schedule/sync/coordinator.ts`
- Create: `lib/schedule/sync/coordinator.test.ts`

- [ ] **Step 1: Write failing gateway tests**

```ts
test("push sends no browser-selected user id", async () => {
  const client = new FakeSupabaseClient();
  await new SupabaseScheduleGateway(client as never).push(mutation);
  assert.deepEqual(client.lastRpc, {
    name: "apply_student_schedule_mutation",
    params: {
      p_mutation_id: mutation.mutationId,
      p_course_id: mutation.courseId,
      p_expected_revision: mutation.expectedRevision,
      p_operation: mutation.operation,
      p_payload: mutation.course ?? null,
    },
  });
  assert.equal("user_id" in client.lastRpc.params, false);
});

test("pull uses a monotonic server-version cursor", async () => {
  const client = new FakeSupabaseClient();
  await new SupabaseScheduleGateway(client as never).pull(42);
  assert.deepEqual(client.filters, [["gt", "server_version", 42]]);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/cloud-gateway.test.ts lib/schedule/sync/coordinator.test.ts
```

Expected: FAIL because gateway/coordinator are absent.

- [ ] **Step 3: Implement the gateway**

```ts
export interface ScheduleCloudGateway {
  push(mutation: ScheduleOutboxMutation): Promise<CloudMutationResult>;
  pull(afterServerVersion: number): Promise<CloudScheduleRow[]>;
}

export class SupabaseScheduleGateway implements ScheduleCloudGateway {
  constructor(private readonly client: SupabaseClient) {}

  async push(mutation: ScheduleOutboxMutation) {
    const { data, error } = await this.client.rpc(
      "apply_student_schedule_mutation",
      toRpcMutation(mutation),
    );
    if (error) throw classifyScheduleSyncError(error);
    return parseCloudMutationResult(data);
  }

  async pull(cursor: number) {
    const { data, error } = await this.client
      .from("student_schedule_courses")
      .select("id,payload,revision,server_version,created_at,updated_at,deleted_at")
      .gt("server_version", cursor)
      .order("server_version", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw classifyScheduleSyncError(error);
    return parseCloudRows(data);
  }
}
```

Return only generic error categories: offline, auth, conflict, unavailable,
invalid-remote. Never include payload or raw database messages in telemetry.

- [ ] **Step 4: Implement push-then-pull coordination**

```ts
export class ScheduleSyncCoordinator {
  async sync(scope: ScheduleScope): Promise<SyncRunResult> {
    // Exit for guest, disabled consent, already-running, or offline.
    // Load ordered outbox.
    // Push sequentially; acknowledge only the exact mutation after canonical
    // local row/revision commit succeeds.
    // If a newer same-course mutation replaced the in-flight mutation, retain
    // it and rebase its expectedRevision to the acknowledged revision.
    // Record conflicts without deleting their mutation.
    // Pull after pushes and apply rows in one local transaction.
    // Advance cursor only after all pulled rows commit.
  }
}
```

Guard concurrent calls with one in-memory promise. Schedule runs on initial
account activation, `online`, `visibilitychange` to visible, and after local
mutations with bounded debounce. Do not add Realtime.

- [ ] **Step 5: Test lost responses, retries, conflicts, and cursor safety**

Use fake gateway/store tests for:

- same mutation sent twice;
- edit arriving while a prior same-course mutation is in flight;
- create then edit then delete before reconnect produces no self-conflict;
- response lost after server apply;
- expired auth mid-batch;
- one conflict while later courses remain pending;
- invalid remote payload quarantined;
- local transaction failure leaves cursor unchanged;
- second `sync()` call joins the active run.

- [ ] **Step 6: Run gateway/coordinator and full unit tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/cloud-gateway.test.ts lib/schedule/sync/coordinator.test.ts lib/schedule/sync/reconcile.test.ts
rtk npm test
rtk npm run typecheck
```

Expected: all tests and typecheck PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/schedule/sync
rtk git commit -m "feat(schedule): synchronize account changes safely"
```

### Task 8: Add schedule account state and consent UI

**Files:**
- Create: `lib/schedule/sync/feature-flag.ts`
- Create: `lib/schedule/sync/feature-flag.test.ts`
- Create: `components/schedule/use-schedule-account.ts`
- Create: `components/schedule/schedule-account-panel.tsx`
- Create: `components/schedule/schedule-account-panel.test.ts`
- Modify: `components/schedule/schedule-page-client.tsx`

- [ ] **Step 1: Write failing UI contract tests**

```ts
test("account sync is disabled unless the public flag is exactly true", () => {
  assert.equal(isScheduleAccountSyncEnabled(undefined), false);
  assert.equal(isScheduleAccountSyncEnabled("false"), false);
  assert.equal(isScheduleAccountSyncEnabled("true"), true);
});

test("account panel distinguishes guest sync pending offline and review states", async () => {
  const source = await readFile(
    new URL("./schedule-account-panel.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Sync with Google",
    "Stored only on this device",
    "Changes pending",
    "Needs review",
    "Remove local account data from this device",
  ]) assert.match(source, new RegExp(label));
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test components/schedule/schedule-account-panel.test.ts
```

Expected: FAIL because the panel is absent.

- [ ] **Step 3: Implement the fail-closed feature flag**

```ts
export function isScheduleAccountSyncEnabled(
  value = process.env.NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED,
): boolean {
  return value === "true";
}
```

When false, do not mount account auth listeners, create a cloud gateway, inspect
account scopes, or issue schedule network requests. Render the existing guest
planner and device-only privacy copy.

- [ ] **Step 4: Implement account state**

`useScheduleAccount` must:

```ts
type ScheduleAccountState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "authenticated"; userId: string; email?: string; offlineVerified: boolean };
```

Call `auth.getUser()` for online verification, subscribe to
`onAuthStateChange`, and switch repository scope before rendering account rows.
An offline cached session may choose only its matching local scope and is marked
`offlineVerified: false`; it never authorizes cloud requests.

- [ ] **Step 5: Implement the account panel**

Guest copy:

```tsx
<p>Stored only on this device. Sign in only if you want private cross-device sync.</p>
<Button onClick={() => signInWithGoogle("/schedule")}>
  Continue with Google
</Button>
```

Authenticated copy includes email, sync status, pending count, `Sync now`,
`Sign out`, JSON backup, and the deliberate local-data removal action. Sign-out
switches to guest scope before invoking Supabase sign-out.

- [ ] **Step 6: Integrate without changing guest behavior**

`SchedulePageClient` creates/replaces `ScheduleRepository` from the current
scope, disposes the prior live query, clears in-memory courses, and shows a
loading boundary until the new scope emits. It never briefly renders the prior
account's courses.

- [ ] **Step 7: Run account UI and schedule regression tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/feature-flag.test.ts components/schedule/schedule-account-panel.test.ts lib/schedule/scope.test.ts lib/schedule/repository.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add lib/schedule/sync/feature-flag.ts lib/schedule/sync/feature-flag.test.ts components/schedule/use-schedule-account.ts components/schedule/schedule-account-panel.tsx components/schedule/schedule-account-panel.test.ts components/schedule/schedule-page-client.tsx
rtk git commit -m "feat(schedule): add optional Google sync controls"
```

### Task 9: Add first-sign-in reconciliation and conflict review

**Files:**
- Create: `components/schedule/schedule-reconciliation-dialog.tsx`
- Create: `components/schedule/schedule-conflict-dialog.tsx`
- Create: `components/schedule/schedule-sync-dialogs.test.ts`
- Modify: `components/schedule/schedule-page-client.tsx`
- Modify: `lib/schedule/sync/reconcile.ts`

- [ ] **Step 1: Write failing dialog contract tests**

```ts
test("first sign-in offers safe explicit reconciliation choices", async () => {
  const source = await readFile(
    new URL("./schedule-reconciliation-dialog.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Review and merge",
    "Replace cloud with this device",
    "Use cloud schedule",
    "Not now",
  ]) assert.match(source, new RegExp(label));
});

test("course conflict review exposes both versions without automatic winner", async () => {
  const source = await readFile(
    new URL("./schedule-conflict-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /This device/);
  assert.match(source, /Cloud version/);
  assert.match(source, /Keep this device/);
  assert.match(source, /Keep cloud version/);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test components/schedule/schedule-sync-dialogs.test.ts
```

Expected: FAIL because dialogs are absent.

- [ ] **Step 3: Implement first-sign-in reconciliation**

The dialog receives validated guest/account/cloud summaries and emits only:

```ts
type ReconciliationSource = "guest" | "account-local" | "cloud";
type ReconciliationChoice =
  | {
      kind: "review-merge";
      choices: Record<string, ReconciliationSource>;
    }
  | { kind: "replace-cloud" }
  | { kind: "use-cloud" }
  | { kind: "cancel" };
```

Show counts for guest, account-local, and cloud, warn before destructive
replacement, make Review and merge the default focused action, and keep cancel
non-destructive. Every merged course retains explicit provenance. Never render
notes or instructor text outside the explicit per-course comparison.

- [ ] **Step 4: Implement per-course conflict review**

Show code, title, meetings, and last server revision for every present guest,
account-local, and cloud version. None is preselected. Resolving to guest or
account-local atomically removes every superseded outbox/conflict row for that
course, writes the chosen local version, and creates exactly one upsert against
the latest cloud revision. Resolving to cloud atomically replaces the account
local course and removes every superseded outbox/conflict row for that course.

- [ ] **Step 5: Test focus, cancellation, and destructive confirmation**

Add browser/component checks for:

- initial focus;
- Escape/cancel preserves both sources;
- replace-cloud requires confirmation;
- 200-course merge overflow enters review rather than truncating;
- dialog close returns focus to the account panel.

- [ ] **Step 6: Run sync-dialog and reconciliation tests**

Run:

```bash
rtk proxy node --import tsx --test components/schedule/schedule-sync-dialogs.test.ts lib/schedule/sync/reconcile.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add components/schedule/schedule-reconciliation-dialog.tsx components/schedule/schedule-conflict-dialog.tsx components/schedule/schedule-sync-dialogs.test.ts components/schedule/schedule-page-client.tsx lib/schedule/sync/reconcile.ts
rtk git commit -m "feat(schedule): review first sync and course conflicts"
```

### Task 10: Wire sync into every schedule mutation

**Files:**
- Modify: `components/schedule/schedule-page-client.tsx`
- Modify: `components/schedule/schedule-transfer-dialog.tsx`
- Modify: `lib/schedule/repository.ts`
- Modify: `lib/schedule/sync/coordinator.ts`
- Create: `lib/schedule/sync/integration.test.ts`

- [ ] **Step 1: Write failing end-to-end repository tests**

```ts
test("offline create edit delete and restore replay in order after reconnect", async () => {
  const fixture = await createSyncFixture({ online: false });
  await fixture.repository.put(courseA);
  await fixture.repository.put({ ...courseA, title: "Edited" });
  await fixture.repository.remove(courseA.id);
  await fixture.repository.replaceAll([courseB]);
  assert.equal(await fixture.store.outboxCountForCourse(
    USER_SCOPE,
    courseA.id,
  ), 0);
  assert.equal(await fixture.gateway.callCount(), 0);

  fixture.setOnline(true);
  await fixture.coordinator.sync(USER_SCOPE);
  assert.deepEqual(await fixture.cloud.activeCourseIds(), [courseB.id]);
  assert.equal(await fixture.store.outboxCount(USER_SCOPE), 0);
  assert.equal(await fixture.store.conflictCount(USER_SCOPE), 0);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/integration.test.ts
```

Expected: FAIL until all page/repository mutations trigger sync correctly.

- [ ] **Step 3: Trigger bounded sync after mutations**

After successful account-scoped `put`, `remove`, `clear`, or `replaceAll`, call:

```ts
scheduleSyncCoordinator.requestSync(activeScope);
```

This request is non-blocking and debounced. Toasts distinguish local save from
cloud state:

```ts
toast.success(isAccountScope(activeScope)
  ? "Saved on this device; sync queued"
  : "Course saved on this device");
```

Never delay closing the course dialog on network activity.

- [ ] **Step 4: Preserve transfer semantics**

JSON restore remains validated and atomic. For account scopes, replacing the
schedule creates bounded upsert/delete mutations in the same local transaction.
ICS and JSON export read only the active scope. No export data is sent to sync
telemetry.

- [ ] **Step 5: Run integration and full tests**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/sync/integration.test.ts
rtk npm test
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add components/schedule/schedule-page-client.tsx components/schedule/schedule-transfer-dialog.tsx lib/schedule/repository.ts lib/schedule/sync/coordinator.ts lib/schedule/sync/integration.test.ts
rtk git commit -m "feat(schedule): sync every account schedule change"
```

### Task 11: Update privacy, cache, setup, and operations documentation

**Files:**
- Modify: `components/schedule/schedule-page-client.tsx`
- Modify: `components/observability/app-logging-provider.test.ts`
- Modify: `public/sw.js`
- Modify: `public/sw.test.ts`
- Modify: `supabase/config.toml`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write failing privacy/cache tests**

```ts
test("telemetry never includes schedule sync payload fields", async () => {
  const source = await readFile(
    new URL("../../components/observability/app-logging-provider.tsx", import.meta.url),
    "utf8",
  );
  for (const sensitive of [
    "course.title",
    "course.notes",
    "instructor",
    "locationLabel",
    "student_schedule_courses",
  ]) assert.doesNotMatch(source, new RegExp(sensitive));
});

test("service worker never caches schedule data API or auth callbacks", async () => {
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /\\/api\\//);
  assert.match(source, /\\/auth\\//);
  assert.doesNotMatch(source, /student_schedule_courses/);
});
```

- [ ] **Step 2: Run and verify RED where behavior is missing**

Run:

```bash
rtk proxy node --import tsx --test components/observability/app-logging-provider.test.ts public/sw.test.ts
```

Expected: at least the new explicit schedule/auth cache contract FAILS before
the service-worker policy is updated.

- [ ] **Step 3: Update privacy copy**

Guest:

```tsx
Your schedule stays in this browser unless you explicitly enable private
account sync.
```

Account:

```tsx
Your schedule is stored on this device and in private account-owned Supabase
rows for cross-device sync. It is not shared with Google Calendar.
```

Keep warnings that JSON and ICS exports contain schedule details.

- [ ] **Step 4: Harden service-worker exclusions**

Ensure `/auth/`, Supabase REST/RPC requests, `/api/`, and non-GET requests are
always network-only and never written to caches. Keep `/schedule` shell
precache/offline behavior.

- [ ] **Step 5: Document provider configuration**

Add local config:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

Document exact local and production callback/origin setup without committing
client secrets. Production Supabase URL Configuration must allow the exact
`https://vsumap.vercel.app/auth/callback` and intentional preview callback
pattern. Do not mix these variables with Gmail notification OAuth.

Document:

```dotenv
NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED=false
```

Missing values remain disabled. Preview may use `true` only after its migration
and RLS checks pass. Production remains `false` through the first deployment and
schema application.

- [ ] **Step 6: Document account deletion and rollback**

README must explain anonymous behavior, optional sync, local account data
removal, cloud deletion/tombstones, JSON backup, and that post-launch rollback
revokes sync access while retaining user data.

- [ ] **Step 7: Run privacy, PWA, and documentation gates**

Run:

```bash
rtk proxy node --import tsx --test components/observability/app-logging-provider.test.ts public/sw.test.ts
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk git diff --check
```

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add components/schedule/schedule-page-client.tsx components/observability/app-logging-provider.test.ts public/sw.js public/sw.test.ts supabase/config.toml .env.example README.md CHANGELOG.md
rtk git commit -m "docs(schedule): disclose private account synchronization"
```

### Task 12: Verify locally, stage schema, and complete browser acceptance

**Files:**
- No source changes unless a test-first defect fix is required.

- [ ] **Step 1: Run the five local quality gates**

Run:

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk npm run build
rtk proxy npm audit --omit=dev
```

Expected: tests, typecheck, lint, and build PASS. Audit results are classified;
do not use `--force` or accept dependency downgrades.

- [ ] **Step 2: Re-run database verification from a fresh reset**

Run:

```bash
rtk npm run db:reset
rtk proxy node tools/qa/rls-student-schedules.mjs
rtk proxy npx --yes supabase@2.107.0 migration list --local
rtk proxy npx --yes supabase@2.107.0 db lint --local
```

Expected: all migrations, RLS attacks, idempotency, conflicts, and 200-course
concurrency tests PASS.

- [ ] **Step 3: Verify hosted environment safety before preview enablement**

Confirm through connected Supabase/Vercel tooling:

- Google provider is enabled with identity-only scopes.
- Production Site URL and callback allowlist are exact.
- `ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK` is absent.
- `ALLOW_LEGACY_USER_METADATA_ROLES` is absent.
- schedule migration is not yet exposed in production before app compatibility.
- preview environment uses a safe schema branch or staging project.

Never print provider secrets or environment values.

- [ ] **Step 4: Run browser acceptance**

At 320, 768, 1024, and 1440 CSS pixels:

1. Anonymous create/edit/delete/export/offline reload with zero schedule API
   requests.
2. Schedule Google sign-in and OAuth error return.
3. Guest-only, cloud-only, both-nonempty, cancel, merge, replace, and use-cloud
   first-sign-in paths.
4. User A → sign out → user B isolation.
5. Offline mutation → reload → reconnect → sync.
6. Same-course concurrent edit conflict and both resolution choices.
7. Pending/auth-expired/unavailable status and retry.
8. Service-worker cache inspection with no schedule payload.
9. Keyboard, focus, screen-reader names, and clean application console.
10. Mobile TWA deep link to `/schedule`.

- [ ] **Step 5: Request independent security and implementation review**

Reviewers must inspect migration/RLS, role fallback removal, scope switching,
outbox atomicity, conflict semantics, telemetry/cache privacy, and deployment
ordering. Resolve all blocking findings with new failing tests.

- [ ] **Step 6: Run final worktree checks**

Run:

```bash
rtk git diff --check
rtk git status --short --branch
rtk git log --oneline origin/main..HEAD
```

Expected: clean worktree and only intentional feature commits.

### Task 13: Mirror, open PRs, merge safely, migrate, and enable production

**Files:**
- Mirror all intentional source/migration/docs files to:
  `/Users/vjmabansag/Projects/VSU-SmartMap`
- Do not touch:
  `/Users/vjmabansag/Projects/VSU-SmartMap-Mobile`
  unless TWA verification exposes a wrapper defect.

- [ ] **Step 1: Verify public/private source parity**

Create `feature/schedule-google-sync` in the private-history checkout from its
current `origin/main`. Port only intentional commits/files and preserve unrelated
untracked screenshots. Compare hashes for every mirrored path.

- [ ] **Step 2: Push branches and open protected-main PRs**

Use conventional titles:

```text
feat(schedule): add Google sync and shared facility search
```

Load and follow the git workflow PR checklist. Include migration ordering,
privacy behavior, RLS evidence, browser matrix, and rollback notes.

- [ ] **Step 3: Wait for all required checks**

Require application quality, database quality, and Vercel preview success in
both repositories. Inspect failures rather than retrying blindly.

- [ ] **Step 4: Merge both PRs with production sync disabled**

Require the production Vercel environment to have
`NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED=false` before merge. Merge only after
required reviews/checks and record both merge SHAs. Verify the first production
deployment serves the anonymous planner with no schedule sync network calls.

- [ ] **Step 5: Apply and verify the production migration**

After preview proof and after the disabled compatible application is live:

1. apply the additive migration through the linked Supabase workflow;
2. verify the remote migration list;
3. run security and performance advisors;
4. execute safe two-user RLS probes without reading existing user data;
5. verify schedule table grants and function grants;
6. keep the production UI feature disabled if any check fails.

- [ ] **Step 6: Enable and redeploy the exact merge commit**

Set `NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED=true` in production only after
schema/RLS verification, then redeploy the public merge SHA without source
changes. Confirm the resulting deployment metadata still identifies that SHA.

- [ ] **Step 7: Verify the production deployment**

Confirm:

- Vercel READY deployment commit equals the public merge SHA.
- `https://vsumap.vercel.app/schedule` serves the new UI.
- Anonymous, authenticated, offline, conflict, facility search, and sign-out
  paths pass against production.
- The custom domain and Android TWA deep link resolve the same deployment.
- No schedule payload appears in caches, logs, or URLs.

- [ ] **Step 8: Preserve rollback safety**

If production verification fails, disable sync UI and revoke authenticated
schedule grants in a forward migration while preserving table data. Never reset
or drop production schedule rows.
