import { STORAGE_BUCKETS, STORAGE_LIMITS, STORAGE_PATHS } from "@/lib/constants/storage";
import { compressImage } from "@/lib/utils/image-compression";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { getSupabaseBrowserClient } from "./browser-client";

type StorageResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

const BUCKET = STORAGE_BUCKETS.facilityImages;
const MAX_INPUT_BYTES = STORAGE_LIMITS.inputMaxMB * 1024 * 1024;
const FACILITY_HERO_MAX_INPUT_BYTES = STORAGE_LIMITS.facilityHeroInputMaxMB * 1024 * 1024;
const MAX_COMPRESSED_BYTES = STORAGE_LIMITS.compressedMaxMB * 1024 * 1024;
const ACCEPTED = new Set<string>(STORAGE_LIMITS.acceptedTypes);
const FACILITY_HERO_ACCEPTED = new Set<string>(STORAGE_LIMITS.facilityHeroAcceptedTypes);
const BUCKET_REGEX = new RegExp(`^${BUCKET}/?`);

const stripBucket = (path: string) => path.replace(BUCKET_REGEX, "");

const makePath = (prefix: string, filename: string) => {
  const safeName = filename.trim().replace(/[^a-zA-Z0-9.-]/g, "-");
  return `${prefix}/${Date.now()}-${safeName}`;
};

const validateFile = (file: File | Blob) => {
  const type = (file as File).type || "";
  if (!type) {
    return "File type is required and must be valid.";
  }
  if (!ACCEPTED.has(type)) {
    return `Unsupported file type: ${type}`;
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB (max ${STORAGE_LIMITS.inputMaxMB} MB)`;
  }
  return null;
};

const validateFacilityHeroFile = (file: File) => {
  const type = file.type.toLowerCase();
  const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  if (!FACILITY_HERO_ACCEPTED.has(type) && !FACILITY_HERO_ACCEPTED.has(extension)) {
    return "This image type is not supported. Choose a JPG, PNG, WebP, HEIC, or HEIF image.";
  }
  if (file.size > FACILITY_HERO_MAX_INPUT_BYTES) {
    return `This image is ${(file.size / 1024 / 1024).toFixed(2)} MB. Choose an image up to ${STORAGE_LIMITS.facilityHeroInputMaxMB} MB; it will be converted to WebP and compressed to ${STORAGE_LIMITS.compressedMaxMB} MB before upload.`;
  }
  return null;
};

const validateSuggestionFile = (file: File) => {
  if (file.size > MAX_INPUT_BYTES) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB (max ${STORAGE_LIMITS.inputMaxMB} MB)`;
  }
  return null;
};

const compressAndValidate = async (
  file: File
): Promise<StorageResult<File>> => {
  try {
    const { file: compressedFile } = await compressImage(file);

    if (compressedFile.size > MAX_COMPRESSED_BYTES) {
      return {
        data: null,
        error: {
          message: `Compressed file is still too large: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB (max ${STORAGE_LIMITS.compressedMaxMB} MB). Try a simpler image.`,
        },
      };
    }

    return { data: compressedFile, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message:
          error instanceof Error ? error.message : "Image compression failed",
      },
    };
  }
};

export const uploadFacilityHeroClient = async (
  facilityId: string,
  file: File,
): Promise<StorageResult<{ path: string; publicUrl: string | null }>> => {
  const validationError = validateFacilityHeroFile(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  const compressionResult = await compressAndValidate(file);
  if (compressionResult.error) {
    return { data: null, error: compressionResult.error };
  }
  const compressedFile = compressionResult.data!;

  const prefix = stripBucket(STORAGE_PATHS.facilityHero(facilityId));
  const path = makePath(prefix, compressedFile.name);
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressedFile, {
    upsert: true,
  });
  if (error) return { data: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ? data.publicUrl : null;

  return { data: { path, publicUrl }, error: null };
};

export const uploadSuggestionImageClient = async (
  tempId: string,
  file: File,
  turnstile: TurnstileToken,
): Promise<StorageResult<{ uploadId: string; path: string }>> => {
  const validationError = validateSuggestionFile(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  return uploadPendingSuggestion(
    "map-suggestion-image",
    tempId,
    file,
    turnstile,
    "Unable to upload image",
  );
};

export const uploadEventProofClient = async (
  tempId: string,
  file: File,
  turnstile: TurnstileToken,
): Promise<StorageResult<{ uploadId: string; path: string }>> => {
  const validationError = validateSuggestionFile(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  return uploadPendingSuggestion(
    "event-proof",
    tempId,
    file,
    turnstile,
    "Unable to upload proof",
  );
};

async function uploadPendingSuggestion(
  kind: "map-suggestion-image" | "event-proof",
  tempId: string,
  file: File,
  turnstile: TurnstileToken,
  fallbackMessage: string,
): Promise<StorageResult<{ uploadId: string; path: string }>> {
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("tempId", tempId);
  formData.set("file", file);
  formData.set("turnstileToken", turnstile.token);
  formData.set("idempotencyKey", turnstile.idempotencyKey);

  try {
    const response = await fetch("/api/upload-suggestion-image", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      return { data: null, error: { message: body.error ?? fallbackMessage } };
    }

    const body = (await response.json()) as { uploadId?: unknown; path?: unknown };
    if (typeof body.uploadId !== "string" || typeof body.path !== "string") {
      return { data: null, error: { message: fallbackMessage } };
    }
    return { data: { uploadId: body.uploadId, path: body.path }, error: null };
  } catch {
    return { data: null, error: { message: fallbackMessage } };
  }
}

export const uploadBugScreenshotClient = async (
  reportId: string,
  file: File,
): Promise<StorageResult<{ path: string; publicUrl: string | null }>> => {
  const validationError = validateFile(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  const compressionResult = await compressAndValidate(file);
  if (compressionResult.error) {
    return { data: null, error: compressionResult.error };
  }
  const compressedFile = compressionResult.data!;

  const prefix = stripBucket(STORAGE_PATHS.bugReportScreenshot(reportId));
  const path = makePath(prefix, compressedFile.name);
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressedFile, {
    upsert: true,
  });
  if (error) return { data: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ? data.publicUrl : null;

  return { data: { path, publicUrl }, error: null };
};

export const uploadRoomImageClient = async (
  facilityId: string,
  roomId: string,
  file: File,
): Promise<StorageResult<{ path: string; publicUrl: string | null }>> => {
  const validationError = validateFile(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  const compressionResult = await compressAndValidate(file);
  if (compressionResult.error) {
    return { data: null, error: compressionResult.error };
  }
  const compressedFile = compressionResult.data!;

  const prefix = stripBucket(STORAGE_PATHS.roomImage(facilityId, roomId));
  const path = makePath(prefix, compressedFile.name);
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressedFile, {
    upsert: true,
  });
  if (error) return { data: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ? data.publicUrl : null;

  return { data: { path, publicUrl }, error: null };
};
