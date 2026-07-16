"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { getGuideForPath, getTourRouteKey } from "@/lib/help/guides";

const STORAGE_PREFIX = "vsu-tour-prompt:";

/**
 * Shows a dismissible one-time toast per route inviting the user to take the
 * interactive tour. Never auto-starts the tour — the user must opt in.
 */
export function TourNudge() {
  const pathname = usePathname();
  const promptedRef = useRef<string | null>(null);

  useEffect(() => {
    const routeKey = getTourRouteKey(pathname);
    if (!routeKey || promptedRef.current === routeKey) return;

    const storageKey = `${STORAGE_PREFIX}${routeKey}`;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      return;
    }

    // Wait for the page (and its tour targets) to settle before inviting.
    const timer = window.setTimeout(() => {
      const guide = getGuideForPath(pathname);
      const steps = guide.tourSteps;
      if (!steps || steps.length === 0) return;

      promptedRef.current = routeKey;
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        /* ignore quota/availability errors */
      }

      toast("New here? Take a quick tour of this page", {
        id: `tour-nudge:${routeKey}`,
        duration: 8000,
        action: {
          label: "Start tour",
          onClick: () => {
            void import("@/lib/help/tour").then(({ startTour }) => startTour(steps));
          },
        },
      });
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
