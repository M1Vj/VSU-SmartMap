import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("suggestion dialogs opt into broad image selection while the shared default stays narrow", async () => {
  const [facilityDialog, addDialog, editDialog, roomDialog] = await Promise.all([
    readFile(new URL("../admin/facility-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-add-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-edit-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-room-modal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(facilityDialog, /imageAccept\?: string/);
  assert.match(facilityDialog, /imageAccept = STORAGE_LIMITS\.acceptedTypes\.join\(','\)/);
  assert.match(facilityDialog, /accept=\{imageAccept\}/);
  assert.match(addDialog, /imageAccept="image\/\*"/);
  assert.match(editDialog, /imageAccept="image\/\*"/);
  assert.match(roomDialog, /accept="image\/\*"/);
});
