import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server image storage helpers require the client-compressed WebP invariant", async () => {
  const source = await readFile(new URL("./storage.ts", import.meta.url), "utf8");

  assert.match(source, /STORAGE_LIMITS\.compressedMaxMB/);
  assert.match(source, /image\/webp/);
  assert.match(source, /converted to WebP/i);
});
