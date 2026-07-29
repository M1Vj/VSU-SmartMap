import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account panel distinguishes guest consent and all sync states", async () => {
  const source = await readFile(
    new URL("./schedule-account-panel.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Stored only on this device",
    "Continue with Google",
    "Enable private sync",
    "Saved",
    "Syncing",
    "Offline",
    "Changes pending",
    "Needs review",
    "Auth required",
    "Error",
    "Sync now",
    "Sign out",
    "Remove local account data from this device",
  ]) {
    assert.match(source, new RegExp(label));
  }
});

test("account panel explains private backup without implementation jargon", async () => {
  const source = await readFile(
    new URL("./schedule-account-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /backed up privately to your account/);
  assert.match(source, /not added to Google Calendar/);
  assert.doesNotMatch(source, /\b(?:IndexedDB|Supabase)\b/);
  assert.doesNotMatch(source, />Backup & export</);
  assert.match(source, /min-h-11/);
});

test("account panel does not fabricate sync state before coordinator wiring", async () => {
  const source = await readFile(
    new URL("./schedule-account-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /syncStatus\s*=\s*\{/);
  assert.match(source, /Private sync enabled/);
  assert.match(source, /onSyncNow \?/);
  assert.doesNotMatch(source, /disabled=\{!onSyncNow\}/);
});
