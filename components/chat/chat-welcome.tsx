"use client";

import { MapPin } from "lucide-react";
import { SuggestionChips } from "./suggestion-chips";

interface ChatWelcomeProps {
  onSuggestionSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function ChatWelcome({
  onSuggestionSelect,
  disabled = false,
}: ChatWelcomeProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-5 text-center sm:gap-5 sm:px-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MapPin className="h-5 w-5" aria-hidden />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">Where do you need to go?</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Find campus buildings, offices, services, and nearby places.
        </p>
      </div>

      <div className="w-full">
        <SuggestionChips onSelect={onSuggestionSelect} disabled={disabled} />
      </div>
    </div>
  );
}
