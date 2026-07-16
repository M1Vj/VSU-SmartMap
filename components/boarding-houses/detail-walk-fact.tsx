"use client";

import { MapPin } from "lucide-react";

import { useWalkEstimate } from "@/components/boarding-houses/use-walk-estimate";
import type { LatLngPoint } from "@/lib/boarding-houses/distance";
import { formatWalkEstimateLabel } from "@/lib/boarding-houses/labels";

type DetailWalkFactProps = {
  coordinates: LatLngPoint;
  ownerMinutes: number | null;
};

export function DetailWalkFact({
  coordinates,
  ownerMinutes,
}: DetailWalkFactProps) {
  const { estimate } = useWalkEstimate(coordinates);

  const label = estimate
    ? formatWalkEstimateLabel(estimate, "campus gate")
    : ownerMinutes !== null
      ? `${ownerMinutes} min walk to campus gate (owner estimate)`
      : null;

  if (!label) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2">
      <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
