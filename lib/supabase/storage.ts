import type { PostgrestError } from "@supabase/supabase-js";
import { StorageError } from "@supabase/storage-js";
import { STORAGE_BUCKETS, STORAGE_LIMITS, STORAGE_PATHS } from "@/lib/constants/storage";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "./server-client";

type StorageResult<T> = {
  data: T | null;
  error: PostgrestError | StorageError | null;
};

const BUCKET = STORAGE_BUCKETS.facilityImages;
const MAX_INPUT_BYTES = STORAGE_LIMITS.inputMaxMB * 1024 * 1024;
const ACCEPTED = new Set<string>(STORAGE_LIMITS.acceptedTypes);

const stripBucket = (path: string) =>
  path.replace(new RegExp(`^${BUCKET}/?`), "");

const makePath = (prefix: string, filename: string) => {
  const safeName = filename.trim().replace(/\s+/g, "-");
  return `${prefix}/${Date.now()}-${safeName}`;
};

const normalizeError = (message: string): StorageError => new StorageError(message);

const validateFile = (file: File | Blob) => {
  const type = (file as File).type || "";
  if (type && !ACCEPTED.has(type)) {
    return `Unsupported file type: ${type}`;
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB (max ${STORAGE_LIMITS.inputMaxMB} MB)`;
  }
  return null;
};

const getStorageClient = async (useServiceRole = false) =>
  useServiceRole ? getSupabaseServiceRoleClient() : getSupabaseServerClient();

export const uploadFacilityHero = async (
  facilityId: string,
  file: File | Blob,
  filename: string,
  useServiceRole = false,
): Promise<StorageResult<{ path: string; publicUrl: string | null }>> => {
  const validationError = validateFile(file);
  if (validationError) {
    return { data: null, error: normalizeError(validationError) };
  }

  const prefix = stripBucket(STORAGE_PATHS.facilityHero(facilityId));
  const path = makePath(prefix, filename);
  const supabase = await getStorageClient(useServiceRole);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
  });
  if (error) return { data: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl
    ? `${data.publicUrl}?t=${Date.now()}`
    : null;

  return { data: { path, publicUrl }, error: null };
};

export const uploadRoomImage = async (
  facilityId: string,
  roomId: string,
  file: File | Blob,
  filename: string,
  useServiceRole = false,
): Promise<StorageResult<{ path: string; publicUrl: string | null }>> => {
  const validationError = validateFile(file);
  if (validationError) {
    return { data: null, error: normalizeError(validationError) };
  }

  const prefix = stripBucket(STORAGE_PATHS.roomImage(facilityId, roomId));
  const path = makePath(prefix, filename);
  const supabase = await getStorageClient(useServiceRole);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
  });
  if (error) return { data: null, error };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl
    ? `${data.publicUrl}?t=${Date.now()}`
    : null;

  return { data: { path, publicUrl }, error: null };
};

export const getPublicImageUrl = async (
  path: string,
): Promise<StorageResult<{ publicUrl: string | null }>> => {
  const relativePath = stripBucket(path);
  const supabase = await getStorageClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(relativePath);
  const publicUrl = data?.publicUrl
    ? `${data.publicUrl}?t=${Date.now()}`
    : null;

  return { data: { publicUrl }, error: null };
};

export const deleteImage = async (
  path: string,
  useServiceRole = false,
): Promise<StorageResult<{ success: boolean }>> => {
  const relativePath = stripBucket(path);
  const supabase = await getStorageClient(useServiceRole);
  const { error } = await supabase.storage.from(BUCKET).remove([relativePath]);
  if (error) return { data: null, error };
  return { data: { success: true }, error: null };
};
