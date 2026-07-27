"use client";

import { useEffect } from "react";
import { getServiceWorkerMode, getServiceWorkerUrl } from "@/lib/pwa/service-worker";
import { captureClientLogEvent } from "@/components/observability/app-logging-provider";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const mode = getServiceWorkerMode(process.env.NODE_ENV);

    if (mode === "unregister") {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );

      if ("caches" in window) {
        void caches.keys().then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) =>
                cacheName.startsWith("vsu-smartmap-") ||
                cacheName.startsWith("map-tiles-") ||
                cacheName.startsWith("api-cache-"),
              )
              .map((cacheName) => caches.delete(cacheName)),
          ),
        );
      }

      return;
    }

    const serviceWorkerUrl = getServiceWorkerUrl(
      process.env.NEXT_PUBLIC_ENABLE_LOCAL_OFFLINE_SW,
      window.location.hostname,
    );

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .catch((error: unknown) => {
        // Browsers reject this for reasons we do not control and cannot fix:
        // private windows, blocked site data, iOS Lockdown Mode, shield
        // extensions. The app degrades to online-only and still works, so this
        // is an environment note, not a defect. Reporting it through
        // console.error made it a HIGH incident 26 times over ten days,
        // because console.error is patched into the incident pipeline below.
        captureClientLogEvent({
          level: "warn",
          eventName: "pwa.service_worker_unavailable",
          message: "Service worker registration was rejected by the browser",
          metadata: {
            errorType: error instanceof Error ? error.name || "Error" : typeof error,
          },
        });
      });
  }, []);

  return null;
}
