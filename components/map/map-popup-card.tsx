"use client";

import { Button } from "@/components/ui/button";
import { getCategoryMeta } from "@/lib/constants/facilities";
import type { Facility } from "@/lib/types/facility";
import { cn } from "@/lib/utils";
import { Info, Route } from "lucide-react";
import Image from "next/image";

import { useState } from "react";

interface MapPopupCardProps {
  facility: Facility;
  onViewDetails: () => void;
  onDirections?: () => void; 
  layout?: "popup" | "bottom-sheet";
}

export function MapPopupCard({
  facility,
  onViewDetails,
  onDirections,
  layout = "popup",
}: MapPopupCardProps) {
  const meta = getCategoryMeta(facility.category);
  const [loading, setLoading] = useState(false);
  const isBottomSheet = layout === "bottom-sheet";

  const handleDirections = () => {
    setLoading(true);
    onDirections?.();
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-3",
        isBottomSheet ? "w-full" : "min-w-[200px] max-w-[240px]",
      )}
    >
      <div className="flex items-start gap-3">
        {facility.imageUrl && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={facility.imageUrl}
              alt={facility.name}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        )}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
            {facility.name}
          </h3>
          <span
            className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: meta.color }}
          >
            {meta.label}
          </span>
        </div>
      </div>

      <div className={cn("flex gap-2", isBottomSheet && "flex-col")}>
        {isBottomSheet && (
          <Button
            size="sm"
            className="h-11 w-full gap-2 bg-blue-600 text-sm text-white hover:bg-blue-700"
            onClick={handleDirections}
            loading={loading}
          >
            <Route className="h-4 w-4" aria-hidden />
            Navigate
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={cn("gap-2", isBottomSheet ? "h-10 w-full text-sm" : "h-8 flex-1 text-xs")}
          onClick={onViewDetails}
        >
          <Info className="h-3 w-3" aria-hidden />
          Details
        </Button>
        {!isBottomSheet && (
          <Button
            size="sm"
            className="h-8 flex-1 gap-2 bg-blue-600 text-xs text-white hover:bg-blue-700"
            onClick={handleDirections}
            loading={loading}
          >
            <Route className="h-3 w-3" aria-hidden />
            Navigate
          </Button>
        )}
      </div>
    </div>
  );
}
