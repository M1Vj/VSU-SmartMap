"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAction } from "@/lib/auth/server";
import { INCIDENT_STATUSES, type IncidentStatus } from "@/lib/observability/logging";
import { updateBugIncidentStatus } from "@/lib/observability/server";

export async function updateIncidentStatusAction(
  id: string,
  status: IncidentStatus,
): Promise<{ error?: string }> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: "Unauthorized" };

  if (!id || !INCIDENT_STATUSES.includes(status)) {
    return { error: "Invalid incident status update." };
  }

  const result = await updateBugIncidentStatus(id, status);
  revalidatePath("/admin/logs");
  return result;
}
