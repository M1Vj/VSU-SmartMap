import assert from "node:assert/strict";
import test from "node:test";

import { assertLocalSupabaseUrl, parseSupabaseEnv } from "./local-supabase.mjs";

test("parses quoted Supabase status output", () => {
  assert.deepEqual(
    parseSupabaseEnv('API_URL="http://127.0.0.1:57321"\nANON_KEY="anon"\n'),
    { API_URL: "http://127.0.0.1:57321", ANON_KEY: "anon" },
  );
});

test("accepts only the expected loopback Supabase API", () => {
  assert.doesNotThrow(() => assertLocalSupabaseUrl("http://127.0.0.1:57321"));
  assert.doesNotThrow(() => assertLocalSupabaseUrl("http://localhost:57321"));
  assert.throws(
    () => assertLocalSupabaseUrl("https://project.supabase.co"),
    /Refusing to use a non-local Supabase project/,
  );
  assert.throws(
    () => assertLocalSupabaseUrl("http://127.0.0.1:54321"),
    /expected port 57321/,
  );
});
