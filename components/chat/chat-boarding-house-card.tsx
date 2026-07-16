"use client";

import Link from "next/link";
import { Home, MapPin, Users } from "lucide-react";

import type { BoardingHouseMatch } from "@/lib/types";

interface ChatBoardingHouseCardProps {
  boardingHouse: BoardingHouseMatch;
}

export function ChatBoardingHouseCard({ boardingHouse }: ChatBoardingHouseCardProps) {
  return (
    <Link
      href={`/boarding-houses/${boardingHouse.slug}`}
      className="flex w-60 flex-col gap-3 rounded-lg border bg-card/90 p-3 transition hover:border-primary/20"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Home className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="truncate text-sm font-medium">{boardingHouse.name}</h4>
          <p className="text-xs font-medium text-muted-foreground">
            {formatPriceRange(boardingHouse.priceMin, boardingHouse.priceMax)}
          </p>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>{formatSlots(boardingHouse.availableSlots)}</span>
        </div>
        {boardingHouse.walkingMinutesToCampusGate !== null && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span>{boardingHouse.walkingMinutesToCampusGate} min walk to campus gate</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function formatPriceRange(priceMin: number | null, priceMax: number | null): string {
  if (priceMin !== null && priceMax !== null) {
    if (priceMin === priceMax) return `₱${priceMin.toLocaleString()}/month`;
    return `₱${priceMin.toLocaleString()}-₱${priceMax.toLocaleString()}/month`;
  }

  if (priceMin !== null) return `From ₱${priceMin.toLocaleString()}/month`;
  if (priceMax !== null) return `Up to ₱${priceMax.toLocaleString()}/month`;
  return "Price not listed";
}

function formatSlots(slots: number | null): string {
  if (slots === null) return "Slots not listed";
  if (slots === 0) return "No slots listed";
  if (slots === 1) return "1 slot available";
  return `${slots} slots available`;
}
