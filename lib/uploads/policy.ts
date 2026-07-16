import sharp from "sharp";

import { STORAGE_BUCKETS } from "@/lib/constants/storage";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
type SupportedImageFormat = "jpeg" | "png" | "webp";

const CONTENT_TYPES: Record<SupportedImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSIONS: Record<SupportedImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

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
  if (!(format in EXTENSIONS)) throw new UploadPolicyError("Unsupported image format.");

  const prefix = kind === "map-suggestion-image" ? "suggestion-images/" : "";
  return {
    bucket: kind === "map-suggestion-image"
      ? STORAGE_BUCKETS.facilityImages
      : STORAGE_BUCKETS.eventProofs,
    objectPath: `${prefix}${tempId}/${uploadId}.${EXTENSIONS[format as SupportedImageFormat]}`,
  };
}

export async function inspectSuggestionImage(file: File) {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadPolicyError("Image is too large.", 413);
  if (!Object.values(CONTENT_TYPES).includes(file.type)) {
    throw new UploadPolicyError("Unsupported image type.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  } catch {
    throw new UploadPolicyError("File is not a valid image.");
  }

  const format = metadata.format as SupportedImageFormat | undefined;
  const width = metadata.width;
  const height = metadata.height;
  if (!format || !(format in CONTENT_TYPES) || !width || !height) {
    throw new UploadPolicyError("File is not a valid supported image.");
  }
  if (CONTENT_TYPES[format] !== file.type) {
    throw new UploadPolicyError("Declared image type does not match file contents.");
  }
  if (
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new UploadPolicyError("Image dimensions are too large.");
  }

  return {
    bytes,
    format,
    contentType: CONTENT_TYPES[format],
    width,
    height,
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
