import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every browser image picker advertises the shared HEIC/HEIF and WebP conversion contract", async () => {
  const [bug, route, room, storage] = await Promise.all([
    readFile(new URL("./bugs/report-bug-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("./navigation/report-route-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("./admin/room-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/constants/storage.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [bug, route, room]) {
    assert.match(source, /STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)/);
    assert.match(source, /STORAGE_LIMITS\.imageInputMaxMB/);
  }
  assert.match(storage, /"image\/heic"/);
  assert.match(storage, /"image\/heif"/);
  assert.match(storage, /inputMaxMB: 30/);
});
