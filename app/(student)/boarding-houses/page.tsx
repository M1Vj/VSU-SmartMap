"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ChevronDown,
  LayoutGrid,
  List,
  LocateFixed,
  LogIn,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { BoardingHouseCard } from "@/components/boarding-houses/boarding-house-card";
import { BoardingHouseFiltersPanel } from "@/components/boarding-houses/boarding-house-filters";
import {
  BOARDING_HOUSE_DEFAULT_FILTERS,
  sortBoardingHouseResults,
  filterBoardingHouses,
  type BoardingHouseSortOption,
} from "@/lib/boarding-houses/filters";
import {
  getCachedBoardingHouses,
  setCachedBoardingHouses,
} from "@/lib/cache/boarding-houses-cache";
import type {
  BoardingHouseFilters,
  BoardingHouseSummary,
} from "@/lib/boarding-houses/types";
import {
  getPublicBoardingHouseSummaries,
  keepPublicBoardingHouses,
} from "@/lib/boarding-houses/public-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VSU_MAIN_GATE } from "@/lib/constants/map";
import { getWalkEstimate, type WalkEstimate } from "@/lib/boarding-houses/route-distance";
import { cn } from "@/lib/utils";

const ReferenceDistancePicker = dynamic(
  () => import("@/components/boarding-houses/reference-distance-picker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-xl border bg-muted" />
    ),
  },
);

const MAX_LISTINGS = 60;
const VIEW_MODE_STORAGE_KEY = "boarding-houses-view-mode";

