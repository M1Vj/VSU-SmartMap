interface ChatTimestampProps {
  date: Date | string;
}

export function ChatTimestamp({ date }: ChatTimestampProps) {
  const messageDate = date instanceof Date ? date : new Date(date);
  const now = Date.now();
  const secondsDiff = Math.round((messageDate.getTime() - now) / 1000);
  const absoluteSeconds = Math.abs(secondsDiff);

  let formatted = "Just now";

  if (absoluteSeconds >= 45 && absoluteSeconds < 3600) {
    const minutes = Math.round(secondsDiff / 60);
    formatted = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      minutes,
      "minute"
    );
  } else if (absoluteSeconds >= 3600 && absoluteSeconds < 86400) {
    const hours = Math.round(secondsDiff / 3600);
    formatted = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      hours,
      "hour"
    );
  } else if (absoluteSeconds >= 86400) {
    const days = Math.round(secondsDiff / 86400);
    formatted = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      days,
      "day"
    );
  }

  return (
    <time
      dateTime={messageDate.toISOString()}
      className="text-xs text-muted-foreground"
    >
      {formatted}
    </time>
  );
}
