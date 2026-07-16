"use client";

import type { FacilityMatch } from "@/lib/types";
import { ChatFacilityCard } from "./chat-facility-card";

interface ChatFacilityCardsProps {
  matches: FacilityMatch[];
}

export function ChatFacilityCards({ matches }: ChatFacilityCardsProps) {
  if (!matches.length) return null;

  const uniqueMatches = Array.from(
    new Map(matches.map((m) => [m.facility.id, m])).values()
  );

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Found {uniqueMatches.length} location{uniqueMatches.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {uniqueMatches.map((match) => (
          <ChatFacilityCard key={match.facility.id} match={match} />
        ))}
      </div>
    </div>
  );
}
