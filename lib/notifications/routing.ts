export const NOTIFICATION_EVENTS = [
  {
    value: "owner_application_submitted",
    label: "Owner applications",
    description: "A boarding-house owner submitted an application.",
  },
  {
    value: "owner_application_approved",
    label: "Owner approvals",
    description: "An owner application was approved.",
  },
  {
    value: "boarding_house_listing_submitted",
    label: "Listing review requests",
    description: "An owner submitted a listing for admin review.",
  },
  {
    value: "boarding_house_listing_updated",
    label: "Listing updates",
    description: "A live listing update needs re-review.",
  },
  {
    value: "boarding_house_report_submitted",
    label: "Boarding-house reports",
    description: "A student reported a boarding house.",
  },
  {
    value: "suggestion_submitted",
    label: "Suggestions",
    description: "A user submitted a map suggestion.",
  },
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENTS)[number]["value"];

export type RecipientRoute = {
  enabled: boolean;
  eventTypes: readonly string[];
};

const EVENT_VALUES = new Set<string>(NOTIFICATION_EVENTS.map((event) => event.value));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isNotificationEventType(value: string): value is NotificationEventType {
  return EVENT_VALUES.has(value);
}

export function sanitizeRecipientEmail(value: FormDataEntryValue | string | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function normalizeRecipientEvents(values: readonly unknown[]): NotificationEventType[] {
  const events = Array.from(
    new Set(
      values.filter(
        (value): value is NotificationEventType =>
          typeof value === "string" && isNotificationEventType(value),
      ),
    ),
  );

  return events.length > 0 ? events : NOTIFICATION_EVENTS.map((event) => event.value);
}

export function recipientReceivesEvent(
  recipient: RecipientRoute,
  eventType: NotificationEventType,
): boolean {
  return recipient.enabled && recipient.eventTypes.includes(eventType);
}

export function notificationEventLabel(eventType: string): string {
  return (
    NOTIFICATION_EVENTS.find((event) => event.value === eventType)?.label ??
    eventType.replaceAll("_", " ")
  );
}
