import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("event proof chooser trusts backend content validation and keeps only the 5 MB client guard", async () => {
  const source = await readFile(new URL("./suggestion-form.tsx", import.meta.url), "utf8");

  assert.match(source, /const MAX_FILE_SIZE = 5 \* 1024 \* 1024/);
  assert.match(source, /accept="image\/\*"/);
  assert.doesNotMatch(source, /ACCEPTED_IMAGE_TYPES/);
  assert.doesNotMatch(source, /Only \.jpg, \.png, and \.webp formats are supported/);
});