export default function BoardingHousesPage() {
  const [listings, setListings] = useState<BoardingHouseSummary[]>([]);
  const [filters, setFilters] = useState<BoardingHouseFilters>({
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reference, setReference] = useState<{ lat: number; lng: number }>({
    lat: VSU_MAIN_GATE.lat,
    lng: VSU_MAIN_GATE.lng,
  });
  const [isCustomReference, setIsCustomReference] = useState(false);
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sortOption, setSortOption] =
    useState<BoardingHouseSortOption>("nearest");
  const [viewMode, setViewMode] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [maxWalkMinutes, setMaxWalkMinutes] = useState<number | null>(null);
  const [estimates, setEstimates] = useState<Map<string, WalkEstimate>>(new Map());
  const [routesLoading, setRoutesLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const referenceLabel = isCustomReference ? "Your spot" : "Campus gate";

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const handleReferenceChange = useCallback(
    (point: { lat: number; lng: number }) => {
      setReference(point);
      setIsCustomReference(true);
      setEstimates(new Map());
    },
    [],
  );

  // Keyboard-accessible alternative to dragging the pin: jump the reference to
  // the device's real location (the most useful "distance from me" anchor).
  const useMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleReferenceChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. Drag the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 },
    );
  }, [handleReferenceChange]);

  // Normalize the minutes ceiling: negatives, zero, NaN and decimals would
  // otherwise silently empty the grid (every walk time is >= 1).
  const handleMaxMinutesChange = useCallback((value: number | null) => {
    setMaxWalkMinutes(
      value != null && Number.isFinite(value) && value > 0
        ? Math.round(value)
        : null,
    );
  }, []);

  const resetReference = useCallback(() => {
    setReference({ lat: VSU_MAIN_GATE.lat, lng: VSU_MAIN_GATE.lng });
    setIsCustomReference(false);
    setEstimates(new Map());
  }, []);

  const resetAll = useCallback(() => {
    setFilters({ ...BOARDING_HOUSE_DEFAULT_FILTERS });
    setMaxWalkMinutes(null);
    setSortOption("nearest");
    resetReference();
  }, [resetReference]);

  useEffect(() => {
    if (localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "compact") {
      setViewMode("compact");
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const cached = await getCachedBoardingHouses();
      if (!ignore && cached?.length) {
        setListings(keepPublicBoardingHouses(cached).slice(0, MAX_LISTINGS));
        setIsLoading(false);
      }

      try {
        const data = await getPublicBoardingHouseSummaries();
        if (ignore) return;

        const visible = keepPublicBoardingHouses(data).slice(0, MAX_LISTINGS);
        setListings(visible);
        setError(null);
        void setCachedBoardingHouses(data);
      } catch {
        if (ignore) return;
        // Keep any cached listings visible on outage; only block the page with
        // an error when there is nothing usable to show.
        if (!cached?.length) {
          setError(
            "Unable to load boarding houses right now. Please try again.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const filteredListings = useMemo(
    () => filterBoardingHouses(listings, filters),
    [filters, listings],
  );

  // Resolve real walking routes (reference -> each listing) using the same live
  // router as map navigation, with bounded concurrency and progressive updates.
  // Cached per coordinate pair, so a filter change or returning to a reference
  // is instant; offline/provider failure degrades to a straight-line estimate.
  useEffect(() => {
    if (filteredListings.length === 0) {
      setRoutesLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const from = reference;
    const targets = filteredListings.map((listing) => ({
      id: listing.id,
      coordinates: listing.coordinates,
    }));

    // Debounce so typing in the filters (which re-keys filteredListings) does not
    // fire a routing sweep per keystroke. Concurrency + request spacing are
    // handled by the shared scheduler in route-distance; cleanup aborts the
    // in-flight fetches so superseded runs release the rate budget.
    const debounce = setTimeout(() => {
      setRoutesLoading(true);
      void Promise.all(
        targets.map(async (target) => {
          const estimate = await getWalkEstimate(from, target.coordinates, controller.signal);
          if (cancelled) return;
          setEstimates((prev) => {
            const next = new Map(prev);
            next.set(target.id, estimate);
            return next;
          });
        }),
      ).finally(() => {
        if (!cancelled) setRoutesLoading(false);
      });
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(debounce);
    };
    // `reference` re-keys on every move; `filteredListings` is the candidate set.
  }, [reference, filteredListings]);

  const listingsWithDistance = useMemo(() => {
    const withMetrics = filteredListings.map((listing) => {
      const estimate = estimates.get(listing.id) ?? null;
      return {
        listing,
        estimate,
        meters: estimate ? estimate.meters : null,
        minutes: estimate ? estimate.minutes : null,
      };
    });
    // Keep not-yet-resolved listings visible; only drop ones we know exceed the
    // ceiling so the grid does not flicker while routes resolve.
    const limited =
      maxWalkMinutes != null
        ? withMetrics.filter(
            (entry) => entry.minutes == null || entry.minutes <= maxWalkMinutes,
          )
        : withMetrics;
    return sortBoardingHouseResults(limited, sortOption);
  }, [filteredListings, estimates, sortOption, maxWalkMinutes]);

  const mapListings = useMemo(
    () =>
      filteredListings.map((listing) => ({
        id: listing.id,
        lat: listing.coordinates.lat,
        lng: listing.coordinates.lng,
      })),
    [filteredListings],
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container mx-auto px-4 py-6 pb-28 md:px-6 md:pb-8">
        <header className="mb-6 overflow-hidden rounded-3xl border bg-card p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified listing means identity and listing authority were reviewed
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
                Compare boarding houses near VSU
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Filter by rent, available slots, room type, utilities, Wi-Fi, curfew,
                and walking time. Own a boarding house? Sign in as an owner to list and manage it.
              </p>
            </div>
            <Button asChild className="w-full rounded-full sm:w-auto">
              <Link href="/owner/login">
                <LogIn className="mr-2 h-4 w-4" />
                Boarding house owner login
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between rounded-full lg:hidden"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="boarding-house-filters"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                {filtersOpen ? "Hide filters" : "Show filters"}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")}
                aria-hidden
              />
            </Button>
            <div
              id="boarding-house-filters"
              className={cn(filtersOpen ? "block" : "hidden", "lg:block")}
            >
              <BoardingHouseFiltersPanel
                value={filters}
                onChange={setFilters}
                onReset={resetAll}
                walking={{
                  referenceLabel,
                  maxMinutes: maxWalkMinutes,
                  onMaxMinutesChange: handleMaxMinutesChange,
                  onEditReference: () => setReferenceDialogOpen(true),
                }}
              />
            </div>
          </div>

          <section aria-label="Boarding house results" className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading listings..."
                  : `${listingsWithDistance.length} of ${listings.length} listing(s) shown`}
                {!isLoading && routesLoading && (
                  <span className="ml-1 text-xs">· calculating walking times…</span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                {!isLoading && (
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => {
                      if (value !== "comfortable" && value !== "compact") return;
                      setViewMode(value);
                      localStorage.setItem(VIEW_MODE_STORAGE_KEY, value);
                    }}
                    className="rounded-full border bg-background p-0.5"
                    aria-label="Listing view density"
                  >
                    <ToggleGroupItem
                      value="comfortable"
                      aria-label="Comfortable card view"
                      className="h-8 w-8 rounded-full p-0"
                    >
                      <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="compact"
                      aria-label="Compact list view"
                      className="h-8 w-8 rounded-full p-0"
                    >
                      <List className="h-4 w-4" aria-hidden="true" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
                {!isLoading && (
                  <Select
                    value={sortOption}
                    onValueChange={(value) =>
                      setSortOption(value as BoardingHouseSortOption)
                    }
                  >
                    <SelectTrigger
                      aria-label="Sort boarding houses"
                      className="h-9 w-[190px] rounded-full bg-background"
                    >
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nearest">Nearest</SelectItem>
                      <SelectItem value="price_asc">Price: low to high</SelectItem>
                      <SelectItem value="price_desc">Price: high to low</SelectItem>
                      <SelectItem value="top_rated">Top rated</SelectItem>
                      <SelectItem value="recently_updated">
                        Recently updated
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <p className="hidden text-xs text-muted-foreground lg:block">
                  Prices are owner-listed. Check the last price update before contacting.
                </p>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={retry}
                >
                  Try again
                </Button>
              </div>
            ) : isLoading ? (
              <BoardingHouseGridSkeleton />
            ) : listingsWithDistance.length > 0 ? (
              <div
                className={
                  viewMode === "compact"
                    ? "grid gap-2 xl:grid-cols-2"
                    : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                }
              >
                {listingsWithDistance.map(({ listing, estimate }) => (
                  <BoardingHouseCard
                    key={listing.id}
                    listing={listing}
                    walk={estimate}
                    pending={routesLoading && !estimate}
                    referenceLabel={referenceLabel.toLowerCase()}
                    variant={viewMode}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <h2 className="text-lg font-semibold">
                  No boarding houses match your filters
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try widening the budget, slots, amenities, or walking-time filters.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={referenceDialogOpen} onOpenChange={setReferenceDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reference point</DialogTitle>
            <DialogDescription>
              Tap the map — or use your location — to set where walking times are
              measured from. Blue is your point; green dots are boarding houses.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              loading={locating}
              onClick={useMyLocation}
            >
              <LocateFixed />
              Use my location
            </Button>
          </div>
          {referenceDialogOpen && (
            <ReferenceDistancePicker
              reference={reference}
              onReferenceChange={handleReferenceChange}
              listings={mapListings}
            />
          )}
          <DialogFooter className="sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetReference}
              disabled={!isCustomReference}
            >
              Reset to campus gate
            </Button>
            <Button type="button" size="sm" onClick={() => setReferenceDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoardingHouseGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-card">
          <div className="h-40 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-8 animate-pulse rounded bg-muted" />
              <div className="h-8 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
