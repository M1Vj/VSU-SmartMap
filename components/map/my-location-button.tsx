"use client";

import { Crosshair, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MyLocationButtonProps {
  isTracking: boolean;
  isAcquiring?: boolean;
  hasHeading: boolean;
  onLocate: (e: React.MouseEvent) => void;
  className?: string;
}

export function MyLocationButton({
  isTracking,
  isAcquiring = false,
  hasHeading,
  onLocate,
  className,
}: MyLocationButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onLocate}
      className={cn(
        "group absolute z-[1000] flex h-11 w-11 min-w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none hover:bg-transparent",
        className
      )}
      aria-label={isTracking ? "Tracking your location" : "Show my location"}
      data-tour="map-locate"
      data-map-control="my-location"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[30px] w-[30px] min-w-[30px] items-center justify-center rounded-sm bg-background/95 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-colors duration-200",
          "group-hover:bg-accent group-hover:text-accent-foreground",
          isTracking && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
        )}
      >
        {isAcquiring ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : hasHeading ? (
          <Navigation className="h-4 w-4 fill-blue-500 text-blue-500" />
        ) : isTracking ? (
          <Crosshair className="h-4 w-4 text-blue-500" />
        ) : (
          <Crosshair className="h-4 w-4" />
        )}
      </span>
    </Button>
  );
}
