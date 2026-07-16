export type DevicePlatform = "ios" | "android" | "other";

export function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent;

  // iPadOS 13+ reports a Mac user agent; the touch check separates it from a
  // real desktop Safari.
  const isIpadOs =
    ua.includes("Macintosh") &&
    typeof document !== "undefined" &&
    "ontouchend" in document;

  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOs) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

// Best-effort deep link into Android's location settings. Chrome resolves the
// intent when the OS can handle it and navigates to browser_fallback_url
// (here, back to the current page) when it cannot, so a failed attempt never
// strands the user on an error page.
export function androidLocationSettingsIntent(): string | null {
  if (typeof window === "undefined") return null;
  const fallback = encodeURIComponent(window.location.href);
  return `intent://#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;S.browser_fallback_url=${fallback};end`;
}
