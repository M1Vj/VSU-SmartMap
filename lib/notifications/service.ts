import { sendEmailWithProvider, type EmailMessage } from "@/lib/notifications/email";
import {
  NOTIFICATION_EVENTS,
  normalizeRecipientEvents,
  recipientReceivesEvent,
  sanitizeRecipientEmail,
  type NotificationEventType,
} from "@/lib/notifications/routing";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

import type { SupabaseClient } from "@supabase/supabase-js";

type AdminRecipientRow = {
  id: string;
  email: string;
  label: string | null;
  event_types: string[] | null;
  enabled: boolean | null;
  created_at: string;
  updated_at: string;
};

export type AdminNotificationRecipient = {
  id: string;
  email: string;
  label: string;
  eventTypes: NotificationEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDeliveryLog = {
  id: string;
  eventType: string;
  recipientEmail: string;
  subject: string;
  status: "sent" | "skipped" | "failed";
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type DeliveryLogRow = {
  id: string;
  event_type: string;
  recipient_email: string;
  subject: string;
  status: "sent" | "skipped" | "failed";
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

export async function listNotificationRecipients(
  client: SupabaseClient = getSupabaseServiceRoleClient(),
): Promise<AdminNotificationRecipient[]> {
  const { data, error } = await client
    .from("notification_recipients")
    .select("id, email, label, event_types, enabled, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingNotificationTableError(error)) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as AdminRecipientRow[]).map(mapRecipientRow);
}

export async function listNotificationDeliveryLogs(
  client: SupabaseClient = getSupabaseServiceRoleClient(),
  limit = 25,
): Promise<NotificationDeliveryLog[]> {
  const { data, error } = await client
    .from("notification_delivery_logs")
    .select(
      "id, event_type, recipient_email, subject, status, provider, provider_message_id, error_message, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingNotificationTableError(error)) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as DeliveryLogRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function notifyAdmins({
  eventType,
  subject,
  text,
  html,
  metadata = {},
  client = getSupabaseServiceRoleClient(),
}: {
  eventType: NotificationEventType;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<void> {
  const recipients = await listNotificationRecipients(client).catch((error) => {
    console.error("[notifications] recipient lookup failed", error);
    return [];
  });
  const matchedRecipients = recipients.filter((recipient) =>
    recipientReceivesEvent(
      { enabled: recipient.enabled, eventTypes: recipient.eventTypes },
      eventType,
    ),
  );

  if (matchedRecipients.length === 0) {
    await recordDeliveryLog(client, {
      eventType,
      recipientEmail: "admin-notifications-unconfigured",
      subject,
      status: "skipped",
      provider: notificationProviderName(),
      errorMessage: "No enabled admin notification recipients are subscribed to this event.",
      metadata,
    });
    return;
  }

  await Promise.all(
    matchedRecipients.map((recipient) =>
      sendAndLog(client, {
        eventType,
        recipientEmail: recipient.email,
        subject,
        text,
        html: html ?? textToHtml(text),
        metadata,
      }),
    ),
  );
}

export async function notifyOwnerApplicationApproved({
  applicationId,
  reviewerEmail,
  client = getSupabaseServiceRoleClient(),
}: {
  applicationId: string;
  reviewerEmail?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const { data, error } = await client
    .from("owner_applications")
    .select("id, display_name, email")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !data) {
    console.error("[notifications] approved owner application lookup failed", error);
    return;
  }

  const email = sanitizeRecipientEmail((data as { email?: string | null }).email ?? null);
  if (!email) {
    await recordDeliveryLog(client, {
      eventType: "owner_application_approved",
      recipientEmail: "owner-email-missing",
      subject: "Your Campus SmartMap for VSU boarding-house owner application was approved",
      status: "skipped",
      provider: notificationProviderName(),
      errorMessage: "Owner application did not include a valid email address.",
      metadata: { applicationId },
    });
    return;
  }

  const displayName =
    typeof (data as { display_name?: unknown }).display_name === "string"
      ? (data as { display_name: string }).display_name
      : "Boarding-house owner";
  const text = [
    `Hi ${displayName},`,
    "",
    "Your Campus SmartMap for VSU boarding-house owner application has been approved.",
    "You can now sign in to the owner portal and create or submit boarding-house listings for review.",
    reviewerEmail ? `Reviewed by: ${reviewerEmail}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendAndLog(client, {
    eventType: "owner_application_approved",
    recipientEmail: email,
    subject: "Your Campus SmartMap for VSU boarding-house owner application was approved",
    text,
    html: textToHtml(text),
    metadata: { applicationId },
  });

  await notifyAdmins({
    eventType: "owner_application_approved",
    subject: `Owner application approved: ${displayName}`,
    text: `The owner application for ${displayName} (${email}) was approved.`,
    metadata: { applicationId, ownerEmail: email },
    client,
  });
}

async function sendAndLog(
  client: SupabaseClient,
  {
    eventType,
    recipientEmail,
    subject,
    text,
    html,
    metadata,
  }: {
    eventType: NotificationEventType;
    recipientEmail: string;
    subject: string;
    text: string;
    html: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const result = await sendEmailWithProvider({
    message: { to: recipientEmail, subject, text, html } satisfies EmailMessage,
  });

  await recordDeliveryLog(client, {
    eventType,
    recipientEmail,
    subject,
    status: result.status,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    errorMessage: result.errorMessage,
    metadata,
  });
}

async function recordDeliveryLog(
  client: SupabaseClient,
  {
    eventType,
    recipientEmail,
    subject,
    status,
    provider,
    providerMessageId,
    errorMessage,
    metadata,
  }: {
    eventType: NotificationEventType;
    recipientEmail: string;
    subject: string;
    status: "sent" | "skipped" | "failed";
    provider?: string;
    providerMessageId?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await client.from("notification_delivery_logs").insert({
    event_type: eventType,
    recipient_email: recipientEmail,
    subject,
    status,
    provider,
    provider_message_id: providerMessageId,
    error_message: errorMessage,
    metadata: metadata ?? {},
  });

  if (error && !isMissingNotificationTableError(error)) {
    console.error("[notifications] delivery log insert failed", error);
  }
}

function mapRecipientRow(row: AdminRecipientRow): AdminNotificationRecipient {
  return {
    id: row.id,
    email: row.email,
    label: row.label ?? "",
    eventTypes: normalizeRecipientEvents(row.event_types ?? NOTIFICATION_EVENTS.map((event) => event.value)),
    enabled: row.enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br>"))
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notificationProviderName(): string {
  if (
    process.env.EMAIL_PROVIDER === "gmail" ||
    (process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_FROM)
  ) {
    return "gmail";
  }
  return "resend";
}

function isMissingNotificationTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    /notification_recipients|notification_delivery_logs/i.test(error.message ?? "")
  );
}
