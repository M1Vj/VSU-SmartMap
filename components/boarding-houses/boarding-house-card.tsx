"use client";

import Link from "next/link";
import Image from "next/image";
import type { ComponentType } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock, Home, MapPin, ShieldCheck, Star } from "lucide-react";

import { formatBoardingHousePriceRange } from "@/lib/boarding-houses/filters";
import {
  formatAvailabilityLabel,
  formatWalkEstimateLabel,
} from "@/lib/boarding-houses/labels";
import type { WalkEstimate } from "@/lib/boarding-houses/route-distance";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import { Badge } from "@/components/ui/badge";

type BoardingHouseCardProps = {
  listing: BoardingHouseSummary;
  /** Routed walking estimate from the reference point to this listing. */
  walk?: WalkEstimate | null;
  /** Route is still resolving for this listing. */
  pending?: boolean;
  referenceLabel?: string;
  /** "comfortable" = full photo card; "compact" = dense file-manager-style row. */
  variant?: "comfortable" | "compact";
};

export function BoardingHouseCard({
  listing,
  walk,
  pending = false,
  referenceLabel = "your spot",
  variant = "comfortable",
}: BoardingHouseCardProps) {
  const detailHref = `/boarding-houses/${listing.slug}`;
  const hasReviews = listing.reviewCount > 0;
  const ratingValue = listing.averageRating.toFixed(1);
  const ratingLabel = hasReviews
    ? `Rated ${ratingValue} out of 5 from ${listing.reviewCount} ${
        listing.reviewCount === 1 ? "review" : "reviews"
      }`
    : "No ratings yet";

  const availability = formatAvailabilityLabel(listing.availableSlots);

  const freshness = formatUpdatedAgo(listing.updatedAt);

  const amenities = [
    listing.amenities.wifi ? "Wi-Fi" : null,
    listing.amenities.furnished ? "Furnished" : null,
    listing.waterIncluded ? "Water included" : null,
    listing.electricityIncluded ? "Electricity included" : null,
    listing.amenities.cookingAllowed ? "Cooking allowed" : null,
  ].filter((item): item is string => item !== null);

  if (variant === "compact") {
    const compactWalk = pending
      ? "Measuring walk…"
      : walk
        ? `${walk.approximate ? "~" : ""}${walk.minutes} min walk`
        : listing.walkingMinutesToCampusGate !== null
          ? `${listing.walkingMinutesToCampusGate} min walk`
          : null;

    return (
      <Link
        href={detailHref}
        aria-label={`${listing.name} — ${formatBoardingHousePriceRange(listing)}, ${availability}`}
        className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 shadow-sm outline-none transition duration-200 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {listing.thumbnailUrl ? (
            <Image
              src={listing.thumbnailUrl}
              alt={listing.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted">
              <Home className="h-5 w-5 text-primary/60" aria-hidden="true" />
              <span className="sr-only">No photo available</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold text-foreground">
              {listing.verificationStatus === "verified" && (
                <ShieldCheck
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-label="Verified"
                />
              )}
              <span className="truncate">{listing.name}</span>
            </h3>
            <p className="shrink-0 text-sm font-semibold text-primary">
              {formatBoardingHousePriceRange(listing)}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">{listing.addressLine}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span
              className="inline-flex items-center gap-1"
              aria-label={ratingLabel}
            >
              <Star
                className={
                  hasReviews
                    ? "h-3 w-3 fill-amber-400 text-amber-400"
                    : "h-3 w-3 text-muted-foreground"
                }
                aria-hidden="true"
              />
              {hasReviews ? `${ratingValue} (${listing.reviewCount})` : "New"}
            </span>
            <span
              className={
                listing.availableSlots === 0
                  ? "font-medium text-destructive"
                  : undefined
              }
            >
              {availability}
            </span>
            {compactWalk && <span>{compactWalk}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={detailHref}
      aria-label={`${listing.name} — ${formatBoardingHousePriceRange(listing)}, ${availability}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {listing.thumbnailUrl ? (
          <Image
            src={listing.thumbnailUrl}
            alt={listing.name}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted">
            <Home className="h-10 w-10 text-primary/60" aria-hidden="true" />
            <span className="sr-only">No photo available</span>
          </div>
        )}
        {listing.verificationStatus === "verified" && (
          <Badge className="absolute left-3 top-3 gap-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verified
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold leading-6 text-foreground">
              {listing.name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {listing.addressLine}
            </p>
          </div>
          <p className="shrink-0 text-right text-sm font-semibold text-primary">
            {formatBoardingHousePriceRange(listing)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {hasReviews ? (
            <span
              className="inline-flex items-center gap-1 font-medium text-foreground"
              aria-label={ratingLabel}
            >
              <Star
                className="h-4 w-4 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              {ratingValue}
              <span className="font-normal text-muted-foreground">
                ({listing.reviewCount})
              </span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground"
              aria-label={ratingLabel}
            >
              <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              New
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <Fact
            icon={Home}
            label={availability}
            highlight={listing.availableSlots === 0}
          />
          {pending ? (
            <Fact icon={MapPin} label={`Measuring walk to ${referenceLabel}…`} />
          ) : walk ? (
            <Fact
              icon={MapPin}
              label={formatWalkEstimateLabel(walk, referenceLabel)}
            />
          ) : (
            listing.walkingMinutesToCampusGate !== null && (
              <Fact
                icon={MapPin}
                label={`${listing.walkingMinutesToCampusGate} min walk to campus gate`}
              />
            )
          )}
          <Fact icon={Clock} label={`Updated ${freshness}`} />
        </div>

        {amenities.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {amenities.slice(0, 4).map((item) => (
              <Badge key={item} variant="secondary" className="rounded-full">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function Fact({
  icon: Icon,
  label,
  highlight = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1.5">
      <Icon
        className={
          highlight
            ? "h-3.5 w-3.5 shrink-0 text-destructive"
            : "h-3.5 w-3.5 shrink-0 text-primary"
        }
      />
      <span className={highlight ? "truncate font-medium text-destructive" : "truncate"}>
        {label}
      </span>
    </div>
  );
}

function formatUpdatedAgo(updatedAt: string): string {
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return "recently";
  }
  return `${formatDistanceToNowStrict(parsed)} ago`;
}
