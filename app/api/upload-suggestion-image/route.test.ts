import assert from "node:assert/strict";
import test, { mock } from "node:test";
import sharp from "sharp";

type PendingInsert = Record<string, unknown>;

let verifyResult: { success: boolean; error?: string } = { success: true };
let quotaResult = { allowed: true, retryAfterSeconds: 0 };
let verifyCalls: Array<[string, string | undefined]> = [];
let quotaCalls: Array<Record<string, unknown>> = [];
let pendingInserts: PendingInsert[] = [];
let deletedPendingIds: string[] = [];
let storageUploads: Array<{ bucket: string; path: string; bytes: Buffer; options: unknown }> = [];
let storageRemovals: Array<{ bucket: string; paths: string[] }> = [];
let pendingInsertError: { message: string } | null = null;
let storageUploadError: { message: string } | null = null;

mock.module("@/lib/turnstile", {
  namedExports: {
    async verifyTurnstileToken(token: string, idempotencyKey?: string) {
      verifyCalls.push([token, idempotencyKey]);
      return verifyResult;
    },
  },
});

mock.module("@/lib/security/rate-limit", {
  namedExports: {
    hashRateLimitSubject(subject: string) {
      return subject === "203.0.113.8" ? "a".repeat(64) : null;
    },
    async consumeRateLimit(input: Record<string, unknown>) {
      quotaCalls.push(input);
      return quotaResult;
    },
  },
});

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return {
        from(table: string) {
          assert.equal(table, "pending_suggestion_uploads");
          return {
            insert(value: PendingInsert) {
              pendingInserts.push(value);
              return {
                select() {
                  return {
                    async single() {
                      return { data: pendingInsertError ? null : { id: value.id }, error: pendingInsertError };
                    },
                  };
                },
              };
            },
            delete() {
              return {
                async eq(column: string, value: string) {
                  assert.equal(column, "id");
                  deletedPendingIds.push(value);
                  return { error: null };
                },
              };
            },
          };
        },
        storage: {
          from(bucket: string) {
            return {
              async upload(path: string, bytes: Buffer, options: unknown) {
                storageUploads.push({ bucket, path, bytes, options });
                return { error: storageUploadError };
              },
              async remove(paths: string[]) {
                storageRemovals.push({ bucket, paths });
                return { error: null };
              },
            };
          },
        },
      };
    },
  },
});

mock.module("@/lib/utils/image-compression", {
  namedExports: {
    validateImageSource(file: File) {
      if (file.size > 30 * 1024 * 1024) {
        return "This image is too large. Choose an image up to 30 MB.";
      }
      return null;
    },
    async compressImage(file: File) {
      const webpName = file.name.replace(/\.[^.]+$/, ".webp");
      const output = new File([new Uint8Array(512 * 1024)], webpName, {
        type: "image/webp",
      });
      return {
        file: output,
        originalSize: file.size,
        compressedSize: output.size,
        format: "webp",
      };
    },
  },
});

mock.module("@/lib/supabase/browser-client", {
  namedExports: {
    getSupabaseBrowserClient() {
      throw new Error("suggestion uploads must not write storage from the browser");
    },
  },
});

const routeModule = import("./route.ts");
const storageClientModule = import("../../../lib/supabase/storage-client.ts");
const TEMP_ID = "550e8400-e29b-41d4-a716-446655440000";

async function validImage(type: "image/png" | "image/webp" = "image/png") {
  const pipeline = sharp({
    create: { width: 3, height: 2, channels: 3, background: "white" },
  });
  const bytes = type === "image/png" ? await pipeline.png().toBuffer() : await pipeline.webp().toBuffer();
  return new File([Uint8Array.from(bytes)], type === "image/png" ? "map.png" : "proof.webp", { type });
}

async function makeRequest(overrides?: {
  kind?: string;
  tempId?: string;
  file?: File;
  token?: string | null;
  bucket?: string;
  contentLength?: number;
}) {
  const form = new FormData();
  form.set("kind", overrides?.kind ?? "map-suggestion-image");
  form.set("tempId", overrides?.tempId ?? TEMP_ID);
  form.set("file", overrides?.file ?? await validImage());
  if (overrides?.token !== null) form.set("turnstileToken", overrides?.token ?? "verified-token");
  form.set("idempotencyKey", "idempotency-1"); // gitleaks:allow -- deterministic test fixture
  if (overrides?.bucket) form.set("bucket", overrides.bucket);

  const request = new Request("https://example.test/api/upload-suggestion-image", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.8" },
    body: form,
  });
  if (overrides?.contentLength !== undefined) {
    request.headers.set("content-length", String(overrides.contentLength));
  }
  return request;
}

