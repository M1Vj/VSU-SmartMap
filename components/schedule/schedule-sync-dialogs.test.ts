import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("first sign-in dialog exposes explicit safe actions and confirmation", async () => {
  const source = await readFile(
    new URL("./schedule-reconciliation-dialog.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Review and merge",
    "Replace cloud with this device",
    "Use cloud schedule",
    "Not now",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /initialFocus/);
  assert.match(source, /destructiveConfirmation/);
  assert.match(source, /Yes, use cloud schedule/);
  assert.match(source, /Yes, replace cloud/);
  assert.match(source, /onCancel/);
  assert.match(source, /min-h-11/);
});

test("course conflict dialog exposes source-tagged versions without a default", async () => {
  const source = await readFile(
    new URL("./schedule-conflict-dialog.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "This device",
    "Guest device",
    "Cloud version",
    "Deleted in cloud",
    "Keep this device",
    "Keep cloud version",
    "Keep cloud deletion",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /checked=\{selectedSource === version\.source\}/);
  assert.match(
    source,
    /useState<ReconciliationSource \| undefined>\(undefined\)/,
  );
  assert.doesNotMatch(source, /version\\.course\\.notes/);
  assert.doesNotMatch(source, /version\\.course\\.instructor/);
});

test("ongoing conflict and invalid-payload quarantine have reachable review actions", async () => {
  const page = await readFile(
    new URL("./schedule-page-client.tsx", import.meta.url),
    "utf8",
  );
  const review = await readFile(
    new URL("./schedule-ongoing-review-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /scheduleSync\.openReview/);
  assert.match(page, /ScheduleOngoingReviewDialog/);
  assert.match(review, /ScheduleConflictDialog/);
  assert.match(review, /Discard invalid cloud item/);
  assert.doesNotMatch(review, /remote\\.notes|remote\\.instructor/);
});

test("ongoing review and initialization failures are scope-safe and recoverable", async () => {
  const hook = await readFile(
    new URL("./use-schedule-sync.ts", import.meta.url),
    "utf8",
  );
  assert.match(hook, /initializationRetry/);
  assert.match(hook, /setInitializationRetry/);
  assert.match(hook, /GENERIC_SYNC_SETUP_ERROR/);
  assert.match(hook, /reviewGeneration/);
  assert.match(hook, /generationRef\.current !==/);
  assert.ok(hook.includes("catch(() => {"));
  assert.ok(!hook.includes("catch(() => undefined)"));
});
