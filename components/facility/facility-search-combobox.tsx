"use client";

import { Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { FacilitySearchOption } from "@/lib/map/facility-search-model";
import type { RecentSearch } from "@/lib/map/recent-searches";
import type { Facility } from "@/lib/types/facility";
import { cn } from "@/lib/utils";
import {
  getFacilityComboboxKeyAction,
  getFacilityComboboxRenderState,
} from "./facility-search-combobox-model";

export type FacilitySearchComboboxProps = {
  id: string;
  label: string;
  query: string;
  optionsQuery?: string;
  options: readonly FacilitySearchOption[];
  selectedFacilityId?: string;
  loading?: boolean;
  unavailable?: boolean;
  unavailableMessage?: string;
  suppressResults?: boolean;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  dataTour?: string;
  recents?: readonly RecentSearch[];
  onQueryChange: (value: string) => void;
  onSelect: (facility: Facility) => void;
  onSelectRecent?: (recent: RecentSearch) => void;
  onClearRecents?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

export function FacilitySearchCombobox({
  id,
  label,
  query,
  optionsQuery = query,
  options,
  selectedFacilityId,
  loading = false,
  unavailable = false,
  unavailableMessage = "Search suggestions are temporarily unavailable.",
  suppressResults = false,
  placeholder,
  className,
  inputClassName,
  dataTour,
  recents = [],
  onQueryChange,
  onSelect,
  onSelectRecent,
  onClearRecents,
  onFocusChange,
}: FacilitySearchComboboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replace(/:/g, "")}-listbox`;
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const {
    showRecents,
    renderFacilityOptions,
    renderedCount,
    showStatus,
    shouldRenderListbox,
  } = getFacilityComboboxRenderState({
    query,
    optionsQuery,
    optionCount: options.length,
    recentCount: recents.length,
    focused,
    open,
    loading,
    unavailable,
    suppressResults,
  });
  const activeOptionId =
    highlightedIndex >= 0 && highlightedIndex < renderedCount
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  useEffect(() => {
    setHighlightedIndex((current) =>
      current >= renderedCount ? renderedCount - 1 : current,
    );
  }, [renderedCount]);

  useEffect(() => {
    if (!suppressResults) return;
    setOpen(false);
    setHighlightedIndex(-1);
  }, [suppressResults]);

  useEffect(() => {
    if (!focused) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || wrapperRef.current?.contains(target)) return;
      setOpen(false);
      setFocused(false);
      setHighlightedIndex(-1);
      onFocusChange?.(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [focused, onFocusChange]);

  const selectIndex = (index: number) => {
    if (showRecents) {
      const recent = recents[index];
      if (recent) onSelectRecent?.(recent);
    } else {
      const option = options[index];
      if (option) onSelect(option.facility);
    }
    setOpen(false);
    setFocused(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
    onFocusChange?.(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suppressResults) return;

    const supportedKeys = ["ArrowDown", "ArrowUp", "Enter", "Escape"] as const;
    if (!supportedKeys.includes(event.key as (typeof supportedKeys)[number])) return;

    const action = getFacilityComboboxKeyAction(
      event.key,
      highlightedIndex,
      renderedCount,
    );
    if (action.preventDefault) event.preventDefault();
    if (action.open !== null) setOpen(action.open);
    setHighlightedIndex(action.highlightedIndex);
    if (action.selectIndex !== null) selectIndex(action.selectIndex);
  };

  const statusText = useMemo(() => {
    if (loading) return "Loading places...";
    if (unavailable) return unavailableMessage;
    return (
      <>
        No places match &apos;{trimmedQuery}&apos; &mdash; try a building code
        like DSTAT
      </>
    );
  }, [loading, trimmedQuery, unavailable, unavailableMessage]);

  return (
    <div className={cn("relative group", className)} ref={wrapperRef}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        placeholder={placeholder}
        data-tour={dataTour}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shouldRenderListbox}
        aria-controls={shouldRenderListbox ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        className={cn(
          "w-full rounded-full border border-input bg-muted/50 pl-9 pr-4 py-2 text-sm shadow-sm transition-all focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          inputClassName,
        )}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(!suppressResults);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(!suppressResults);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
              setFocused(false);
              setOpen(false);
              setHighlightedIndex(-1);
              onFocusChange?.(false);
            }
          }, 0);
        }}
        onKeyDown={handleKeyDown}
      />

      {shouldRenderListbox && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[1400] overflow-hidden rounded-xl border border-border/70 bg-background/95 py-1 shadow-xl backdrop-blur-md"
        >
          {showRecents && onClearRecents && (
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </span>
              <button
                type="button"
                tabIndex={-1}
                className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClearRecents}
              >
                Clear history
              </button>
            </div>
          )}

          <div id={listboxId} role="listbox">
            {showRecents
              ? recents.map((recent, index) => (
                <button
                  key={recent.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={selectedFacilityId === recent.id}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    highlightedIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/70",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectIndex(index)}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {recent.name}
                  </span>
                </button>
                ))
              : renderFacilityOptions
                ? options.map((option, index) => (
                <button
                  key={option.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={selectedFacilityId === option.facility.id}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    highlightedIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/70",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectIndex(index)}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: option.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {option.primary}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.secondary}
                    </span>
                  </span>
                </button>
                  ))
                : null}

            {showStatus && (
              <div className="px-3 py-3 text-sm text-muted-foreground" role="status">
                {statusText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
