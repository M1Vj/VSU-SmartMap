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
        const errorType = error instanceof Error ? error.name || "Error" : typeof error;

        // Two very different failures arrive here and must not be merged.
        //
        // SecurityError and friends mean the browser refused for reasons we do
        // not control and cannot fix: private windows, blocked site data, iOS
        // Lockdown Mode, shield extensions. The app degrades to online-only and
        // still works, so it is an environment note. Reporting those through
        // console.error made them a HIGH incident 26 times over ten days.
        //
        // A TypeError means the script itself could not be fetched or parsed -
        // a missing sw.js, the wrong MIME type, a bad scope. That is our
        // deployment being broken for every user at once, and it has to stay
        // loud. Exempting it would turn the most serious version of this
        // failure into the quietest.
        const isBrowserPolicy =
          errorType === "SecurityError" ||
          errorType === "NotSupportedError" ||
          errorType === "InvalidStateError" ||
          errorType === "AbortError";

        captureClientLogEvent(
          isBrowserPolicy
            ? {
              level: "warn",
              eventName: "pwa.service_worker_unavailable",
              message: "Service worker registration was refused by the browser",
              metadata: { errorType },
            }
            : {
              level: "error",
              eventName: "pwa.service_worker_registration_failed",
              message: "Service worker script could not be registered",
              metadata: { errorType },
            },
        );
      });
  }, []);

  return null;
}
