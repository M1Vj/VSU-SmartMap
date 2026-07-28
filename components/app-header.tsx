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
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FacilitySearchCombobox } from "@/components/facility/facility-search-combobox";
import { useFacilitySearchData } from "@/components/facility/use-facility-search-data";
import { buildFacilitySearchOptions } from "@/lib/map/facility-search-model";
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
  const [tbaDialogOpen, setTbaDialogOpen] = useState(false);

  const trimmedSuggestionQuery = debouncedQuery.trim();
  const {
    facilities: facilityOptions,
    rooms: roomOptions,
    loading: facilitySearchLoading,
    error: facilitySearchError,
    ensureFacilitiesLoaded,
  } = useFacilitySearchData({
    enabled:
      isFacilitySearchPage &&
      (searchFocused || trimmedSuggestionQuery.length > 0),
    query: trimmedSuggestionQuery,
  });
  const isTbaQuery = isTbaSearchQuery(searchQuery);
  const facilitySearchOptions = useMemo(
    () =>
      buildFacilitySearchOptions({
        facilities: facilityOptions,
        query: trimmedSuggestionQuery,
        rooms: roomOptions,
      }).map((option) => ({
        ...option,
        secondary: option.secondary.replaceAll(" · ", " - "),
      })),
    [facilityOptions, roomOptions, trimmedSuggestionQuery],
  );

  useEffect(() => {
    setEventsQuery(eventsQueryParam);
  }, [eventsQueryParam]);

  useEffect(() => {
    setRecentSearches(readRecentSearches(
      typeof window === "undefined" ? null : window.localStorage,
    ));
  }, []);

  useEffect(() => {
    if (!isFacilitySearchPage) return;

    const delay = getTbaSearchDialogDelay(searchQuery);
    if (delay === null) return;

    document.getElementById("map-facility-search")?.blur();

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
  }, []);

  const chooseFacility = useCallback((facility: Facility) => {
    if (!selectedCategories.includes(facility.category)) {
      setCategories([...selectedCategories, facility.category]);
    }

    selectFacility(facility);
    setSearchQuery(facility.name);
    pushRecentSearch(facility);
    setSearchFocused(false);
  }, [pushRecentSearch, selectFacility, selectedCategories, setCategories, setSearchQuery]);

  const chooseRecentSearch = useCallback(async (recent: RecentSearch) => {
    const existingFacility = facilityOptions.find((facility) => facility.id === recent.id);
    if (existingFacility) {
      chooseFacility(existingFacility);
      return;
    }

    const facilities = await ensureFacilitiesLoaded();
    const loadedFacility = facilities.find((facility) => facility.id === recent.id);
    if (loadedFacility) {
      chooseFacility(loadedFacility);
    }
  }, [chooseFacility, ensureFacilitiesLoaded, facilityOptions]);

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
              <FacilitySearchCombobox
                id="map-facility-search"
                label="Search buildings or facilities"
                query={searchQuery}
                options={facilitySearchOptions}
                loading={facilitySearchLoading}
                unavailable={Boolean(facilitySearchError)}
                placeholder="Search buildings or facilities..."
                dataTour="map-search"
                recents={recentSearches}
                onQueryChange={setSearchQuery}
                onSelect={chooseFacility}
                onSelectRecent={(recent) => void chooseRecentSearch(recent)}
                onClearRecents={handleClearRecentSearches}
                onFocusChange={setSearchFocused}
                inputClassName={cn(
                  isMapPage && "bg-background/95 shadow-lg backdrop-blur-md",
                )}
              />
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
