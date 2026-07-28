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
    "Backup & export",
    "Remove local account data from this device",
  ]) {
    assert.match(source, new RegExp(label));
  }
});

test("account panel discloses private storage and no Google Calendar access", async () => {
  const source = await readFile(
    new URL("./schedule-account-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /private Supabase rows/);
  assert.match(source, /not shared with Google or Google Calendar/);
  assert.match(source, /min-h-11/);
});
