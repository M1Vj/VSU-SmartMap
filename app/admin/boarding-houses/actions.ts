"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAction } from "@/lib/auth/server";
import { notifyOwnerApplicationApproved } from "@/lib/notifications/service";

export type ModerationResult = {
  error?: string;
  message?: string;
};

const ADMIN_PATH = "/admin/boarding-houses";
const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
type ReportStatus = (typeof REPORT_STATUSES)[number];

export async function approveOwnerApplicationResult(formData: FormData): Promise<ModerationResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing application id." };

  const { error } = await admin.serviceClient.rpc("approve_owner_application", {
    p_application_id: id,
    p_reviewer_id: admin.user.id,
    p_reviewer_note: null,
  });

  if (error) return { error: error.message };

  await notifyOwnerApplicationApproved({
    applicationId: id,
    reviewerEmail: admin.user.email,
    client: admin.serviceClient,
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin/notifications");
  return { message: "Owner application approved." };
}

export async function rejectOwnerApplicationResult(formData: FormData): Promise<ModerationResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing application id." };

  const reviewerNote = String(formData.get("reviewerNote") ?? "").trim() || null;
  const { error } = await admin.serviceClient
    .from("owner_applications")
    .update({
      status: "rejected",
      reviewer_id: admin.user.id,
      reviewer_note: reviewerNote,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath(ADMIN_PATH);
  return { message: "Owner application rejected." };
}

async function moderateListingResult(
  formData: FormData,
  action: "publish" | "reject" | "unpublish" | "suspend",
  successMessage: string,
): Promise<ModerationResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing listing id." };

  const note = String(formData.get("note") ?? "").trim() || null;
  const { error } = await admin.serviceClient.rpc("moderate_boarding_house_listing", {
    p_listing_id: id,
    p_action: action,
    p_actor_id: admin.user.id,
    p_note: note,
  });

  if (error) return { error: error.message };

  revalidatePath(ADMIN_PATH);
  revalidatePath("/boarding-houses");
  revalidatePath("/");
  return { message: successMessage };
}

export async function publishBoardingHouseListingResult(formData: FormData): Promise<ModerationResult> {
  return moderateListingResult(formData, "publish", "Listing published.");
}

export async function rejectBoardingHouseListingResult(formData: FormData): Promise<ModerationResult> {
  return moderateListingResult(formData, "reject", "Listing rejected.");
}

export async function unpublishBoardingHouseListingResult(formData: FormData): Promise<ModerationResult> {
  return moderateListingResult(formData, "unpublish", "Listing unpublished.");
}

export async function suspendBoardingHouseListingResult(formData: FormData): Promise<ModerationResult> {
  return moderateListingResult(formData, "suspend", "Listing suspended.");
}

export async function updateBoardingHouseReportResult(formData: FormData): Promise<ModerationResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing report id." };

  const requestedStatus = String(formData.get("status") ?? "resolved");
  const status: ReportStatus = REPORT_STATUSES.includes(requestedStatus as ReportStatus)
    ? (requestedStatus as ReportStatus)
    : "resolved";

  const reviewerNote = String(formData.get("reviewerNote") ?? "").trim() || null;
  const { error } = await admin.serviceClient
    .from("boarding_house_reports")
    .update({
      status,
      reviewer_id: admin.user.id,
      reviewer_note: reviewerNote,
      resolved_at: ["resolved", "dismissed"].includes(status) ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(ADMIN_PATH);
  return { message: "Report updated." };
}

// Void-returning form-action bindings. The *Result functions above carry the
// typed {error?, message?} contract for programmatic callers; these wrappers
// log failures so they are not silently swallowed when wired to <form action>.
function logFailure(result: ModerationResult): void {
  if (result.error) {
    console.error(`[boarding-houses] moderation failed: ${result.error}`);
  }
}

export async function approveOwnerApplication(formData: FormData): Promise<void> {
  logFailure(await approveOwnerApplicationResult(formData));
}

export async function rejectOwnerApplication(formData: FormData): Promise<void> {
  logFailure(await rejectOwnerApplicationResult(formData));
}

export async function publishBoardingHouseListing(formData: FormData): Promise<void> {
  logFailure(await publishBoardingHouseListingResult(formData));
}

export async function rejectBoardingHouseListing(formData: FormData): Promise<void> {
  logFailure(await rejectBoardingHouseListingResult(formData));
}

export async function unpublishBoardingHouseListing(formData: FormData): Promise<void> {
  logFailure(await unpublishBoardingHouseListingResult(formData));
}

export async function suspendBoardingHouseListing(formData: FormData): Promise<void> {
  logFailure(await suspendBoardingHouseListingResult(formData));
}

export async function updateBoardingHouseReport(formData: FormData): Promise<void> {
  logFailure(await updateBoardingHouseReportResult(formData));
}
