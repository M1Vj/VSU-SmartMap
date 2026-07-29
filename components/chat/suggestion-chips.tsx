"use client";

import { ArrowUpRight } from "lucide-react";
import { SUGGESTED_QUESTIONS } from "@/lib/constants/chat";

interface SuggestionChipsProps {
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({
  onSelect,
  disabled = false,
}: SuggestionChipsProps) {
  const suggestions = SUGGESTED_QUESTIONS.slice(0, 3);

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-3"
      role="region"
      aria-label="Suggested questions"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{suggestion}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      ))}
    </div>
  );
}
