"use client";

import Link from "next/link";
import { Home, Info, Route, ShieldCheck, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBoardingHousePriceRange } from "@/lib/boarding-houses/filters";
import { formatSlotCount } from "@/lib/boarding-houses/labels";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import { useWalkEstimate } from "@/components/boarding-houses/use-walk-estimate";
import { cn } from "@/lib/utils";

type BoardingHouseMapPopupCardProps = {
  listing: BoardingHouseSummary;
  onDirections?: () => void;
  layout?: "popup" | "bottom-sheet";
};

export function BoardingHouseMapPopupCard({
  listing,
  onDirections,
  layout = "popup",
}: BoardingHouseMapPopupCardProps) {
  const isVerified = listing.verificationStatus === "verified";
  const hasRatings = listing.reviewCount > 0;
  const ratingValue = listing.averageRating.toFixed(1);
  const isBottomSheet = layout === "bottom-sheet";
  const { estimate } = useWalkEstimate(listing.coordinates);
  const walkLabel = estimate
    ? `${estimate.approximate ? "~" : ""}${estimate.minutes} min walk`
    : listing.walkingMinutesToCampusGate !== null
      ? `${listing.walkingMinutesToCampusGate} min walk`
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-3",
        isBottomSheet ? "w-full" : "min-w-[220px] max-w-[260px]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Home className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {listing.name}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {listing.addressLine}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {isVerified && (
              <Badge className="gap-1 rounded-full bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Verified
              </Badge>
            )}
            {hasRatings ? (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground"
                aria-label={`Rated ${ratingValue} out of 5 from ${listing.reviewCount} reviews`}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                {ratingValue}
                <span className="text-muted-foreground">({listing.reviewCount})</span>
              </span>
            ) : (
              <span
                className="text-[11px] text-muted-foreground"
                aria-label="No ratings yet"
              >
                No ratings yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-muted/70 px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">
          {formatBoardingHousePriceRange(listing)}
        </p>
        <p className="mt-1 text-muted-foreground">
          {formatSlotCount(listing.availableSlots ?? 0)}
          {walkLabel ? ` · ${walkLabel}` : ""}
        </p>
      </div>

      <div className={cn("flex gap-2", isBottomSheet && "flex-col")}>
        {isBottomSheet && (
          <Button
            size="sm"
            className="h-11 w-full gap-2 bg-blue-600 text-sm text-white hover:bg-blue-700"
            onClick={onDirections}
          >
            <Route className="h-4 w-4" aria-hidden />
            Navigate
          </Button>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className={cn("gap-2", isBottomSheet ? "h-10 w-full text-sm" : "h-8 flex-1 text-xs")}
        >
          <Link href={`/boarding-houses/${listing.slug}`}>
            <Info className="h-3 w-3" aria-hidden />
            Details
          </Link>
        </Button>
        {!isBottomSheet && (
          <Button
            size="sm"
            className="h-8 flex-1 gap-2 bg-blue-600 text-xs text-white hover:bg-blue-700"
            onClick={onDirections}
          >
            <Route className="h-3 w-3" aria-hidden />
            Navigate
          </Button>
        )}
      </div>
    </div>
  );
}
