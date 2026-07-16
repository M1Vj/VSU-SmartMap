"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAction } from "@/lib/auth/server";
import {
  normalizeRecipientEvents,
  sanitizeRecipientEmail,
} from "@/lib/notifications/routing";

export type NotificationActionResult = {
  error?: string;
  message?: string;
};

const SETTINGS_PATH = "/admin/notifications";

export async function addNotificationRecipient(
  formData: FormData,
): Promise<NotificationActionResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const email = sanitizeRecipientEmail(formData.get("email"));
  if (!email) return { error: "Enter a valid email address." };

  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const eventTypes = normalizeRecipientEvents(formData.getAll("eventTypes"));

  const { error } = await admin.serviceClient.from("notification_recipients").insert({
    email,
    label,
    event_types: eventTypes,
    enabled: formData.get("enabled") != null,
    created_by: admin.user.id,
    updated_by: admin.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That email is already on the notification list." };
    }
    console.error("[notifications] add recipient failed", error);
    return { error: "Could not add notification recipient." };
  }

  revalidatePath(SETTINGS_PATH);
  return { message: "Notification recipient added." };
}

export async function updateNotificationRecipient(
  formData: FormData,
): Promise<NotificationActionResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Recipient was not found." };

  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const eventTypes = normalizeRecipientEvents(formData.getAll("eventTypes"));

  const { error } = await admin.serviceClient
    .from("notification_recipients")
    .update({
      label,
      event_types: eventTypes,
      enabled: formData.get("enabled") != null,
      updated_by: admin.user.id,
    })
    .eq("id", id);

  if (error) {
    console.error("[notifications] update recipient failed", error);
    return { error: "Could not update notification recipient." };
  }

  revalidatePath(SETTINGS_PATH);
  return { message: "Notification recipient updated." };
}

export async function deleteNotificationRecipient(
  formData: FormData,
): Promise<NotificationActionResult> {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Recipient was not found." };

  const { error } = await admin.serviceClient
    .from("notification_recipients")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[notifications] delete recipient failed", error);
    return { error: "Could not remove notification recipient." };
  }

  revalidatePath(SETTINGS_PATH);
  return { message: "Notification recipient removed." };
}

function logFailure(result: NotificationActionResult): void {
  if (result.error) {
    console.error(`[notifications] action failed: ${result.error}`);
  }
}

export async function addNotificationRecipientForm(formData: FormData): Promise<void> {
  logFailure(await addNotificationRecipient(formData));
}

export async function updateNotificationRecipientForm(formData: FormData): Promise<void> {
  logFailure(await updateNotificationRecipient(formData));
}

export async function deleteNotificationRecipientForm(formData: FormData): Promise<void> {
  logFailure(await deleteNotificationRecipient(formData));
}
