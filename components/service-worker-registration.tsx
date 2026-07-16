"use client";

import { useEffect } from "react";
import { getServiceWorkerMode, getServiceWorkerUrl } from "@/lib/pwa/service-worker";

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
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  }, []);

  return null;
}
