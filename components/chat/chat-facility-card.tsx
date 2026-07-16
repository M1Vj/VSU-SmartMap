"use client";

import { Info, Navigation, MapPin } from "lucide-react";
import { getCategoryMeta } from "@/lib/constants/facilities";
import type { FacilityMatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/context/app-context";
import { createFacilitySelectionRequest } from "@/lib/navigation/facility-navigation";

interface ChatFacilityCardProps {
  match: FacilityMatch;
}

export function ChatFacilityCard({ match }: ChatFacilityCardProps) {
  const { facility, matchReason } = match;
  const meta = getCategoryMeta(facility.category);
  const { selectFacility, setActiveTab } = useApp();

  const handleDirections = () => {
    const request = createFacilitySelectionRequest(facility);
    setActiveTab(request.tab, request.options);
  };

  const handleMoreInfo = () => {
    selectFacility(facility);
    setActiveTab("directory");
  };

  return (
    <div className="flex w-60 flex-col gap-3 rounded-lg border bg-card/90 p-3 transition hover:border-primary/20">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          <MapPin className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="truncate text-sm font-medium">{facility.name}</h4>
          <p className="text-xs font-medium text-muted-foreground">
            {meta.label}
          </p>
          {matchReason && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {matchReason}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleDirections}
        >
          <Navigation className="h-3.5 w-3.5" />
          Directions
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleMoreInfo}
        >
          <Info className="h-3.5 w-3.5" />
          More Info
        </Button>
      </div>
    </div>
  );
}
