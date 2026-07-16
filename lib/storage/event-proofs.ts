import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

const EVENT_PROOF_BUCKET = "event-proofs";
const MAX_BATCH_SIZE = 100;
const MAX_SIGNED_URL_SECONDS = 300;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PRIVATE_OBJECT_PATTERN = new RegExp(`^${UUID}/${UUID}\\.(?:jpg|png|webp)$`, "i");
const LEGACY_PUBLIC_OBJECT_PATTERN = new RegExp(
  `^event-proofs/${UUID}/${UUID}\\.(?:jpg|png|webp)$`,
  "i",
);
const UUID_PATTERN = new RegExp(`^${UUID}$`, "i");

type ServiceClient = ReturnType<typeof getSupabaseServiceRoleClient>;
type RemovalError = {
  message?: string;
  status?: number;
  statusCode?: number;
  code?: string;
};

export type EventProofLocation = {
  bucket: "event-proofs" | "smartmap-bucket";
  objectPath: string;
};

export class EventProofCleanupError extends Error {
  constructor() {
    super("Unable to reclaim event proofs.");
    this.name = "EventProofCleanupError";
  }
}

function boundedBatchSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) return MAX_BATCH_SIZE;
  return Math.min(value, MAX_BATCH_SIZE);
}

function boundedSignedUrlSeconds(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) return MAX_SIGNED_URL_SECONDS;
  return Math.min(value, MAX_SIGNED_URL_SECONDS);
}

function isMissingObjectError(error: RemovalError) {
  return (
    error.status === 404 ||
    error.statusCode === 404 ||
    error.code?.toLowerCase() === "not_found" ||
    error.message?.toLowerCase().includes("not found") === true
  );
}

export function parseLegacyEventProofUrl(
  rawUrl: string | null | undefined,
  projectUrl: string,
): EventProofLocation | null {
  if (!rawUrl || rawUrl.includes("%")) return null;

  try {
    const value = new URL(rawUrl);
    const project = new URL(projectUrl);
    if (
      value.protocol !== "https:" ||
      value.origin !== project.origin ||
      value.username ||
      value.password ||
      value.search ||
      value.hash
    ) {
      return null;
    }

    const prefix = "/storage/v1/object/public/";
    if (!value.pathname.startsWith(prefix)) return null;
    const storagePath = value.pathname.slice(prefix.length);
    const slash = storagePath.indexOf("/");
    if (slash < 1) return null;
    const bucket = storagePath.slice(0, slash);
    const objectPath = storagePath.slice(slash + 1);

    if (bucket === "smartmap-bucket" && LEGACY_PUBLIC_OBJECT_PATTERN.test(objectPath)) {
      return { bucket, objectPath };
    }
    if (bucket === EVENT_PROOF_BUCKET) {
      if (PRIVATE_OBJECT_PATTERN.test(objectPath)) return { bucket, objectPath };
      if (LEGACY_PUBLIC_OBJECT_PATTERN.test(objectPath)) return { bucket, objectPath };
    }
  } catch {
    return null;
  }
  return null;
}

export async function createAdminEventProofSignedUrl(
  client: ServiceClient,
  suggestionId: string,
  projectUrl: string,
  ttlSeconds = MAX_SIGNED_URL_SECONDS,
) {
  if (!UUID_PATTERN.test(suggestionId)) return null;

  const { data, error } = await client
    .from("event_suggestions")
    .select("proof_object_path,proof_file_url,proof_deleted_at,proof_deletion_started_at")
    .eq("id", suggestionId)
    .maybeSingle();
  if (error || !data || data.proof_deleted_at || data.proof_deletion_started_at) return null;

  let location: EventProofLocation | null = null;
  if (
    typeof data.proof_object_path === "string" &&
    PRIVATE_OBJECT_PATTERN.test(data.proof_object_path)
  ) {
    location = { bucket: EVENT_PROOF_BUCKET, objectPath: data.proof_object_path };
  } else {
    location = parseLegacyEventProofUrl(data.proof_file_url, projectUrl);
  }
  if (!location) return null;

  const { data: signed, error: signError } = await client.storage
    .from(location.bucket)
    .createSignedUrl(location.objectPath, boundedSignedUrlSeconds(ttlSeconds));
  if (signError || !signed?.signedUrl) return null;

  try {
    const signedUrl = new URL(signed.signedUrl);
    const project = new URL(projectUrl);
    const expectedPath =
      `/storage/v1/object/sign/${location.bucket}/${location.objectPath}`;
    if (
      signedUrl.protocol !== "https:" ||
      project.protocol !== "https:" ||
      signedUrl.origin !== project.origin ||
      signedUrl.username ||
      signedUrl.password ||
      signedUrl.hash ||
      signedUrl.pathname !== expectedPath
    ) {
      return null;
    }
    return signedUrl.toString();
  } catch {
    return null;
  }
}

export async function reclaimExpiredEventProofs(options?: {
  client?: ServiceClient;
  now?: Date;
  batchSize?: number;
}) {
  const now = options?.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new EventProofCleanupError();
  const nowIso = now.toISOString();
  const client = options?.client ?? getSupabaseServiceRoleClient();
  const limit = boundedBatchSize(options?.batchSize);

  const { data, error } = await client.rpc("claim_expired_event_proofs", {
    p_now: nowIso,
    p_limit: limit,
    p_lease_seconds: 15 * 60,
  });
  if (error) throw new EventProofCleanupError();

  const rows = (data ?? []) as Array<{
    id: string;
    proof_object_path: string;
    claim_token: string;
  }>;
  let reclaimed = 0;
  let retry = 0;

  for (const row of rows.slice(0, MAX_BATCH_SIZE)) {
    if (!PRIVATE_OBJECT_PATTERN.test(row.proof_object_path)) {
      await client.rpc("release_event_proof_deletion", {
        p_suggestion_id: row.id,
        p_claim_token: row.claim_token,
      });
      retry += 1;
      continue;
    }

    const { error: storageError } = await client.storage
      .from(EVENT_PROOF_BUCKET)
      .remove([row.proof_object_path]);
    if (storageError && !isMissingObjectError(storageError)) {
      await client.rpc("release_event_proof_deletion", {
        p_suggestion_id: row.id,
        p_claim_token: row.claim_token,
      });
      retry += 1;
      continue;
    }

    const { data: completed, error: completeError } = await client.rpc(
      "complete_event_proof_deletion",
      {
        p_suggestion_id: row.id,
        p_claim_token: row.claim_token,
        p_deleted_at: nowIso,
      },
    );
    if (completeError || completed !== true) {
      retry += 1;
      continue;
    }
    reclaimed += 1;
  }

  return { scanned: Math.min(rows.length, MAX_BATCH_SIZE), reclaimed, retry };
}
