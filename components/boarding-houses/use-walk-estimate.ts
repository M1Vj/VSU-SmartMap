"use client";

import { useEffect, useState } from "react";

import { getWalkEstimate, type WalkEstimate } from "@/lib/boarding-houses/route-distance";
import type { LatLngPoint } from "@/lib/boarding-houses/distance";
import { VSU_MAIN_GATE } from "@/lib/constants/map";

type UseWalkEstimateOptions = {
  reference?: LatLngPoint;
  debounceMs?: number;
};

export function useWalkEstimate(
  destination: LatLngPoint | null,
  options: UseWalkEstimateOptions = {},
): { estimate: WalkEstimate | null; loading: boolean } {
  const reference = options.reference ?? VSU_MAIN_GATE;
  const debounceMs = options.debounceMs ?? 350;
  const destinationLat = destination?.lat ?? null;
  const destinationLng = destination?.lng ?? null;
  const [estimate, setEstimate] = useState<WalkEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (destinationLat === null || destinationLng === null) {
      setEstimate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const from = { lat: reference.lat, lng: reference.lng };
    const to = { lat: destinationLat, lng: destinationLng };

    setEstimate(null);

    const debounce = setTimeout(() => {
      setLoading(true);
      void getWalkEstimate(from, to, controller.signal)
        .then((nextEstimate) => {
          if (!cancelled) setEstimate(nextEstimate);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(debounce);
    };
  }, [
    debounceMs,
    destinationLat,
    destinationLng,
    reference.lat,
    reference.lng,
  ]);

  return { estimate, loading };
}
