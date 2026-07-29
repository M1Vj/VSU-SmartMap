"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Facility } from "@/lib/types/facility";
import type { MapItem } from "@/lib/types/map";
import { BoardingHouseMapPopupCard } from "./boarding-house-map-popup-card";
import { MapPopupCard } from "./map-popup-card";
import { useIsMobile } from "./use-is-mobile";

type MapBottomCardProps = {
  item: MapItem | null;
  onClose: () => void;
  onViewDetails: () => void;
  onDirections: (item: MapItem) => void;
};

export function MapBottomCard({
  item,
  onClose,
  onViewDetails,
  onDirections,
}: MapBottomCardProps) {
  const isMobile = useIsMobile();

  if (!isMobile || !item) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-50 px-3 md:hidden">
      <section
        role="dialog"
        aria-label={`${item.name} details`}
        className="pointer-events-auto mx-auto max-h-[min(42vh,22rem)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border/80 bg-background/95 shadow-2xl ring-1 ring-black/5 backdrop-blur"
      >
        <div className="relative pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-11 w-11 rounded-full"
            onClick={onClose}
            aria-label="Close selected location card"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
          <div className="pt-4">
            {item.kind === "boarding_house" ? (
              <BoardingHouseMapPopupCard
                listing={item.summary}
                layout="bottom-sheet"
                onDirections={() => onDirections(item)}
              />
            ) : (
              <MapPopupCard
                facility={item as unknown as Facility}
                layout="bottom-sheet"
                onViewDetails={onViewDetails}
                onDirections={() => onDirections(item)}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
