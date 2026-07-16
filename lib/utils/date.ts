const PH_TIMEZONE = "Asia/Manila";

const fullFormatter = new Intl.DateTimeFormat("en", {
  timeZone: PH_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const shortFormatter = new Intl.DateTimeFormat("en", {
  timeZone: PH_TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const formatParts = (date: Date | string, formatter: Intl.DateTimeFormat) => {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month"), day: get("day"), year: get("year"), hour: get("hour"), minute: get("minute"), dayPeriod: get("dayPeriod") };
};

export function formatDatePH(date: Date | string): string {
  const { month, day, year, hour, minute, dayPeriod } = formatParts(date, fullFormatter);
  return `${month} ${day}, ${year} at ${hour}:${minute} ${dayPeriod}`;
}

export function formatDateShortPH(date: Date | string): string {
  const { month, day, hour, minute, dayPeriod } = formatParts(date, shortFormatter);
  return `${month} ${day} at ${hour}:${minute} ${dayPeriod}`;
}

export function formatRelativeTimePH(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateShortPH(d);
}
