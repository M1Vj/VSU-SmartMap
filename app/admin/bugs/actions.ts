"use server";

import { revalidatePath } from "next/cache";
import { STORAGE_BUCKETS } from "@/lib/constants/storage";
import { assertAdminAction } from "@/lib/auth/server";

type ActionResult = {
  error?: string;
};

function getBugScreenshotStoragePath(url: string | null): string | null {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${STORAGE_BUCKETS.facilityImages}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = url.slice(markerIndex + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

export async function deleteBugReportAction(id: string): Promise<ActionResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = admin.serviceClient;
  const { data: report, error: fetchError } = await adminClient
    .from("bug_reports")
    .select("id, screenshot_url")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!report) {
    return { error: "Bug report not found" };
  }

  const { error: deleteError } = await adminClient
    .from("bug_reports")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const screenshotPath = getBugScreenshotStoragePath(report.screenshot_url);
  if (screenshotPath) {
    await adminClient.storage
      .from(STORAGE_BUCKETS.facilityImages)
      .remove([screenshotPath]);
  }

  revalidatePath("/admin/bugs");
  return {};
}
