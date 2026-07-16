"use client";

import { useId } from "react";

type MapSearchProps = {
  value: string;
  onChange: (value: string) => void;
  matchCount?: number;
  placeholder?: string;
};

export function MapSearch({
  value,
  onChange,
  matchCount,
  placeholder = "Search buildings by name or code",
}: MapSearchProps) {
  const inputId = useId();
  const noMatches = matchCount !== undefined && matchCount === 0;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="sr-only">
        Search buildings
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {matchCount !== undefined && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {noMatches ? "No matches found" : `${matchCount} result${matchCount === 1 ? "" : "s"}`}
        </p>
      )}
    </div>
  );
}
