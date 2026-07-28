import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

export class VerificationDocumentCleanupError extends Error {
  constructor() {
    super("Unable to reclaim verification documents.");
    this.name = "VerificationDocumentCleanupError";
  }
}

export async function reclaimExpiredVerificationDocuments() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL
    || !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new VerificationDocumentCleanupError();
  }

  const client = getSupabaseServiceRoleClient();
  const { error } = await client.rpc("delete_expired_verification_documents");
  if (error) throw new VerificationDocumentCleanupError();

  return { completed: true };
}
