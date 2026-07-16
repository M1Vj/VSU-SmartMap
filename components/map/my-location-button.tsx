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
        "absolute z-[1000] bg-background/95 shadow-lg ring-1 ring-black/5 backdrop-blur-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-colors duration-200",
        "h-[30px] w-[30px] min-w-[30px] rounded-sm",
        isTracking && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
        className
      )}
      aria-label={isTracking ? "Tracking your location" : "Show my location"}
      data-tour="map-locate"
    >
      {isAcquiring ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      ) : hasHeading ? (
        <Navigation className="h-4 w-4 text-blue-500 fill-blue-500" />
      ) : isTracking ? (
        <Crosshair className="h-4 w-4 text-blue-500" />
      ) : (
        <Crosshair className="h-4 w-4" />
      )}
    </Button>
  );
}
