import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_VERIFICATION_DOCUMENT_FILENAME_LENGTH,
  VERIFICATION_DOCUMENT_BUCKET,
  buildVerificationDocumentPath,
  isValidVerificationDocumentLocation,
} from "./verification-document-path.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

test("maximum upload filename is capped, round-trips, and preserves the canonical structure", () => {
  const path = buildVerificationDocumentPath({
    userId: USER_ID,
    applicationId: APPLICATION_ID,
    label: "identity",
    timestamp: 1_720_000_000_000,
    filename: `${"Very long unsafe name ! ".repeat(30)}.PDF`,
  });
  const filename = path.split("/").at(-1)!;
  const safeName = filename.replace(/^identity-\d+-/, "");
  assert.ok(safeName.length <= MAX_VERIFICATION_DOCUMENT_FILENAME_LENGTH);
  assert.match(
    path,
    new RegExp(`^${USER_ID}/${APPLICATION_ID}/identity-1720000000000-[a-z0-9.-]+$`),
  );
  assert.equal(
    isValidVerificationDocumentLocation(VERIFICATION_DOCUMENT_BUCKET, path),
    true,
  );
});

test("validator accepts historical uploader paths with a 217-character final segment", () => {
  const prefix = "authority-1720000000000-";
  const historicalSegment = `${prefix}${"a".repeat(217 - prefix.length)}`;
  const path = `${USER_ID}/${APPLICATION_ID}/${historicalSegment}`;
  assert.equal(historicalSegment.length, 217);
  assert.equal(
    isValidVerificationDocumentLocation(VERIFICATION_DOCUMENT_BUCKET, path),
    true,
  );
});

test("generator normalizes leading punctuation to a validator-safe fallback", () => {
  const path = buildVerificationDocumentPath({
    userId: USER_ID,
    applicationId: APPLICATION_ID,
    label: "authority",
    timestamp: 1,
    filename: "...---",
  });
  assert.equal(
    path,
    `${USER_ID}/${APPLICATION_ID}/authority-1-document`,
  );
  assert.equal(
    isValidVerificationDocumentLocation(VERIFICATION_DOCUMENT_BUCKET, path),
    true,
  );
});

test("validator rejects bucket drift, traversal, encoding, malformed structure, and overlong keys", () => {
  const valid = `${USER_ID}/${APPLICATION_ID}/identity-1720000000000-card.pdf`;
  for (const [bucket, path] of [
    ["smartmap-bucket", valid],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/identity-1-../card.pdf`],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/identity-1-%2fsecret.pdf`],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/identity-1-card.pdf/extra`],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/other-1-card.pdf`],
    [VERIFICATION_DOCUMENT_BUCKET, `not-a-uuid/${APPLICATION_ID}/identity-1-card.pdf`],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/identity-1-card\u0000.pdf`],
    [VERIFICATION_DOCUMENT_BUCKET, `${USER_ID}/${APPLICATION_ID}/identity-1-${"a".repeat(1000)}`],
  ] as const) {
    assert.equal(isValidVerificationDocumentLocation(bucket, path), false, path);
  }
});

test("owner upload uses the shared path builder and rolls storage back after row failure", async () => {
  const source = await readFile(
    new URL("../../app/owner/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /buildVerificationDocumentPath\(\{/);
  assert.doesNotMatch(source, /function safeFilename\(/);
  assert.match(
    source,
    /if \(rowError\)[\s\S]*storage[\s\S]*\.from\(VERIFICATION_DOCUMENT_BUCKET\)[\s\S]*\.remove\(\[storagePath\]\)/,
  );
});