function reset() {
  verifyResult = { success: true };
  quotaResult = { allowed: true, retryAfterSeconds: 0 };
  verifyCalls = [];
  quotaCalls = [];
  pendingInserts = [];
  deletedPendingIds = [];
  storageUploads = [];
  storageRemovals = [];
  pendingInsertError = null;
  storageUploadError = null;
}

test.beforeEach(reset);

test("rejects caller-selected buckets and malformed or traversal temp IDs", async () => {
  const { POST } = await routeModule;
  for (const request of [
    await makeRequest({ bucket: "admin-private" }),
    await makeRequest({ tempId: "../../admin" }),
    await makeRequest({ tempId: "not-a-uuid" }),
  ]) {
    const response = await POST(request);
    assert.equal(response.status, 400);
  }
  assert.equal(storageUploads.length, 0);
  assert.equal(pendingInserts.length, 0);
});

test("rejects oversized content-length before CAPTCHA and form parsing", async () => {
  const { POST } = await routeModule;
  const response = await POST(await makeRequest({ contentLength: 31 * 1024 * 1024 }));
  assert.equal(response.status, 413);
  assert.equal(verifyCalls.length, 0);
});

test("requires and verifies CAPTCHA exactly once before privileged access", async () => {
  const { POST } = await routeModule;
  assert.equal((await POST(await makeRequest({ token: null }))).status, 400);
  assert.equal(pendingInserts.length, 0);

  verifyResult = { success: false, error: "provider detail must stay private" };
  const response = await POST(await makeRequest());
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Upload verification failed." });
  assert.deepEqual(verifyCalls, [["verified-token", "idempotency-1"]]); // gitleaks:allow
  assert.equal(pendingInserts.length, 0);
});

test("rejects unbounded CAPTCHA fields before verification", async () => {
  const { POST } = await routeModule;
  const response = await POST(await makeRequest({ token: "x".repeat(4097) }));
  assert.equal(response.status, 400);
  assert.equal(verifyCalls.length, 0);
});

