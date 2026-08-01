import { createHash, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { notifyAdmins } from "@/lib/notifications/service";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

import { sanitizeChatText } from "./sanitize";

export const CHAT_FEEDBACK_MAX_BYTES = 4 * 1024;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const REASONS = [
  "incorrect",
  "outdated",
  "wrong_location",
  "unhelpful",
  "unsafe",
  "other",
] as const;

const baseSchema = z.object({
  turnId: z.string().uuid(),
  feedbackToken: z.string().min(32).max(256).refine((value) => !CONTROL_CHARACTERS.test(value)),
  comment: z.string().trim().max(1000).refine((value) => !CONTROL_CHARACTERS.test(value)).optional(),
});

const FeedbackSchema = z.discriminatedUnion("rating", [
  baseSchema.extend({ rating: z.literal("positive"), reason: z.never().optional() }),
  baseSchema.extend({ rating: z.literal("negative"), reason: z.enum(REASONS) }),
]);

export type ParsedChatFeedback = z.infer<typeof FeedbackSchema>;
export type SubmitChatFeedbackResult = "accepted" | "forbidden" | "error";
type NegativeReason = (typeof REASONS)[number];
type NotificationSender = (input: {
  eventType: "chat_ops_alert";
  subject: string;
  text: string;
  metadata: Record<string, unknown>;
  client?: SupabaseClient;
}) => Promise<void>;

export class FeedbackRequestError extends Error {
  constructor(readonly status: 400 | 413 | 415) {
    super("Invalid feedback request.");
    this.name = "FeedbackRequestError";
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) throw new FeedbackRequestError(400);
    if (parsedLength > CHAT_FEEDBACK_MAX_BYTES) throw new FeedbackRequestError(413);
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
      if (total > CHAT_FEEDBACK_MAX_BYTES) {
        await reader.cancel();
        throw new FeedbackRequestError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function parseFeedbackRequest(
  request: Request,
): Promise<{ data: ParsedChatFeedback; byteLength: number }> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new FeedbackRequestError(415);
  }

  const body = await readBoundedBody(request);
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new FeedbackRequestError(400);
  }
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) throw new FeedbackRequestError(400);
  return { data: parsed.data, byteLength: body.byteLength };
}

function tokenMatches(token: string, storedHash: unknown): boolean {
  const presented = createHash("sha256").update(token).digest();
  const validStoredHash = typeof storedHash === "string" && /^[0-9a-f]{64}$/i.test(storedHash);
  const expected = validStoredHash ? Buffer.from(storedHash, "hex") : Buffer.alloc(32);
  return timingSafeEqual(presented, expected) && validStoredHash;
}

export async function maybeNotifyRepeatedNegativeFeedback(
  {
    releaseId,
    reason,
    occurredAt = new Date(),
  }: { releaseId: string; reason: NegativeReason; occurredAt?: Date },
  client: SupabaseClient = getSupabaseServiceRoleClient(),
  notify: NotificationSender = notifyAdmins,
): Promise<void> {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(releaseId) || Number.isNaN(occurredAt.getTime())) return;

  try {
    const since = new Date(occurredAt.getTime() - 15 * 60 * 1000).toISOString();
    const { count, error } = await client
      .from("ai_chat_feedback")
      .select("id, ai_chat_turns!inner(release_id)", { count: "exact", head: true })
      .eq("rating", "negative")
      .eq("reason", reason)
      .eq("ai_chat_turns.release_id", releaseId)
      .gte("updated_at", since)
      .limit(3);
    if (error || typeof count !== "number" || count < 3) return;

    const fingerprintHash = createHash("sha256")
      .update(`${releaseId}\n${reason}`)
      .digest("hex")
      .slice(0, 32);
    const metadata = {
      category: "repeated_negative_feedback",
      releaseId,
      reason,
      negativeFeedbackCount: Math.min(count, 1_000_000),
    };
    const { data: claimed, error: claimError } = await client.rpc("claim_ai_chat_alert", {
      p_fingerprint: `chat_ops:negative_feedback:${fingerprintHash}`,
      p_occurred_at: occurredAt.toISOString(),
      p_metadata: metadata,
    });
    if (claimError || claimed !== true) return;

    await notify({
      eventType: "chat_ops_alert",
      subject: `Chat feedback alert: ${reason}`,
      text: [
        "Repeated negative chat feedback reached the alert threshold.",
        `Release: ${releaseId}`,
        `Reason: ${reason}`,
        `Count in the last 15 minutes: ${metadata.negativeFeedbackCount}`,
      ].join("\n"),
      metadata,
      client,
    });
  } catch {
    // Feedback is already durable; alerting must remain best-effort.
  }
}

export async function submitChatFeedback(
  feedback: ParsedChatFeedback,
  client: SupabaseClient = getSupabaseServiceRoleClient(),
): Promise<SubmitChatFeedbackResult> {
  try {
    const { data: turn, error: turnError } = await client
      .from("ai_chat_turns")
      .select("feedback_token_hash, release_id")
      .eq("id", feedback.turnId)
      .maybeSingle();

    if (turnError) return "error";
    if (!tokenMatches(feedback.feedbackToken, turn?.feedback_token_hash)) return "forbidden";

    const { error } = await client.from("ai_chat_feedback").upsert({
      turn_id: feedback.turnId,
      rating: feedback.rating,
      reason: feedback.rating === "negative" ? feedback.reason : null,
      comment: feedback.comment ? sanitizeChatText(feedback.comment, 1000) : null,
    }, { onConflict: "turn_id" });
    if (error) return "error";

    const releaseId = typeof turn?.release_id === "string" ? turn.release_id : null;
    if (feedback.rating === "negative" && releaseId) {
      await maybeNotifyRepeatedNegativeFeedback({
        releaseId,
        reason: feedback.reason,
      }, client);
    }
    return "accepted";
  } catch {
    return "error";
  }
}
