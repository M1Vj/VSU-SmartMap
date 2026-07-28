import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import {
  VERIFICATION_DOCUMENT_BUCKET,
  isValidVerificationDocumentLocation,
} from "@/lib/storage/verification-document-path";

const MAX_BATCH_SIZE = 100;

type ServiceClient = ReturnType<typeof getSupabaseServiceRoleClient>;
type StorageRemovalError = {
  message?: string;
  status?: number;
  statusCode?: number;
  code?: string;
};

type VerificationDocumentClaim = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  claim_token: string;
};

export class VerificationDocumentCleanupError extends Error {
  constructor() {
    super("Unable to reclaim verification documents.");
    this.name = "VerificationDocumentCleanupError";
  }
}

function boundedBatchSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) return MAX_BATCH_SIZE;
  return Math.min(value, MAX_BATCH_SIZE);
}

function isMissingObjectError(error: StorageRemovalError) {
  return (
    error.status === 404
    || error.statusCode === 404
    || error.code?.toLowerCase() === "not_found"
    || error.message?.toLowerCase().includes("not found") === true
  );
}

export async function reclaimExpiredVerificationDocuments(options?: {
  client?: ServiceClient;
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new VerificationDocumentCleanupError();
  if (
    !options?.client
    && (
      !process.env.NEXT_PUBLIC_SUPABASE_URL
      || !process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  ) {
    throw new VerificationDocumentCleanupError();
  }

  const client = options?.client ?? getSupabaseServiceRoleClient();
  const nowIso = now.toISOString();
  const limit = boundedBatchSize(options?.batchSize);
  const { data, error } = await client.rpc("claim_expired_verification_documents", {
    p_now: nowIso,
    p_limit: limit,
    p_lease_seconds: 15 * 60,
  });
  if (error) throw new VerificationDocumentCleanupError();

  const rows = (data ?? []) as VerificationDocumentClaim[];
  let reclaimed = 0;
  let retry = 0;

  for (const row of rows.slice(0, MAX_BATCH_SIZE)) {
    if (!isValidVerificationDocumentLocation(row.storage_bucket, row.storage_path)) {
      await client.rpc("release_verification_document_deletion", {
        p_document_id: row.id,
        p_claim_token: row.claim_token,
      });
      retry += 1;
      continue;
    }

    const { error: storageError } = await client.storage
      .from(VERIFICATION_DOCUMENT_BUCKET)
      .remove([row.storage_path]);
    if (storageError && !isMissingObjectError(storageError)) {
      await client.rpc("release_verification_document_deletion", {
        p_document_id: row.id,
        p_claim_token: row.claim_token,
      });
      retry += 1;
      continue;
    }

    const { data: completed, error: completeError } = await client.rpc(
      "complete_verification_document_deletion",
      {
        p_document_id: row.id,
        p_claim_token: row.claim_token,
      },
    );
    if (completeError || completed !== true) {
      retry += 1;
      continue;
    }
    reclaimed += 1;
  }

  return {
    scanned: Math.min(rows.length, MAX_BATCH_SIZE),
    reclaimed,
    retry,
  };
}