test("rejects spoofed image content before storage", async () => {
  const { POST } = await routeModule;
  const response = await POST(await makeRequest({
    file: new File(["not-image"], "fake.png", { type: "image/png" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(storageUploads.length, 0);
});

test("rejects denied uploads before Sharp inspects the file", async () => {
  quotaResult = { allowed: false, retryAfterSeconds: 41 };
  const { POST } = await routeModule;
  const response = await POST(await makeRequest({
    file: new File(["not-image"], "fake.tiff", { type: "image/tiff" }),
  }));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "41");
  assert.equal(quotaCalls[0]?.costBytes, 9);
  assert.equal(storageUploads.length, 0);
});

test("normalizes decoded image content to WebP before private storage", async () => {
  const jpeg = await sharp({
    create: { width: 5, height: 4, channels: 3, background: "white" },
  }).jpeg().toBuffer();
  const { POST } = await routeModule;
  const response = await POST(await makeRequest({
    file: new File([Uint8Array.from(jpeg)], "photo.png", { type: "image/png" }),
  }));

  assert.equal(response.status, 201);
  assert.equal(quotaCalls[0]?.costBytes, jpeg.byteLength);
  assert.match(String(storageUploads[0]?.path), /\.webp$/);
  assert.deepEqual(storageUploads[0]?.options, {
    upsert: false,
    contentType: "image/webp",
    cacheControl: "3600",
  });
  const metadata = await sharp(storageUploads[0]?.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.deepEqual([metadata.width, metadata.height], [5, 4]);
});

test("returns 429 with Retry-After when the durable request and byte quota rejects", async () => {
  quotaResult = { allowed: false, retryAfterSeconds: 73 };
  const { POST } = await routeModule;
  const response = await POST(await makeRequest());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "73");
  assert.equal(quotaCalls.length, 1);
  assert.equal(pendingInserts.length, 0);
});

test("maps each kind to a fixed path and returns only uploadId and path", async () => {
  const { POST } = await routeModule;
  for (const [kind, prefix, type, bucket] of [
    ["map-suggestion-image", `suggestion-images/${TEMP_ID}`, "image/png", "smartmap-bucket"],
    ["event-proof", TEMP_ID, "image/webp", "event-proofs"],
  ] as const) {
    reset();
    const response = await POST(await makeRequest({ kind, file: await validImage(type) }));
    assert.equal(response.status, 201);
    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["path", "uploadId"]);
    assert.match(String(body.uploadId), /^[0-9a-f-]{36}$/i);
    assert.match(String(body.path), new RegExp(`^${prefix}/`));
    assert.equal(storageUploads[0]?.bucket, bucket);
    assert.equal(pendingInserts[0]?.owner_hash, "a".repeat(64));
    assert.equal(pendingInserts[0]?.kind, kind);
    assert.equal(pendingInserts[0]?.object_path, body.path);
    assert.equal(pendingInserts[0]?.claimed_at, null);
  }
});

test("deletes the pending row when storage upload fails", async () => {
  storageUploadError = { message: "internal bucket detail" };
  const { POST } = await routeModule;
  const response = await POST(await makeRequest());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to store upload." });
  assert.deepEqual(deletedPendingIds, [pendingInserts[0]?.id]);
});

test("does not touch storage when pending-row persistence fails", async () => {
  pendingInsertError = { message: "internal database detail" };
  const { POST } = await routeModule;
  const response = await POST(await makeRequest());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to store upload." });
  assert.equal(storageUploads.length, 0);
  assert.equal(storageRemovals.length, 0);
});

test("client upload helpers send fixed kinds and Turnstile proof and return opaque handles", async (t) => {
  const captured: Array<{ kind: FormDataEntryValue | null; tempId: FormDataEntryValue | null; token: FormDataEntryValue | null; key: FormDataEntryValue | null }> = [];
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    captured.push({
      kind: form.get("kind"),
      tempId: form.get("tempId"),
      token: form.get("turnstileToken"),
      key: form.get("idempotencyKey"),
    });
    return Response.json({
      uploadId: "550e8400-e29b-41d4-a716-446655440000",
      path: "fixed/path.webp",
    }, { status: 201 });
  });

  const { uploadEventProofClient, uploadSuggestionImageClient } = await storageClientModule;
  const file = await validImage("image/webp");
  const token = { token: "turnstile-token", idempotencyKey: "turnstile-idempotency" };
  const mapResult = await uploadSuggestionImageClient(TEMP_ID, file, token);
  const eventResult = await uploadEventProofClient(TEMP_ID, file, token);

  assert.equal(mapResult.error, null);
  assert.equal(eventResult.error, null);
  assert.deepEqual(mapResult.data, {
    uploadId: "550e8400-e29b-41d4-a716-446655440000",
    path: "fixed/path.webp",
  });
  assert.deepEqual(captured, [
    { kind: "map-suggestion-image", tempId: TEMP_ID, token: "turnstile-token", key: "turnstile-idempotency" },
    { kind: "event-proof", tempId: TEMP_ID, token: "turnstile-token", key: "turnstile-idempotency" },
  ]);
});

test("suggestion client converts a HEIC source to WebP before sending it to the server", async (t) => {
  const captured: Array<{ file: File | null }> = [];
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    captured.push({ file: form.get("file") as File | null });
    return Response.json({
      uploadId: "550e8400-e29b-41d4-a716-446655440000",
      path: "fixed/path.webp",
    }, { status: 201 });
  });

  const original = new File([new Uint8Array(2 * 1024 * 1024)], "photo.heic", {
    type: "image/heic",
  });
  const { uploadSuggestionImageClient } = await storageClientModule;
  const result = await uploadSuggestionImageClient(TEMP_ID, original, {
    token: "turnstile-token",
    idempotencyKey: "turnstile-idempotency",
  });

  assert.equal(result.error, null);
  assert.equal(captured.length, 1);
  const sent = captured[0]?.file;
  assert.ok(sent);
  assert.equal(sent.name, "photo.webp");
  assert.equal(sent.type, "image/webp");
  assert.ok(sent.size <= 1024 * 1024);
});

test("event proof client converts a HEIF source to WebP before sending it to the server", async (t) => {
  const captured: Array<{ file: File | null }> = [];
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    captured.push({ file: form.get("file") as File | null });
    return Response.json({
      uploadId: "550e8400-e29b-41d4-a716-446655440000",
      path: "fixed/path.webp",
    }, { status: 201 });
  });

  const original = new File([new Uint8Array(2 * 1024 * 1024)], "proof.heif", {
    type: "image/heif",
  });
  const { uploadEventProofClient } = await storageClientModule;
  const result = await uploadEventProofClient(TEMP_ID, original, {
    token: "turnstile-token",
    idempotencyKey: "turnstile-idempotency",
  });

  assert.equal(result.error, null);
  const sent = captured[0]?.file;
  assert.ok(sent);
  assert.equal(sent.name, "proof.webp");
  assert.equal(sent.type, "image/webp");
  assert.ok(sent.size <= 1024 * 1024);
});

test("suggestion client accepts image sources through 30 MB but rejects larger files before sending", async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    return Response.json({ error: "should not send" }, { status: 500 });
  });

  const oversized = new File([new Uint8Array(30 * 1024 * 1024 + 1)], "too-large.jpg", {
    type: "image/jpeg",
  });
  const { uploadSuggestionImageClient } = await storageClientModule;
  const result = await uploadSuggestionImageClient(TEMP_ID, oversized, {
    token: "turnstile-token",
    idempotencyKey: "turnstile-idempotency",
  });

  assert.match(result.error?.message ?? "", /up to 30 MB/i);
  assert.equal(fetchCalls, 0);
});
