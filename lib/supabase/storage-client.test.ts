import assert from "node:assert/strict";
import test, { mock } from "node:test";

const MIB = 1024 * 1024;
const uploadCalls: Array<{ bucket: string; path: string; file: File }> = [];
const compressionCalls: File[] = [];

mock.module("@/lib/utils/image-compression", {
  namedExports: {
    validateImageSource(file: File) {
      if (file.size > 30 * MIB) {
        return "This image is too large. Choose an image up to 30 MB.";
      }
      return null;
    },
    async compressImage(file: File) {
      compressionCalls.push(file);
      const webpName = file.name.replace(/\.[^.]+$/, ".webp");
      return {
        file: new File([new Uint8Array(MIB)], webpName, { type: "image/webp" }),
        originalSize: file.size,
        compressedSize: MIB,
        format: "webp",
      };
    },
  },
});

mock.module("@/lib/supabase/browser-client", {
  namedExports: {
    getSupabaseBrowserClient() {
      return {
        storage: {
          from(bucket: string) {
            return {
              async upload(path: string, file: File) {
                uploadCalls.push({ bucket, path, file });
                return { error: null };
              },
              getPublicUrl(path: string) {
                return {
                  data: {
                    publicUrl: `https://example.test/storage/${path}`,
                  },
                };
              },
            };
          },
        },
      };
    },
  },
});

const storageClientModule = import("./storage-client.ts");

test.beforeEach(() => {
  uploadCalls.length = 0;
  compressionCalls.length = 0;
});

test("accepts a facility hero source image up to 30 MB and uploads a 1 MB WebP", async () => {
  const { uploadFacilityHeroClient } = await storageClientModule;
  const source = new File(
    [new Uint8Array(Math.ceil(16.88 * MIB))],
    "large-campus-photo.jpg",
    { type: "image/jpeg" },
  );

  const result = await uploadFacilityHeroClient("facility-123", source);

  assert.equal(result.error, null);
  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0]?.bucket, "smartmap-bucket");
  assert.match(uploadCalls[0]?.path ?? "", /^facility-123\/hero\/\d+-large-campus-photo\.webp$/);
  assert.equal(uploadCalls[0]?.file.type, "image/webp");
  assert.equal(uploadCalls[0]?.file.size, MIB);
});

test("accepts HEIC facility hero images for conversion before upload", async () => {
  const { uploadFacilityHeroClient } = await storageClientModule;
  const source = new File(
    [new Uint8Array(4 * MIB)],
    "iphone-campus-photo.heic",
    { type: "image/heic" },
  );

  const result = await uploadFacilityHeroClient("facility-123", source);

  assert.equal(result.error, null);
  assert.equal(uploadCalls.length, 1);
  assert.match(uploadCalls[0]?.path ?? "", /iphone-campus-photo\.webp$/);
  assert.equal(uploadCalls[0]?.file.type, "image/webp");
});

test("rejects a facility hero source image above 30 MB before compression", async () => {
  const { uploadFacilityHeroClient } = await storageClientModule;
  const source = new File(
    [new Uint8Array(30 * MIB + 1)],
    "too-large.jpg",
    { type: "image/jpeg" },
  );

  const result = await uploadFacilityHeroClient("facility-123", source);

  assert.equal(result.data, null);
  assert.equal(
    result.error?.message,
    "This image is 30.00 MB. Choose an image up to 30 MB; it will be converted to WebP and compressed to 1 MB before upload.",
  );
  assert.equal(uploadCalls.length, 0);
});

test("explains which facility hero formats are supported", async () => {
  const { uploadFacilityHeroClient } = await storageClientModule;
  const source = new File([new Uint8Array(1024)], "scan.tiff", {
    type: "image/tiff",
  });

  const result = await uploadFacilityHeroClient("facility-123", source);

  assert.equal(
    result.error?.message,
    "This image type is not supported. Choose a JPG, PNG, WebP, HEIC, or HEIF image.",
  );
  assert.equal(uploadCalls.length, 0);
});

test("accepts a room image source up to 30 MB and uploads a WebP no larger than 1 MB", async () => {
  const { uploadRoomImageClient } = await storageClientModule;
  const source = new File(
    [new Uint8Array(Math.ceil(29.5 * MIB))],
    "room-photo.jpg",
    { type: "image/jpeg" },
  );

  const result = await uploadRoomImageClient("facility-123", "room-456", source);

  assert.equal(result.error, null);
  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0]?.file.type, "image/webp");
  assert.equal(uploadCalls[0]?.file.size, MIB);
  assert.equal(compressionCalls[0], source);
});

test("accepts HEIF screenshot sources and converts them before storage", async () => {
  const { uploadBugScreenshotClient } = await storageClientModule;
  const source = new File([new Uint8Array(2 * MIB)], "route.heif", {
    type: "image/heif",
  });

  const result = await uploadBugScreenshotClient("report-123", source);

  assert.equal(result.error, null);
  assert.equal(uploadCalls.length, 1);
  assert.match(uploadCalls[0]?.path ?? "", /route\.webp$/);
  assert.equal(uploadCalls[0]?.file.type, "image/webp");
});

test("rejects image sources above 30 MB before any compression or storage upload", async () => {
  const { uploadRoomImageClient } = await storageClientModule;
  const source = new File(
    [new Uint8Array(30 * MIB + 1)],
    "too-large-room.jpg",
    { type: "image/jpeg" },
  );

  const result = await uploadRoomImageClient("facility-123", "room-456", source);

  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /up to 30 MB/i);
  assert.equal(compressionCalls.length, 0);
  assert.equal(uploadCalls.length, 0);
});
