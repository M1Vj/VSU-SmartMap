import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

const MAX_BATCH_SIZE = 100;

type PendingUploadRow = {
  id: string;
  bucket: string;
  object_path: string;
};

type StorageRemovalError = {
  message?: string;
  status?: number;
  statusCode?: number;
  code?: string;
};

export class PendingUploadCleanupError extends Error {
  constructor() {
    super("Unable to reclaim pending uploads.");
    this.name = "PendingUploadCleanupError";
  }
}

function boundedBatchSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) return MAX_BATCH_SIZE;
  return Math.min(value, MAX_BATCH_SIZE);
}

function isMissingObjectError(error: StorageRemovalError) {
  return (
    error.status === 404 ||
    error.statusCode === 404 ||
    error.code?.toLowerCase() === "not_found" ||
    error.message?.toLowerCase().includes("not found") === true
  );
}

export async function reclaimExpiredPendingUploads(options?: {
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new PendingUploadCleanupError();
  const nowIso = now.toISOString();
  const client = getSupabaseServiceRoleClient();

  const { data, error } = await client
    .from("pending_suggestion_uploads")
    .select("id,bucket,object_path")
    .is("claimed_at", null)
    .lt("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(boundedBatchSize(options?.batchSize));
  if (error) throw new PendingUploadCleanupError();

  const rows = (data ?? []) as PendingUploadRow[];
  let reclaimed = 0;
  let retry = 0;

  for (const row of rows.slice(0, MAX_BATCH_SIZE)) {
    const { error: storageError } = await client.storage
      .from(row.bucket)
      .remove([row.object_path]);
    if (storageError && !isMissingObjectError(storageError)) {
      retry += 1;
      continue;
    }

    const { error: deleteError, count } = await client
      .from("pending_suggestion_uploads")
      .delete({ count: "exact" })
      .eq("id", row.id)
      .is("claimed_at", null)
      .lt("expires_at", nowIso);
    if (deleteError || count !== 1) {
      retry += 1;
      continue;
    }
    reclaimed += 1;
  }

  return { scanned: Math.min(rows.length, MAX_BATCH_SIZE), reclaimed, retry };
}
