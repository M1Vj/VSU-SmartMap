import sharp from "sharp";

import { STORAGE_BUCKETS, STORAGE_LIMITS } from "@/lib/constants/storage";

export const MAX_IMAGE_BYTES = STORAGE_LIMITS.imageInputMaxMB * 1024 * 1024;
export const MAX_NORMALIZED_IMAGE_BYTES = STORAGE_LIMITS.compressedMaxMB * 1024 * 1024;
export const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 256 * 1024;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 25_000_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SUGGESTION_UPLOAD_KINDS = [
  "map-suggestion-image",
  "event-proof",
] as const;

export type SuggestionUploadKind = (typeof SUGGESTION_UPLOAD_KINDS)[number];
export const SUPPORTED_SOURCE_IMAGE_FORMATS = [
  "jpeg",
  "png",
  "webp",
  "tiff",
  "gif",
  "heif",
] as const;
type SupportedSourceImageFormat = (typeof SUPPORTED_SOURCE_IMAGE_FORMATS)[number];

const SUPPORTED_SOURCE_FORMATS = new Set<string>(SUPPORTED_SOURCE_IMAGE_FORMATS);
const NORMALIZED_IMAGE_FORMAT = "webp" as const;
const NORMALIZED_IMAGE_CONTENT_TYPE = "image/webp" as const;
const NORMALIZED_IMAGE_EXTENSION = "webp" as const;

const SOURCE_FORMAT_ALIASES: Record<string, SupportedSourceImageFormat> = {
  avif: "heif",
  jpeg: "jpeg",
  jpg: "jpeg",
  jpe: "jpeg",
  png: "png",
  webp: "webp",
  tiff: "tiff",
  tif: "tiff",
  gif: "gif",
  heif: "heif",
};

function resolveSourceFormat(value: string | undefined): SupportedSourceImageFormat | null {
  const format = value ? SOURCE_FORMAT_ALIASES[value] : undefined;
  if (!format || !SUPPORTED_SOURCE_FORMATS.has(format)) return null;
  if (sharp.format[format]?.input.buffer !== true) return null;
  return format;
}

export class UploadPolicyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "UploadPolicyError";
  }
}

export function isSuggestionUploadKind(value: string): value is SuggestionUploadKind {
  return (SUGGESTION_UPLOAD_KINDS as readonly string[]).includes(value);
}

export function resolveSuggestionUploadTarget(
  kind: string,
  tempId: string,
  uploadId: string,
  format: string,
) {
  if (!isSuggestionUploadKind(kind)) throw new UploadPolicyError("Invalid upload kind.");
  if (!UUID_PATTERN.test(tempId) || !UUID_PATTERN.test(uploadId)) {
    throw new UploadPolicyError("Invalid upload identifier.");
  }
  if (!resolveSourceFormat(format)) throw new UploadPolicyError("Unsupported image format.");

  const prefix = kind === "map-suggestion-image" ? "suggestion-images/" : "";
  return {
    bucket: kind === "map-suggestion-image"
      ? STORAGE_BUCKETS.facilityImages
      : STORAGE_BUCKETS.eventProofs,
    objectPath: `${prefix}${tempId}/${uploadId}.${NORMALIZED_IMAGE_EXTENSION}`,
  };
}

export async function inspectSuggestionImage(file: File) {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadPolicyError("Image is too large.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new UploadPolicyError("Image is too large.", 413);
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
      pages: 1,
    }).metadata();
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("pixel limit")) {
      throw new UploadPolicyError("Image dimensions are too large.");
    }
    throw new UploadPolicyError("File is not a valid image.");
  }

  const sourceFormat = resolveSourceFormat(metadata.format);
  if (!sourceFormat) {
    throw new UploadPolicyError("Unsupported image format.");
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new UploadPolicyError("Animated or multi-page images are not supported.");
  }

  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new UploadPolicyError("File is not a valid supported image.");
  }
  if (
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width > Math.floor(MAX_IMAGE_PIXELS / height)
  ) {
    throw new UploadPolicyError("Image dimensions are too large.");
  }

  let normalizedBytes: Buffer;
  try {
    normalizedBytes = await sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
      pages: 1,
    })
      .rotate()
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    throw new UploadPolicyError("File is not a valid supported image.");
  }
  if (normalizedBytes.byteLength < 1) {
    throw new UploadPolicyError("File is not a valid supported image.");
  }
  if (normalizedBytes.byteLength > MAX_NORMALIZED_IMAGE_BYTES) {
    throw new UploadPolicyError(
      `Image must be converted to ${STORAGE_LIMITS.compressedMaxMB} MB or smaller before storage.`,
      413,
    );
  }

  return {
    bytes: normalizedBytes,
    format: NORMALIZED_IMAGE_FORMAT,
    sourceFormat,
    contentType: NORMALIZED_IMAGE_CONTENT_TYPE,
    width,
    height,
    inputBytes: bytes.byteLength,
  };
}

export async function readBoundedRequestBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new UploadPolicyError("Invalid content length.");
    }
    if (parsedLength > MAX_MULTIPART_BYTES) {
      throw new UploadPolicyError("Upload body is too large.", 413);
    }
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new UploadPolicyError("Upload body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
