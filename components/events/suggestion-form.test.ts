import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("event proof chooser accepts 30 MB image sources and advertises HEIC/HEIF WebP conversion", async () => {
  const [source, storage] = await Promise.all([
    readFile(new URL("./suggestion-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../lib/constants/storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /STORAGE_LIMITS\.imageInputMaxMB/);
  assert.match(source, /STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)/);
  assert.match(storage, /"image\/heic"/);
  assert.match(storage, /"image\/heif"/);
  assert.match(source, /converted to WebP/i);
  assert.doesNotMatch(source, /ACCEPTED_IMAGE_TYPES/);
  assert.doesNotMatch(source, /Only \.jpg, \.png, and \.webp formats are supported/);
});
