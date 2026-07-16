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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MapPin className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Welcome to Campus SmartMap for VSU</h2>
        <p className="text-muted-foreground">
          Ask me about any location on campus. I can help you find buildings,
          offices, and facilities.
        </p>
      </div>

      <div className="w-full max-w-md">
        <p className="mb-3 text-sm text-muted-foreground">
          Try asking something like:
        </p>
        <SuggestionChips onSelect={onSuggestionSelect} disabled={disabled} />
      </div>
    </div>
  );
}
