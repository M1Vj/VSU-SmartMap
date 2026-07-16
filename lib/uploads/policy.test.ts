import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  MAX_IMAGE_BYTES,
  MAX_MULTIPART_BYTES,
  inspectSuggestionImage,
  readBoundedRequestBody,
  resolveSuggestionUploadTarget,
} from "./policy.ts";

const TEMP_ID = "550e8400-e29b-41d4-a716-446655440000";
const UPLOAD_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

test("upload kinds map to fixed service-owned buckets and prefixes", () => {
  assert.deepEqual(
    resolveSuggestionUploadTarget("map-suggestion-image", TEMP_ID, UPLOAD_ID, "webp"),
    {
      bucket: "smartmap-bucket",
      objectPath: `suggestion-images/${TEMP_ID}/${UPLOAD_ID}.webp`,
    },
  );
  assert.deepEqual(
    resolveSuggestionUploadTarget("event-proof", TEMP_ID, UPLOAD_ID, "jpeg"),
    {
      bucket: "event-proofs",
      objectPath: `${TEMP_ID}/${UPLOAD_ID}.jpg`,
    },
  );
});

test("upload target rejects unknown kinds, traversal, and malformed UUIDs", () => {
  for (const [kind, tempId] of [
    ["admin-export", TEMP_ID],
    ["map-suggestion-image", "../../admin"],
    ["event-proof", "not-a-uuid"],
  ] as const) {
    assert.throws(() =>
      resolveSuggestionUploadTarget(kind, tempId, UPLOAD_ID, "webp"),
    );
  }
});

test("image inspection rejects spoofed MIME and non-image bytes", async () => {
  await assert.rejects(
    inspectSuggestionImage(
      new File([Buffer.from("not an image")], "proof.png", { type: "image/png" }),
    ),
    /valid image/i,
  );

  const jpeg = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  }).jpeg().toBuffer();
  await assert.rejects(
    inspectSuggestionImage(new File([Uint8Array.from(jpeg)], "proof.png", { type: "image/png" })),
    /does not match/i,
  );
});

test("image inspection accepts supported real image metadata and enforces byte limit", async () => {
  const webp = await sharp({
    create: { width: 4, height: 3, channels: 3, background: "white" },
  }).webp().toBuffer();
  const inspected = await inspectSuggestionImage(
    new File([Uint8Array.from(webp)], "proof.webp", { type: "image/webp" }),
  );

  assert.equal(inspected.format, "webp");
  assert.equal(inspected.contentType, "image/webp");
  assert.deepEqual([inspected.width, inspected.height], [4, 3]);
  assert.deepEqual(inspected.bytes, webp);

  await assert.rejects(
    inspectSuggestionImage(
      new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "huge.webp", {
        type: "image/webp",
      }),
    ),
    /too large/i,
  );
});

test("bounded request reader rejects oversized headers before reading the body", async () => {
  const request = new Request("https://example.test/upload", {
    method: "POST",
    headers: { "content-length": String(MAX_MULTIPART_BYTES + 1) },
    body: new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(readBoundedRequestBody(request), /too large/i);
});

test("bounded request reader rejects an oversized streamed body", async () => {
  const chunk = new Uint8Array(Math.ceil(MAX_MULTIPART_BYTES / 2));
  let sent = 0;
  const request = new Request("https://example.test/upload", {
    method: "POST",
    body: new ReadableStream({
      pull(controller) {
        if (sent++ < 3) controller.enqueue(chunk);
        else controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(readBoundedRequestBody(request), /too large/i);
});
