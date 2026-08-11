import assert from "node:assert/strict";
import test, { mock } from "node:test";

type CompressionOptions = {
  maxSizeMB?: number;
  fileType?: string;
};

const compressionInputs: Array<{ file: File; options: CompressionOptions }> = [];
const heicConversions: Array<{ blob: Blob; type: string; quality?: number }> = [];

mock.module("browser-image-compression", {
  defaultExport: async (file: File, options: CompressionOptions) => {
    compressionInputs.push({ file, options });
    if (file.type === "image/heic" || file.type === "image/heif") {
      throw new Error("The browser cannot decode HEIC directly");
    }
    return new Blob([new Uint8Array(512 * 1024)], {
      type: options.fileType ?? "image/webp",
    });
  },
});

mock.module("heic-to/csp", {
  namedExports: {
    async isHeic(file: File) {
      return /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
    },
    async heicTo(input: { blob: Blob; type: string; quality?: number }) {
      heicConversions.push(input);
      return new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "image/jpeg" });
    },
  },
});

const imageCompressionModule = import("./image-compression.ts");

test.beforeEach(() => {
  compressionInputs.length = 0;
  heicConversions.length = 0;
});

test("decodes HEIC before converting it to a WebP no larger than 1 MB", async () => {
  const { compressImage } = await imageCompressionModule;
  const source = new File([new Uint8Array(4 * 1024 * 1024)], "campus.heic", {
    type: "image/heic",
  });

  const result = await compressImage(source);

  assert.equal(heicConversions.length, 1);
  assert.equal(heicConversions[0]?.type, "image/jpeg");
  assert.equal(compressionInputs[0]?.file.type, "image/jpeg");
  assert.equal(compressionInputs[0]?.options.fileType, "image/webp");
  assert.equal(compressionInputs[0]?.options.maxSizeMB, 1);
  assert.equal(result.file.name, "campus.webp");
  assert.equal(result.file.type, "image/webp");
  assert.ok(result.file.size <= 1024 * 1024);
});

test("rejects image sources above the shared 30 MB input limit", async () => {
  const { compressImage } = await imageCompressionModule;
  const source = new File([new Uint8Array(30 * 1024 * 1024 + 1)], "too-large.jpg", {
    type: "image/jpeg",
  });

  await assert.rejects(
    compressImage(source),
    /up to 30 MB/i,
  );
  assert.equal(compressionInputs.length, 0);
});
