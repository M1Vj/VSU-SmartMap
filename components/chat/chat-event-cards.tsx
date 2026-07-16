"use client";

import { ChatEventCard } from "./chat-event-card";
import type { EventMatch } from "@/lib/types/chat";

interface ChatEventCardsProps {
  events: EventMatch[];
}

export function ChatEventCards({ events }: ChatEventCardsProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {events.map((event) => (
        <ChatEventCard key={event.eventId} event={event} />
      ))}
    </div>
  );
}
