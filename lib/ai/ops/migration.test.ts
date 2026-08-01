import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260801044444_chat_llmops.sql",
  import.meta.url,
);

test("chat LLMOps migration creates bounded operational storage and indexes", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  for (const table of ["ai_chat_turns", "ai_chat_feedback", "ai_chat_alert_claims"]) {
    assert.match(migration, new RegExp(`CREATE TABLE public\\.${table}`, "i"));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  }
  assert.match(migration, /CREATE TYPE public\.ai_chat_outcome AS ENUM/i);
  assert.match(migration, /CREATE TYPE public\.ai_chat_review_status AS ENUM/i);
  assert.match(migration, /CREATE TYPE public\.ai_chat_validation_status AS ENUM/i);
  assert.match(migration, /char_length\(user_message\) BETWEEN 1 AND 8000/i);
  assert.match(migration, /char_length\(assistant_message\) <= 16000/i);
  const turnsDefinition = migration.match(
    /CREATE TABLE public\.ai_chat_turns \(([\s\S]+?)\n\);/i,
  )?.[1] ?? "";
  const feedbackDefinition = migration.match(
    /CREATE TABLE public\.ai_chat_feedback \(([\s\S]+?)\n\);/i,
  )?.[1] ?? "";
  assert.match(
    turnsDefinition,
    /feedback_token_hash TEXT NOT NULL CHECK \(char_length\(feedback_token_hash\) BETWEEN 32 AND 128\)/i,
  );
  assert.doesNotMatch(feedbackDefinition, /feedback_token_hash/i);
  assert.match(migration, /rating IN \('positive', 'negative'\)/i);
  assert.match(migration, /reason IN \('incorrect', 'outdated', 'wrong_location', 'unhelpful', 'unsafe', 'other'\)/i);
  assert.match(migration, /UNIQUE \(turn_id\)/i);
  assert.match(migration, /UNIQUE \(fingerprint, bucket_start\)/i);
  for (const index of [
    "ai_chat_turns_created_at_idx",
    "ai_chat_turns_outcome_created_at_idx",
    "ai_chat_turns_release_created_at_idx",
    "ai_chat_turns_review_created_at_idx",
    "ai_chat_turns_reviewed_by_idx",
    "ai_chat_feedback_created_at_idx",
    "ai_chat_feedback_rating_created_at_idx",
    "ai_chat_feedback_reviewed_by_idx",
    "ai_chat_alert_claims_created_at_idx",
  ]) {
    assert.match(migration, new RegExp(`CREATE INDEX ${index}`, "i"));
  }
});

test("chat operational records are service-written and admin-reviewable only", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE POLICY "Admins read chat turns"[\s\S]+TO authenticated[\s\S]+public\.has_app_role\('admin'\)/i);
  assert.match(migration, /CREATE POLICY "Admins review chat turns"[\s\S]+FOR UPDATE[\s\S]+public\.has_app_role\('admin'\)/i);
  assert.match(migration, /CREATE POLICY "Admins read chat feedback"[\s\S]+TO authenticated[\s\S]+public\.has_app_role\('admin'\)/i);
  assert.match(migration, /CREATE POLICY "Admins review chat feedback"[\s\S]+FOR UPDATE[\s\S]+public\.has_app_role\('admin'\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+FOR INSERT/gi);
  assert.match(migration, /REVOKE ALL ON TABLE public\.ai_chat_turns, public\.ai_chat_feedback, public\.ai_chat_alert_claims\s+FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(migration, /GRANT ALL ON TABLE public\.ai_chat_turns, public\.ai_chat_feedback, public\.ai_chat_alert_claims\s+TO service_role/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.ai_chat_turns, public\.ai_chat_feedback TO authenticated/i);
  assert.match(migration, /GRANT UPDATE \(review_status, reviewed_at, reviewed_by, review_note\) ON public\.ai_chat_turns TO authenticated/i);
});

test("chat alert claiming and retention cleanup are fixed-path service-only RPCs", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.claim_ai_chat_alert[\s\S]+SECURITY DEFINER[\s\S]+SET search_path = ''/i);
  assert.match(migration, /INSERT INTO public\.ai_chat_alert_claims[\s\S]+ON CONFLICT \(fingerprint, bucket_start\) DO NOTHING/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.purge_ai_chat_ops[\s\S]+SECURITY DEFINER[\s\S]+SET search_path = ''/i);
  assert.match(migration, /created_at < p_now - interval '90 days'/i);
  assert.match(migration, /created_at < p_now - interval '30 days'/i);
  assert.match(migration, /LIMIT p_batch_size/i);
  for (const name of ["claim_ai_chat_alert", "purge_ai_chat_ops"]) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}[\\s\\S]+FROM PUBLIC, anon, authenticated, service_role`, "i"));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]+TO service_role`, "i"));
  }
});

test("chat alerts are appended once to notification recipient rows and defaults", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE public\.notification_recipients[\s\S]+SET DEFAULT[\s\S]+'chat_ops_alert'/i);
  assert.match(migration, /UPDATE public\.notification_recipients[\s\S]+array_append\(event_types, 'chat_ops_alert'\)[\s\S]+NOT \('chat_ops_alert' = ANY \(event_types\)\)/i);
});
