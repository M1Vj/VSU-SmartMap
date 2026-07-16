"use client";

import { useEffect, useState } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/constants/chat";

interface SuggestionChipsProps {
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({
  onSelect,
  disabled = false,
}: SuggestionChipsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const shuffled = [...SUGGESTED_QUESTIONS].sort(() => 0.5 - Math.random());
    setSuggestions(shuffled.slice(0, 3));
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2" role="region" aria-label="Suggested questions">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="rounded-full border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
