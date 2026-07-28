import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260728163845_harden_authenticated_student_access.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8"))
    .replaceAll(/\s+/g, " ")
    .trim();
}

test("hardening migration removes authenticated catalog mutation and suggestion disclosure drift", async () => {
  const sql = await migrationSql();
  for (const policy of [
    "Authenticated users can insert facilities",
    "Authenticated users can update facilities",
    "Authenticated users can delete facilities",
    "Authenticated users can manage facilities",
    "Authenticated users can insert rooms",
    "Authenticated users can update rooms",
    "Authenticated users can delete rooms",
    "Authenticated users can manage rooms",
    "Authenticated users can read suggestions",
    "Authenticated users can view suggestions",
    "Authenticated users can update suggestions",
    "Authenticated users can insert suggestions",
    "Authenticated users can delete suggestions",
  ]) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "${policy}"`));
  }
  assert.doesNotMatch(
    sql,
    /REVOKE SELECT ON TABLE public\.(?:facilities|rooms) FROM/,
    "public catalog reads must remain available",
  );
});

test("hardening migration closes SECURITY DEFINER execution and mutable paths", async () => {
  const sql = await migrationSql();
  for (const signature of [
    "delete_expired_verification_documents\\(\\)",
    "enforce_owner_listing_transition\\(\\)",
    "propagate_owner_display_name\\(\\)",
    "recompute_boarding_house_rating\\(\\)",
    "set_boarding_house_owner_display_name\\(\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(`REVOKE (?:ALL|EXECUTE) ON FUNCTION public\\.${signature} FROM PUBLIC, anon, authenticated`),
    );
  }
  assert.match(
    sql,
    /REVOKE (?:ALL|EXECUTE) ON FUNCTION public\.has_app_role\(public\.app_user_role\) FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.has_app_role\(public\.app_user_role\) TO authenticated/,
  );
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.delete_expired_verification_documents\(\)[\s\S]*RAISE EXCEPTION 'verification cleanup deprecated'/,
  );
  assert.match(
    sql,
    /REVOKE (?:ALL|EXECUTE) ON FUNCTION public\.delete_expired_verification_documents\(\) FROM PUBLIC, anon, authenticated, service_role/,
  );
  for (const signature of [
    "delete_expired_verification_documents\\(\\)",
    "enforce_owner_listing_transition\\(\\)",
    "has_app_role\\(public\\.app_user_role\\)",
    "propagate_owner_display_name\\(\\)",
    "recompute_boarding_house_rating\\(\\)",
    "set_boarding_house_owner_display_name\\(\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(`ALTER FUNCTION public\\.${signature} SET search_path = ''`),
    );
  }
});

test("hardening migration uses a bounded service-only verification-document lease protocol", async () => {
  const sql = await migrationSql();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS deletion_started_at TIMESTAMPTZ/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS deletion_claim_token UUID/);
  assert.match(sql, /owner_verification_documents_deletion_claim_check/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS owner_verification_documents_expiry_claim_idx/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_expired_verification_documents\(/);
  assert.match(sql, /p_limit < 1 OR p_limit > 100/);
  assert.match(sql, /p_lease_seconds < 60 OR p_lease_seconds > 3600/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.complete_verification_document_deletion\(/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.release_verification_document_deletion\(/);
  for (const signature of [
    "claim_expired_verification_documents\\(TIMESTAMPTZ, INTEGER, INTEGER\\)",
    "complete_verification_document_deletion\\(UUID, UUID\\)",
    "release_verification_document_deletion\\(UUID, UUID\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon, authenticated, service_role`),
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature} TO service_role`),
    );
  }
  assert.doesNotMatch(
    sql,
    /DELETE FROM storage\.objects/,
    "database SQL must never delete Storage metadata directly",
  );
});

test("hardening migration preserves intended RPC and future-function boundaries", async () => {
  const sql = await migrationSql();
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.search_ai_knowledge_entries\(/,
  );
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /FROM public\.ai_knowledge_entries AS entry/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.search_ai_knowledge_entries\(text, integer, integer\) TO PUBLIC, authenticated/,
  );
  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role/,
  );
  for (const policy of [
    "Authenticated upload event-images",
    "Authenticated update event-images",
    "Authenticated delete event-images",
  ]) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "${policy}"`));
  }
});
