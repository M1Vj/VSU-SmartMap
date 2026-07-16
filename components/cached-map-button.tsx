"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const OFFLINE_MAP_FALLBACK_STYLE = `
<style id="vsu-offline-map-fallback">
[aria-label="Loading map"] .animate-spin { display: none !important; }
[aria-label="Loading map"] {
  background: hsl(var(--background) / 0.92) !important;
}
</style>`;

function withOfflineMapFallback(html: string) {
  const withMessage = html.replace(
    "Loading map and locations...",
    "Map data has not been cached on this device yet. Reconnect once to save the campus map for offline use.",
  );

  if (withMessage.includes('id="vsu-offline-map-fallback"')) {
    return withMessage;
  }

  return withMessage.includes("</head>")
    ? withMessage.replace("</head>", `${OFFLINE_MAP_FALLBACK_STYLE}</head>`)
    : `${OFFLINE_MAP_FALLBACK_STYLE}${withMessage}`;
}

export function CachedMapButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function openCachedMap() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (navigator.serviceWorker?.controller) {
        window.location.assign("/");
        return;
      }

      if ("caches" in window) {
        const cachedMap = await caches.match("/", { ignoreSearch: true });
        const contentType = cachedMap?.headers.get("Content-Type") ?? "";

        if (cachedMap && contentType.includes("text/html")) {
          const html = withOfflineMapFallback(await cachedMap.text());
          window.history.replaceState(null, "", "/");
          document.open();
          document.write(html);
          document.close();
          return;
        }
      }

      window.location.assign("/");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={openCachedMap} disabled={isLoading}>
      {isLoading ? "Opening..." : "View Cached Map"}
    </Button>
  );
}
