import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const facilitiesPageSource = readFileSync(
  new URL("./facilities-page-client.tsx", import.meta.url),
  "utf8",
);
const facilityDialogSource = readFileSync(
  new URL("./facility-dialog.tsx", import.meta.url),
  "utf8",
);

test("facility save errors remain visible in both the toast and edit dialog", () => {
  assert.match(
    facilitiesPageSource,
    /toast\.error\('Failed to save facility', \{ description: message \}\);[\s\S]*?throw error;/,
  );
  assert.match(
    facilityDialogSource,
    /const message = submitError instanceof Error \? submitError\.message : 'An unexpected error occurred\.';[\s\S]*?setError\(message\);/,
  );
});

test("facility hero chooser describes the 30 MB input and 1 MB WebP output", () => {
  assert.match(
    facilitiesPageSource,
    /imageAccept=\{STORAGE_LIMITS\.facilityHeroAcceptedTypes\.join\(','\)\}/,
  );
  assert.match(
    facilitiesPageSource,
    /imageMaxMB=\{STORAGE_LIMITS\.facilityHeroInputMaxMB\}/,
  );
  assert.match(
    facilityDialogSource,
    /Saved as WebP at \{STORAGE_LIMITS\.compressedMaxMB\} MB or less\./,
  );
});
