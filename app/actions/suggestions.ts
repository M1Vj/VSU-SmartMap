"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { notifyAdmins } from "@/lib/notifications/service";
import { consumeRateLimit, hashRateLimitSubject } from "@/lib/security/rate-limit";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { partialFacilitySchema, unifiedFacilitySchema } from "@/lib/validation/facility";
import { roomSchema } from "@/lib/validation/room";

const SUGGESTION_TYPES = [
  "ADD_FACILITY",
  "EDIT_FACILITY",
  "ADD_ROOM",
  "EDIT_ROOM",
] as const;

const suggestionSchema = z.object({
  type: z.enum(SUGGESTION_TYPES),
  targetId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  uploadId: z.string().uuid().optional(),
  turnstileToken: z.string().min(1).max(4096).optional(),
  turnstileIdempotencyKey: z.string().min(1).max(128).optional(),
}).strict();

const GENERIC_ERROR = "Unable to submit suggestion. Please try again.";

function validateSuggestionPayload(
  type: (typeof SUGGESTION_TYPES)[number],
  payload: Record<string, unknown>,
) {
  if (type === "ADD_FACILITY") return unifiedFacilitySchema.safeParse(payload).success;
  if (type === "EDIT_FACILITY") return partialFacilitySchema.safeParse(payload).success;
  return roomSchema.safeParse(payload).success;
}

function getClientIp(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

export async function createSuggestionAction(input: unknown) {
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success || !validateSuggestionPayload(parsed.data.type, parsed.data.payload)) {
    return { error: GENERIC_ERROR };
  }

  const suppliedImageUrl = parsed.data.payload.imageUrl;
  if (suppliedImageUrl !== undefined && suppliedImageUrl !== null && suppliedImageUrl !== "") {
    return { error: GENERIC_ERROR };
  }

  try {
    if (!parsed.data.uploadId) {
      if (!parsed.data.turnstileToken) return { error: GENERIC_ERROR };
      const verification = await verifyTurnstileToken(
        parsed.data.turnstileToken,
        parsed.data.turnstileIdempotencyKey,
      );
      if (!verification.success) return { error: GENERIC_ERROR };
    }

    const requestHeaders = await headers();
    const ip = getClientIp(requestHeaders);
    const ownerHash = hashRateLimitSubject(ip);
    if (!ownerHash) return { error: GENERIC_ERROR };

    const quota = await consumeRateLimit({
      scope: "public:map-suggestion",
      subject: ip,
      requestLimit: 12,
      windowSeconds: 60 * 60,
    });
    if (!quota.allowed) return { error: GENERIC_ERROR };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return { error: GENERIC_ERROR };

    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client.rpc("submit_map_suggestion", {
      p_owner_hash: ownerHash,
      p_upload_id: parsed.data.uploadId ?? null,
      p_type: parsed.data.type,
      p_target_id: parsed.data.targetId,
      p_payload: parsed.data.payload,
      p_public_storage_base_url: supabaseUrl,
    });
    if (error || !data) return { error: GENERIC_ERROR };

    try {
      await notifyAdmins({
        eventType: "suggestion_submitted",
        subject: `Map suggestion submitted: ${parsed.data.type.replaceAll("_", " ")}`,
        text: [
          `A ${parsed.data.type.replaceAll("_", " ").toLowerCase()} suggestion was submitted.`,
          parsed.data.targetId ? `Target ID: ${parsed.data.targetId}` : "No target facility.",
          "Review it in the admin Suggestions page.",
        ].join("\n"),
        metadata: {
          suggestionId: data.id,
          suggestionType: parsed.data.type,
          targetId: parsed.data.targetId,
        },
        client,
      });
    } catch {
      // Submission is already committed; notification delivery is best-effort.
    }

    revalidatePath("/");
    revalidatePath("/directory");
    revalidatePath("/admin/suggestions");
    revalidatePath("/admin/notifications");
    return { data };
  } catch {
    return { error: GENERIC_ERROR };
  }
}
