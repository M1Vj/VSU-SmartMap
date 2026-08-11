import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("owner image pickers accept HEIC/HEIF and use the shared source-size contract", async () => {
  const [photos, offerings, application, actions] = await Promise.all([
    readFile(new URL("./listing-photo-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("./listing-offerings-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("./owner-application-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/owner/actions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(photos, /STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)/);
  assert.match(offerings, /STORAGE_LIMITS\.imageAcceptedTypes\.join\(','\)/);
  assert.match(photos, /validateImageSource/);
  assert.match(offerings, /validateImageSource/);
  assert.match(application, /compressImage/);
  assert.match(application, /application\/pdf/);
  assert.match(actions, /MAX_PHOTO_BYTES = STORAGE_LIMITS\.compressedMaxMB/);
  assert.match(actions, /image\/webp/);
});
