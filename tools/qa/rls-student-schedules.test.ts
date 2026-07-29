import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260728152734_student_schedule_sync.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8"))
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

test("student schedule migration declares the private versioned schema", async () => {
  const sql = await migrationSql();

  for (const contract of [
    "create sequence public.student_schedule_server_version_seq",
    "create table public.student_schedule_courses",
    "primary key (user_id, id)",
    "references auth.users (id) on delete cascade",
    "jsonb",
    "octet_length(payload::text) <= 32768",
    "payload ->> 'id' = id::text",
    "revision bigint not null",
    "server_version bigint not null",
    "last_mutation_id uuid not null",
    "deleted_at timestamptz",
    "create index student_schedule_courses_pull_idx on public.student_schedule_courses (user_id, server_version, id)",
  ]) {
    assert.match(sql, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("student schedule migration establishes the least-privilege RPC boundary", async () => {
  const sql = await migrationSql();

  for (const contract of [
    "create role student_schedule_mutator nologin noinherit",
    "security definer",
    "set search_path = ''",
    "auth.uid()",
    "alter table public.student_schedule_courses enable row level security",
    "alter table public.student_schedule_courses force row level security",
    "to authenticated",
    "(select auth.uid()) = user_id",
    "revoke all on table public.student_schedule_courses from public, anon, authenticated",
    "grant select on table public.student_schedule_courses to authenticated",
    "revoke all on sequence public.student_schedule_server_version_seq from public, anon, authenticated",
    "revoke all on function public.apply_student_schedule_mutation(uuid, uuid, uuid, bigint, text, jsonb) from public, anon",
    "grant execute on function public.apply_student_schedule_mutation(uuid, uuid, uuid, bigint, text, jsonb) to authenticated",
    "create function public.student_schedule_authenticated_user_id()",
    "revoke all on function public.student_schedule_authenticated_user_id() from public, anon, authenticated",
    "grant execute on function public.student_schedule_authenticated_user_id() to student_schedule_mutator",
    "alter function public.apply_student_schedule_mutation(uuid, uuid, uuid, bigint, text, jsonb) owner to student_schedule_mutator",
    "revoke all on function public.enforce_student_schedule_row() from public, anon, authenticated",
    "rolcanlogin",
    "rolinherit",
    "rolsuper",
    "rolbypassrls",
    "rolcreatedb",
    "rolcreaterole",
    "rolreplication",
    "rolconfig",
    "pg_catalog.pg_auth_members",
    "unexpected student_schedule_mutator membership",
    "unsafe student_schedule_mutator role attributes",
  ]) {
    assert.ok(sql.includes(contract), `missing SQL contract: ${contract}`);
  }

  assert.ok(!sql.includes("raw_user_meta_data"));
  assert.ok(!sql.includes("raw_app_meta_data"));
  assert.ok(!sql.includes("email"));
  assert.doesNotMatch(
    sql,
    /grant\s+(insert|update|delete|all)[^;]*student_schedule_courses[^;]*authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /grant[^;]*\bselect\b[^;]*student_schedule_server_version_seq[^;]*student_schedule_mutator/,
  );
  assert.doesNotMatch(sql, /grant usage on schema auth/);
  assert.ok(
    sql.indexOf("unsafe student_schedule_mutator role attributes")
      < sql.indexOf("grant student_schedule_mutator to postgres"),
    "role validation must precede temporary membership and object grants",
  );
});

test("mutation RPC is revision-aware, idempotent, bounded, and operation-limited", async () => {
  const sql = await migrationSql();

  for (const contract of [
    "create function public.apply_student_schedule_mutation(",
    "p_expected_user_id uuid",
    "p_expected_user_id is distinct from v_user_id",
    "p_mutation_id uuid",
    "p_course_id uuid",
    "p_expected_revision bigint",
    "p_operation text",
    "p_payload jsonb default null",
    "pg_advisory_xact_lock",
    "last_mutation_id = p_mutation_id",
    "p_expected_revision <> 0",
    "p_operation not in ('upsert', 'delete')",
    "count(*)",
    "deleted_at is null",
    ">= 200",
    "total student schedule row quota exceeded",
    ">= 1000",
    "'conflict'::text",
    "p_operation = 'delete' and not v_exists and p_expected_revision = 0",
    "'deleted'::text",
    "raise exception",
  ]) {
    assert.ok(sql.includes(contract), `missing mutation contract: ${contract}`);
  }

  const triggerDefinition = sql.match(
    /create function public\.enforce_student_schedule_row\(\).*?\$\$;/,
  )?.[0];
  assert.ok(triggerDefinition, "missing schedule trigger function");
  assert.doesNotMatch(triggerDefinition, /security definer/);
  assert.match(triggerDefinition, /total student schedule row quota exceeded/);
  assert.match(triggerDefinition, />= 1000/);
  assert.doesNotMatch(sql, /revision conflict[^;]*raise exception/);

  const missingDelete = sql.match(
    /if p_operation = 'delete' and not v_exists and p_expected_revision = 0.*?end if;/,
  )?.[0];
  assert.ok(missingDelete, "missing delete no-op branch is required");
  assert.doesNotMatch(missingDelete, /insert|nextval|update/);
});
