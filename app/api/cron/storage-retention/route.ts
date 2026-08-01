export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { reclaimExpiredEventProofs } from "@/lib/storage/event-proofs";
import { reclaimExpiredPendingUploads } from "@/lib/storage/pending-uploads";
import { reclaimExpiredVerificationDocuments } from "@/lib/storage/verification-documents";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

const MAX_CHAT_OPS_DELETED_PER_TABLE = 5_000;

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function hasExactBearerToken(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function boundedDeletedCount(value: unknown) {
  if (!Number.isInteger(value) || typeof value !== "number") return 0;
  return Math.min(Math.max(value, 0), MAX_CHAT_OPS_DELETED_PER_TABLE);
}

async function purgeAiChatOpsData() {
  const { data, error } = await getSupabaseServiceRoleClient().rpc("purge_ai_chat_ops", {
    p_batch_size: MAX_CHAT_OPS_DELETED_PER_TABLE,
  });
  if (error) throw new Error("chat operations retention failed");
  const result = Array.isArray(data) ? data[0] : data;
  return {
    feedbackDeleted: boundedDeletedCount(result?.feedback_deleted),
    turnsDeleted: boundedDeletedCount(result?.turns_deleted),
    alertClaimsDeleted: boundedDeletedCount(result?.alert_claims_deleted),
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return response({ error: "Storage retention unavailable." }, 503);
  if (!hasExactBearerToken(request.headers.get("authorization"), secret)) {
    return response({ error: "Unauthorized." }, 401);
  }

  const [pendingUploads, eventProofs, verificationDocuments, chatOps] =
    await Promise.allSettled([
      reclaimExpiredPendingUploads(),
      reclaimExpiredEventProofs(),
      reclaimExpiredVerificationDocuments(),
      purgeAiChatOpsData(),
    ]);
  if (
    pendingUploads.status === "rejected"
    || eventProofs.status === "rejected"
    || verificationDocuments.status === "rejected"
    || chatOps.status === "rejected"
  ) {
    return response({ error: "Unable to reclaim storage." }, 500);
  }
  return response({
    pendingUploads: pendingUploads.value,
    eventProofs: eventProofs.value,
    verificationDocuments: verificationDocuments.value,
    chatOps: chatOps.value,
  }, 200);
}
