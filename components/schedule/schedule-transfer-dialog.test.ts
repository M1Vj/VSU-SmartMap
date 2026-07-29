import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("schedule transfer dialog warns that JSON and ICS exports contain private details", async () => {
  const source = await readFile(
    new URL("./schedule-transfer-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /JSON and ICS files contain private schedule details/);
  assert.match(source, /subjects, times, and locations/);
  assert.match(source, /Store and share them carefully/);
});

test("schedule transfer dialog accurately describes local JSON backup restore", async () => {
  const source = await readFile(
    new URL("./schedule-transfer-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /JSON backups are created and read only on this device/);
  assert.match(source, /replace this schedule after confirmation/);
});
