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
      objectPath: `${TEMP_ID}/${UPLOAD_ID}.webp`,
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
  const inspected = await inspectSuggestionImage(
    new File([Uint8Array.from(jpeg)], "proof.png", { type: "image/png" }),
  );
  assert.equal(inspected.sourceFormat, "jpeg");
  assert.equal(inspected.format, "webp");
  assert.equal(inspected.contentType, "image/webp");
});

test("image inspection trusts decoded content and normalizes a mismatched JPEG to WebP", async () => {
  const jpeg = await sharp({
    create: { width: 7, height: 5, channels: 3, background: "white" },
  }).jpeg().toBuffer();

  const inspected = await inspectSuggestionImage(
    new File([Uint8Array.from(jpeg)], "proof.png", { type: "image/png" }),
  );
  const normalizedMetadata = await sharp(inspected.bytes).metadata();

  assert.equal(inspected.sourceFormat, "jpeg");
  assert.equal(inspected.format, "webp");
  assert.equal(inspected.contentType, "image/webp");
  assert.deepEqual([inspected.width, inspected.height], [7, 5]);
  assert.equal(normalizedMetadata.format, "webp");
  assert.deepEqual(
    [normalizedMetadata.width, normalizedMetadata.height],
    [7, 5],
  );
});

test("image inspection normalizes installed Sharp raster decoders regardless of declaration", async () => {
  const create = { create: { width: 3, height: 2, channels: 3 as const, background: "white" as const } };
  const tiff = await sharp(create).tiff().toBuffer();
  const avif = await sharp(create).avif().toBuffer();
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

  for (const [bytes, name, type] of [
    [tiff, "photo.bin", "application/octet-stream"],
    [avif, "photo.jpg", "image/jpeg"],
    [gif, "photo.png", "image/png"],
  ] as const) {
    const inspected = await inspectSuggestionImage(new File([Uint8Array.from(bytes)], name, { type }));
    assert.equal(inspected.format, "webp");
    assert.equal(inspected.contentType, "image/webp");
    assert.equal((await sharp(inspected.bytes).metadata()).format, "webp");
  }
});

test("image inspection rejects animated raster images and vector SVG input", async () => {
  const animatedGif = Buffer.from(
    "R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBCgABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7",
    "base64",
  );
  await assert.rejects(
    inspectSuggestionImage(new File([Uint8Array.from(animatedGif)], "photo.gif", { type: "image/gif" })),
    /animated/i,
  );

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>',
  );
  await assert.rejects(
    inspectSuggestionImage(new File([svg], "photo.svg", { type: "image/svg+xml" })),
    /unsupported image format/i,
  );
});

test("image inspection keeps the dimension and pixel caps and rejects multi-page TIFF", async () => {
  const edge = await sharp({
    create: { width: 8_192, height: 1, channels: 3, background: "white" },
  }).png().toBuffer();
  const edgeInspected = await inspectSuggestionImage(
    new File([Uint8Array.from(edge)], "edge.png", { type: "application/octet-stream" }),
  );
  assert.deepEqual([edgeInspected.width, edgeInspected.height], [8_192, 1]);

  const tooWide = await sharp({
    create: { width: 8_193, height: 1, channels: 3, background: "white" },
  }).png().toBuffer();
  await assert.rejects(
    inspectSuggestionImage(new File([Uint8Array.from(tooWide)], "wide.png", { type: "image/png" })),
    /dimensions are too large/i,
  );

  const maxPixels = await sharp({
    create: { width: 5_000, height: 5_000, channels: 3, background: "white" },
  }).png().toBuffer();
  const maxPixelsInspected = await inspectSuggestionImage(
    new File([Uint8Array.from(maxPixels)], "pixels.png", { type: "image/png" }),
  );
  assert.deepEqual([maxPixelsInspected.width, maxPixelsInspected.height], [5_000, 5_000]);

  const overPixels = await sharp({
    create: { width: 5_001, height: 5_000, channels: 3, background: "white" },
  }).png().toBuffer();
  await assert.rejects(
    inspectSuggestionImage(new File([Uint8Array.from(overPixels)], "pixels.png", { type: "image/png" })),
    /dimensions are too large/i,
  );

  const frameOne = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  }).png().toBuffer();
  const frameTwo = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "blue" },
  }).png().toBuffer();
  const multipageTiff = await sharp([frameOne, frameTwo], { join: { animated: true } })
    .tiff({ compression: "none" })
    .toBuffer();
  await assert.rejects(
    inspectSuggestionImage(new File([Uint8Array.from(multipageTiff)], "pages.tiff", { type: "image/tiff" })),
    /multi-page/i,
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
  assert.equal(inspected.inputBytes, webp.byteLength);
  assert.equal((await sharp(inspected.bytes).metadata()).format, "webp");

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
