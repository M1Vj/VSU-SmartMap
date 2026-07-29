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
  assert.match(source, /Confirm replacement/);
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
