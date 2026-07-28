"use client";

import Link from "next/link";
import Image from "next/image";
import { SettingsDropdown } from "@/components/layout/settings-dropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/context/app-context";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFacilitySearchData } from "@/components/facility/use-facility-search-data";
import { getCategoryMeta } from "@/lib/constants/facilities";
import { getSearchSuggestions } from "@/lib/map/search-suggestions";
import {
  getTbaSearchDialogDelay,
  isTbaSearchQuery,
} from "@/lib/map/tba-search";
import {
  clearRecentSearches,
  pushRecentSearch as pushStoredRecentSearch,
  readRecentSearches,
  type RecentSearch,
} from "@/lib/map/recent-searches";
import type { Facility } from "@/lib/types/facility";

type AppHeaderProps = {
  tabsSlot?: ReactNode;
};

export function AppHeader({ tabsSlot }: AppHeaderProps) {
  const {
    searchQuery,
    debouncedQuery,
    selectedCategories,
    selectFacility,
    setCategories,
    setSearchQuery,
  } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEventsPage = pathname === "/events";
  const isMapPage = pathname === "/";
  const isDirectoryPage = pathname === "/directory";
  const isFacilitySearchPage = isMapPage || isDirectoryPage;
  const hideSearch =
    pathname === "/info" ||
    pathname === "/chat" ||
    pathname === "/boarding-houses" ||
    (!isFacilitySearchPage && !isEventsPage);
  const hidePrimaryNavigation = pathname === "/info";
  const mapFloatingSurface =
    "border border-border/70 bg-background/95 shadow-lg backdrop-blur-md";
  const mapMenuSurface =
    "border border-border/70 bg-background/95 shadow-lg backdrop-blur-md";

  const eventsQueryParam = searchParams.get("q") ?? "";
  const [eventsQuery, setEventsQuery] = useState(eventsQueryParam);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tbaDialogOpen, setTbaDialogOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const trimmedSuggestionQuery = debouncedQuery.trim();
  const {
    facilities: facilityOptions,
    rooms: roomOptions,
  } = useFacilitySearchData({
    enabled:
      isFacilitySearchPage &&
      (searchFocused || trimmedSuggestionQuery.length > 0),
    query: trimmedSuggestionQuery,
  });
  const isTbaQuery = isTbaSearchQuery(searchQuery);
  const suggestions = useMemo(
    () =>
      getSearchSuggestions({
        facilities: facilityOptions,
        query: trimmedSuggestionQuery,
        rooms: roomOptions,
      }),
    [facilityOptions, roomOptions, trimmedSuggestionQuery],
  );
  const showRecentSearches =
    isFacilitySearchPage &&
    searchFocused &&
    searchQuery.trim().length === 0 &&
    recentSearches.length > 0;
  const showNoMatches =
    isFacilitySearchPage &&
    !isTbaQuery &&
    searchFocused &&
    trimmedSuggestionQuery.length > 0 &&
    suggestions.length === 0;
  const optionCount = showRecentSearches ? recentSearches.length : suggestions.length;
  const activeOptionId =
    highlightedIndex >= 0 && highlightedIndex < optionCount
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;
  const shouldRenderFacilityDropdown =
    isFacilitySearchPage &&
    !isTbaQuery &&
    searchFocused &&
    dropdownOpen &&
    (showRecentSearches || trimmedSuggestionQuery.length > 0);

  useEffect(() => {
    setEventsQuery(eventsQueryParam);
  }, [eventsQueryParam]);

  useEffect(() => {
    setRecentSearches(readRecentSearches(
      typeof window === "undefined" ? null : window.localStorage,
    ));
  }, []);

  useEffect(() => {
    if (!searchFocused) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || searchWrapperRef.current?.contains(target)) return;
      setDropdownOpen(false);
      setSearchFocused(false);
      setHighlightedIndex(-1);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchFocused]);

  useEffect(() => {
    setHighlightedIndex(-1);
    setDropdownOpen(true);
  }, [searchQuery, suggestions.length, recentSearches.length]);

  useEffect(() => {
    if (!isFacilitySearchPage) return;

    const delay = getTbaSearchDialogDelay(searchQuery);
    if (delay === null) return;

    setDropdownOpen(false);
    setHighlightedIndex(-1);

    const timer = window.setTimeout(() => {
      setTbaDialogOpen(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isFacilitySearchPage, searchQuery]);

  const pushRecentSearch = useCallback((facility: Facility) => {
    setRecentSearches(
      pushStoredRecentSearch(
        typeof window === "undefined" ? null : window.localStorage,
        { id: facility.id, name: facility.name },
        recentSearches,
      ),
    );
  }, [recentSearches]);

  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches(typeof window === "undefined" ? null : window.localStorage);
    setRecentSearches([]);
    setHighlightedIndex(-1);
  }, []);

  const chooseFacility = useCallback((facility: Facility) => {
    if (!selectedCategories.includes(facility.category)) {
      setCategories([...selectedCategories, facility.category]);
    }

    selectFacility(facility);
    setSearchQuery(facility.name);
    pushRecentSearch(facility);
    setDropdownOpen(false);
    setSearchFocused(false);
    setHighlightedIndex(-1);
    searchInputRef.current?.blur();
  }, [pushRecentSearch, selectFacility, selectedCategories, setCategories, setSearchQuery]);

  const chooseRecentSearch = useCallback((recent: RecentSearch) => {
    const existingFacility = facilityOptions.find((facility) => facility.id === recent.id);
    if (existingFacility) {
      chooseFacility(existingFacility);
    }
  }, [chooseFacility, facilityOptions]);

  const handleFacilitySearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isFacilitySearchPage) return;

    if (event.key === "ArrowDown") {
      if (optionCount === 0) return;
      event.preventDefault();
      setDropdownOpen(true);
      setHighlightedIndex((current) => (current + 1) % optionCount);
      return;
    }

    if (event.key === "ArrowUp") {
      if (optionCount === 0) return;
      event.preventDefault();
      setDropdownOpen(true);
      setHighlightedIndex((current) => (current <= 0 ? optionCount - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && optionCount > 0) {
      event.preventDefault();
      const chosenIndex =
        highlightedIndex >= 0 && highlightedIndex < optionCount ? highlightedIndex : 0;
      if (showRecentSearches) {
        void chooseRecentSearch(recentSearches[chosenIndex]);
      } else {
        chooseFacility(suggestions[chosenIndex].facility);
      }
      return;
    }

    if (event.key === "Escape") {
      setDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleEventsSearchSubmit = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    const trimmed = eventsQuery.trim();

    if (trimmed) params.set("q", trimmed);
    else params.delete("q");

    const qs = params.toString();
    router.push(qs ? `/events?${qs}` : "/events");
  };

  return (
    <>
      <header
        className={cn(
          "top-0",
          isMapPage
            ? "fixed inset-x-0 z-[1200] border-transparent bg-transparent"
            : "sticky z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
        )}
      >
        <div className="flex h-16 items-center px-4 md:px-6 gap-4">
          {/* Logo Area */}
          <Link
            href="/"
            className={cn(
              "flex shrink-0 items-center gap-2 transition hover:opacity-80",
              isMapPage && "drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
            )}
            aria-label="Campus SmartMap for VSU home"
          >
            <Image
              src="/icons/icon-192x192.png?v=20260709"
              alt="Campus SmartMap for VSU"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
              unoptimized
              priority
            />
            <div className="flex flex-col leading-none hidden sm:flex">
              <span
                className={cn(
                  "text-xs font-bold text-primary tracking-wide",
                  isMapPage && "[text-shadow:0_1px_4px_rgba(0,0,0,0.55)]",
                )}
              >
                Campus
              </span>
              <span
                className={cn(
                  "text-sm font-extrabold text-foreground tracking-tight",
                  isMapPage && "text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.75)]",
                )}
              >
                SmartMap
              </span>
            </div>
          </Link>

          {/* Search Bar - Centered/Leftish */}
          <div
            className={cn(
              hideSearch ? "flex-1" : "flex-1 max-w-md",
              !hideSearch && (isMapPage ? "ml-0" : "ml-2 md:ml-8"),
            )}
          >
            {!hideSearch && (isEventsPage ? (
              <form onSubmit={handleEventsSearchSubmit} className="relative group">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="search"
                  placeholder="Search events..."
                  aria-label="Search events"
                  className={cn(
                    "w-full rounded-full border border-input bg-muted/50 pl-9 pr-4 py-2 text-sm shadow-sm transition-all focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isMapPage && "bg-background/95 shadow-lg backdrop-blur-md",
                  )}
                  value={eventsQuery}
                  onChange={(e) => setEventsQuery(e.target.value)}
                />
              </form>
            ) : (
              <div className="relative group" ref={searchWrapperRef}>
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search buildings or facilities..."
                  data-tour="map-search"
                  aria-label="Search buildings or facilities"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={shouldRenderFacilityDropdown}
                  aria-controls={shouldRenderFacilityDropdown ? listboxId : undefined}
                  aria-activedescendant={activeOptionId}
                  className={cn(
                    "w-full rounded-full border border-input bg-muted/50 pl-9 pr-4 py-2 text-sm shadow-sm transition-all focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isMapPage && "bg-background/95 shadow-lg backdrop-blur-md",
                  )}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setSearchFocused(true);
                    setDropdownOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (!searchWrapperRef.current?.contains(document.activeElement)) {
                        setSearchFocused(false);
                        setDropdownOpen(false);
                        setHighlightedIndex(-1);
                      }
                    }, 0);
                  }}
                  onKeyDown={handleFacilitySearchKeyDown}
                />
                {shouldRenderFacilityDropdown && (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[1400] overflow-hidden rounded-xl border border-border/70 bg-background/95 py-1 shadow-xl backdrop-blur-md"
                  >
                    {showRecentSearches && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Recent
                        </span>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={handleClearRecentSearches}
                        >
                          Clear history
                        </button>
                      </div>
                    )}

                    {showRecentSearches
                      ? recentSearches.map((recent, index) => (
                          <button
                            key={recent.id}
                            id={`${listboxId}-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={highlightedIndex === index}
                            className={cn(
                              "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                              highlightedIndex === index
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/70",
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void chooseRecentSearch(recent)}
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                            <span className="min-w-0 flex-1 truncate font-medium">{recent.name}</span>
                          </button>
                        ))
                      : suggestions.map((suggestion, index) => {
                          const meta = getCategoryMeta(suggestion.facility.category);
                          const subtext = [
                            suggestion.facility.code,
                            meta.label,
                            suggestion.matchedRoomCode ? `Room ${suggestion.matchedRoomCode}` : null,
                          ].filter(Boolean).join(" - ");

                          return (
                            <button
                              key={suggestion.facility.id}
                              id={`${listboxId}-option-${index}`}
                              type="button"
                              role="option"
                              aria-selected={highlightedIndex === index}
                              className={cn(
                                "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                                highlightedIndex === index
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/70",
                              )}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => chooseFacility(suggestion.facility)}
                            >
                              <span
                                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                                style={{ backgroundColor: meta.color }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {suggestion.facility.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {subtext || meta.label}
                                </span>
                              </span>
                            </button>
                          );
                        })}

                    {showNoMatches && (
                      <div className="px-3 py-3 text-sm text-muted-foreground" role="status">
                        No places match &apos;{trimmedSuggestionQuery}&apos; &mdash; try a building code like DSTAT
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation - Right Side */}
          <div className="flex items-center gap-2 ml-auto">
            {tabsSlot && !hidePrimaryNavigation && (
              <div
                className={cn(
                  "hidden items-center gap-1 md:flex",
                  isMapPage ? `${mapMenuSurface} rounded-full p-0.5` : "mr-2",
                )}
                aria-label="Primary navigation"
              >
                {tabsSlot}
              </div>
            )}

            {!hidePrimaryNavigation && !isMapPage && (
              <div className="h-4 w-[1px] bg-border mx-1 hidden md:block" />
            )}

            <div className={cn(isMapPage && `${mapFloatingSurface} rounded-full`)}>
              <SettingsDropdown />
            </div>
          </div>
        </div>
      </header>

      <Dialog open={tbaDialogOpen} onOpenChange={setTbaDialogOpen}>
        <DialogContent className="mx-4 max-w-md gap-5 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>TBA means To Be Announced</DialogTitle>
            <DialogDescription className="pt-1 leading-6">
              TBA is not a specific campus location yet. Check your class schedule,
              instructor, or department for the final room assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setTbaDialogOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
