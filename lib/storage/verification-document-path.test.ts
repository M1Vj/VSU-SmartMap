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

test("validator accepts dotted filename shapes produced by the former sanitizer", () => {
  for (const filename of [
    ".passport.pdf",
    "pass..port.pdf",
    "passport.",
    "...",
  ]) {
    const path = `${USER_ID}/${APPLICATION_ID}/identity-1720000000000-${filename}`;
    assert.equal(
      isValidVerificationDocumentLocation(VERIFICATION_DOCUMENT_BUCKET, path),
      true,
      filename,
    );
  }
});

test("validator accepts an empty suffix produced by former hyphen-only or spaces-only filenames", () => {
  const formerSafeFilename = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  for (const original of ["---", "   "]) {
    const formerOutput = formerSafeFilename(original);
    assert.equal(formerOutput, "");
    assert.equal(
      isValidVerificationDocumentLocation(
        VERIFICATION_DOCUMENT_BUCKET,
        `${USER_ID}/${APPLICATION_ID}/identity-1720000000000-${formerOutput}`,
      ),
      true,
      original,
    );
  }
});

test("validator accepts representative outputs from the former sanitizer", () => {
  const formerSafeFilename = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  for (const original of [
    ".Passport.PDF",
    "pass..port.pdf",
    "passport...",
    "...",
    "front + back.JPG",
  ]) {
    const formerOutput = formerSafeFilename(original);
    const path = `${USER_ID}/${APPLICATION_ID}/authority-1720000000000-${formerOutput}`;
    assert.equal(
      isValidVerificationDocumentLocation(VERIFICATION_DOCUMENT_BUCKET, path),
      true,
      `${original} -> ${formerOutput}`,
    );
  }
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

test("owner upload retains its durable row and expedites exact-id retention on upload failure", async () => {
  const source = await readFile(
    new URL("../../app/owner/actions.ts", import.meta.url),
    "utf8",
  );
  const functionSource = source.slice(
    source.indexOf("async function uploadVerificationDocument"),
    source.indexOf("type OwnedListing"),
  );
  assert.match(functionSource, /buildVerificationDocumentPath\(\{/);
  assert.doesNotMatch(source, /function safeFilename\(/);
  assert.match(
    functionSource,
    /const documentId = randomUUID\(\)[\s\S]*\.from\("owner_verification_documents"\)[\s\S]*\.insert\(\{[\s\S]*id: documentId[\s\S]*\.upload\(storagePath, file/,
  );
  assert.match(
    functionSource,
    /const now = Date\.now\(\)[\s\S]*timestamp: now[\s\S]*delete_after: new Date\(now \+ 90 \* 24 \* 60 \* 60 \* 1000\)\.toISOString\(\)/,
  );
  assert.match(
    functionSource,
    /if \(uploadError\)[\s\S]*\.from\("owner_verification_documents"\)[\s\S]*\.update\(\{ delete_after: new Date\(now\)\.toISOString\(\) \}\)[\s\S]*\.eq\("id", documentId\)/,
  );
  assert.doesNotMatch(functionSource, /console\.error\([^)]*,\s*\w+Error\)/);
  assert.doesNotMatch(functionSource, /\.delete\(\)/);
  assert.doesNotMatch(functionSource, /\.remove\(\[storagePath\]\)/);
});
