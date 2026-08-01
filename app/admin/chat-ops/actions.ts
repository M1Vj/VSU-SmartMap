"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAction } from "@/lib/auth/server";
import { CHAT_OPS_REVIEW_STATUSES } from "@/lib/supabase/queries/chat-ops.server";

type ReviewInput = { target: "turn" | "feedback"; id: string; status: string; note?: string };

export async function reviewChatOpsRecordAction(input: ReviewInput): Promise<{ error?: string }> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: "Unauthorized" };

  const note = input.note?.trim() ?? "";
  if (
    !["turn", "feedback"].includes(input.target) ||
    !input.id || input.id.length > 200 ||
    !(CHAT_OPS_REVIEW_STATUSES as readonly string[]).includes(input.status) ||
    note.length > 2000
  ) return { error: "Invalid review update." };

  const cleared = input.status === "unreviewed";
  const { error } = await admin.serviceClient
    .from(input.target === "turn" ? "ai_chat_turns" : "ai_chat_feedback")
    .update({
      review_status: input.status,
      review_note: note || null,
      reviewed_at: cleared ? null : new Date().toISOString(),
      reviewed_by: cleared ? null : admin.user.id,
    })
    .eq("id", input.id);

  if (error) return { error: "Review update failed." };
  revalidatePath("/admin/chat-ops");
  return {};
}

export async function reviewChatOpsRecordFormAction(formData: FormData): Promise<void> {
  await reviewChatOpsRecordAction({
    target: formData.get("target") === "feedback" ? "feedback" : "turn",
    id: String(formData.get("id") ?? ""),
    status: String(formData.get("status") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}
