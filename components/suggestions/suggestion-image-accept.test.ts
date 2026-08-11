import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all suggestion dialogs advertise the shared 30 MB HEIC/HEIF image contract", async () => {
  const [facilityDialog, addDialog, editDialog, roomDialog] = await Promise.all([
    readFile(new URL("../admin/facility-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-add-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-edit-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("./suggest-room-modal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(facilityDialog, /imageAccept\?: string/);
  assert.match(facilityDialog, /imageAccept = STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)/);
  assert.match(facilityDialog, /accept=\{imageAccept\}/);
  assert.match(addDialog, /imageAccept=\{STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)\}/);
  assert.match(editDialog, /imageAccept=\{STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)\}/);
  assert.match(roomDialog, /accept=\{STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)\}/);
});
