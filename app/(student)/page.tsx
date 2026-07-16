"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapContainerClient } from "@/components/map/map-container";
import { MapBottomCard } from "@/components/map/map-bottom-card";
import { MapSearchPanel } from "@/components/map/map-search-panel";
import type { Facility } from "@/lib/types/facility";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import type { BoardingHouseMapItem, MapItem } from "@/lib/types/map";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import { getBoardingHouseSummaries } from "@/lib/supabase/queries/boarding-houses";
import {
  getPublicBoardingHouseSummaries,
  keepPublicBoardingHouses,
} from "@/lib/boarding-houses/public-client";
import { toBoardingHouseMapEntity } from "@/lib/boarding-houses/filters";
import { useApp } from "@/lib/context/app-context";
import { Button } from "@/components/ui/button";
import { Plus, Route, Clock } from "lucide-react";
import { SuggestAddModal } from "@/components/suggestions/suggest-add-modal";
import { getCachedFacilities, setCachedFacilities } from "@/lib/cache/facilities-cache";
import { getCachedBoardingHouses, setCachedBoardingHouses } from "@/lib/cache/boarding-houses-cache";
import { getCachedNavigationGraph, setCachedNavigationGraph } from "@/lib/cache/navigation-cache";
import { searchRooms } from "@/lib/supabase/queries/rooms";
import { getMapNodes, getMapEdges } from "@/lib/supabase/queries/navigation";
import { setCachedRooms } from "@/lib/cache/rooms-cache";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { LatLng, LatLngBoundsExpression } from "leaflet";
import type { TransportMode } from "@/lib/types/graph";
import { ReportRouteDialog } from "@/components/navigation/report-route-dialog";
import { filterGraphToRoutingBoundary } from "@/lib/pathfinding/transition-gates";
import { getRouteBounds } from "@/lib/map/route-bounds";
import { clampPointToVsuCampus } from "@/lib/map/vsu-campus-boundary";
import {
  getNavigationControlsState,
  getNavigationMapBounds,
} from "@/lib/map/navigation-viewport";
import {
  areFacilityMarkerListsEquivalent,
  getVisibleFacilitiesForMapLoad,
} from "@/lib/map/facility-marker-list";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VSU_MAIN_GATE } from "@/lib/constants/map";

const MapSelectionLayer = dynamic(
  () => import("@/components/map/map-selection-layer").then((m) => m.MapSelectionLayer),
  { ssr: false },
);

const UserLocationControl = dynamic(
  () => import("@/components/map/user-location-control").then((m) => m.UserLocationControl),
  { ssr: false },
);

const NavigationLayer = dynamic(
  () => import("@/components/map/navigation-layer").then((m) => m.NavigationLayer),
  { ssr: false },
);

const ManualStartPin = dynamic(
  () => import("@/components/map/manual-start-pin").then((m) => m.ManualStartPin),
  { ssr: false },
);

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 bg-background px-4 py-10 md:px-6">
      <div className="h-[560px] rounded-xl border border-border bg-muted animate-pulse" />
    </main>
  );
}

function HomePageContent() {
  return <MapTab />;
}

function isOfflineCacheSession() {
  return Boolean(
    typeof window !== "undefined" &&
      ((window as typeof window & { __VSU_SMARTMAP_SERVED_FROM_OFFLINE_CACHE__?: boolean })
        .__VSU_SMARTMAP_SERVED_FROM_OFFLINE_CACHE__ ||
        navigator.onLine === false),
  );
}

function MapTab() {
  const searchParams = useSearchParams();
  const {
    selectedFacility,
    selectFacility,
    pendingFacilityId,
    pendingNavigationFacility,
    resolvePendingFacility,
    clearPendingNavigationFacility,
    debouncedQuery,
    selectedCategories,
  } = useApp();
  const [items, setItems] = useState<readonly Facility[]>([]);
  const [filtered, setFiltered] = useState<readonly Facility[]>([]);
  const [boardingHouses, setBoardingHouses] = useState<readonly BoardingHouseSummary[]>([]);
  const [selectedBoardingHouse, setSelectedBoardingHouse] =
    useState<BoardingHouseMapItem | null>(null);
  const [showBoardingHouses, setShowBoardingHouses] = useState(false);
  const [isBoardingLoading, setIsBoardingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: MapNode[]; edges: MapEdge[] }>({ nodes: [], edges: [] });
  const loadFiltersRef = useRef({ debouncedQuery, selectedCategories });
  const requestedBoardingHouseId = searchParams.get("boardingHouse");
  const hasBoardingUrlFlag = searchParams.get("boarding") === "1";

  useEffect(() => {
    const stored = localStorage.getItem("boarding-houses-map-overlay");
    if (hasBoardingUrlFlag || requestedBoardingHouseId) {
      setShowBoardingHouses(true);
      localStorage.setItem("boarding-houses-map-overlay", "true");
      return;
    }

    setShowBoardingHouses(stored === "true");
  }, [hasBoardingUrlFlag, requestedBoardingHouseId]);

  useEffect(() => {
    localStorage.setItem("boarding-houses-map-overlay", String(showBoardingHouses));
  }, [showBoardingHouses]);

  useEffect(() => {
    if (!showBoardingHouses && !requestedBoardingHouseId) {
      setBoardingHouses([]);
      setSelectedBoardingHouse(null);
      return;
    }

    let cancelled = false;
    async function loadBoardingHouses() {
      setIsBoardingLoading(true);
      const cached = await getCachedBoardingHouses();
      // Offline/stale safety: a listing suspended/unverified after caching must
      // not appear on the map, so re-filter the cached list to published+verified.
      const safeCached = cached ? keepPublicBoardingHouses(cached) : [];
      if (!cancelled && safeCached.length) {
        setBoardingHouses(safeCached);
      }

      const data = await getPublicBoardingHouseSummaries();
      if (cancelled) return;

      if (!data) {
        if (!safeCached.length) {
          toast.error("Unable to load boarding house markers.");
          setBoardingHouses([]);
        }
      } else {
        // Also guard the freshly-fetched list in case the API ever returns
        // non-public listings (defense in depth before building markers).
        setBoardingHouses(keepPublicBoardingHouses(data));
        void setCachedBoardingHouses(data);
      }
      setIsBoardingLoading(false);
    }

    void loadBoardingHouses();
    return () => {
      cancelled = true;
    };
  }, [requestedBoardingHouseId, showBoardingHouses]);

  useEffect(() => {
    if (!requestedBoardingHouseId || !boardingHouses.length) return;
    const match = boardingHouses.find((listing) => listing.id === requestedBoardingHouseId);
    if (match) {
      selectFacility(null);
      setSelectedBoardingHouse(toBoardingHouseMapEntity(match));
    }
  }, [boardingHouses, requestedBoardingHouseId, selectFacility]);

  useEffect(() => {
    loadFiltersRef.current = { debouncedQuery, selectedCategories };
  }, [debouncedQuery, selectedCategories]);

  useEffect(() => {
      const applyFacilitySnapshot = (facilities: readonly Facility[]) => {
        const { debouncedQuery: currentQuery, selectedCategories: currentCategories } = loadFiltersRef.current;
        const visibleFacilities = getVisibleFacilitiesForMapLoad(
          facilities,
          currentQuery,
          currentCategories,
        );

        setItems((current) =>
          areFacilityMarkerListsEquivalent(current, facilities) ? current : facilities
        );
        setFiltered((current) =>
          areFacilityMarkerListsEquivalent(current, visibleFacilities) ? current : visibleFacilities
        );
      };

      const load = async () => {
        const cached = await getCachedFacilities();
        const cachedNav = await getCachedNavigationGraph();
        
        if (cached && cached.length > 0) {
          applyFacilitySnapshot(cached);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }

        if (!cached?.length && isOfflineCacheSession()) {
          setError("Map data has not been cached on this device yet. Reconnect once to save the campus map for offline use.");
          setItems([]);
          setFiltered([]);
          setIsLoading(false);
          return;
        }

        const loadNavigation = async () => {
           if (cachedNav) {
             setGraphData(filterGraphToRoutingBoundary(cachedNav.nodes, cachedNav.edges));
           }
           
           try {
             const [nodesRes, edgesRes] = await Promise.all([
               getMapNodes(),
               getMapEdges()
             ]);
             
             if (nodesRes.data && edgesRes.data) {
               setGraphData(filterGraphToRoutingBoundary(nodesRes.data, edgesRes.data));
               await setCachedNavigationGraph(nodesRes.data, edgesRes.data);
             }
           } catch (e) {
             console.warn("Failed to sync navigation graph", e);
           }
        };

        // Pre-fetch rooms for search indexing/offline use
      // This is done in the background to avoid blocking facility loading
      const loadRooms = async () => {
        try {
          const { data: roomData } = await searchRooms({ term: "", includeFacility: true });
          if (roomData) {
            setCachedRooms(roomData);
          }
        } catch (e) {
          console.warn("Failed to pre-fetch rooms for offline cache", e);
        }
      };

        const fetchFacilities = async (fallbackCache: Facility[] | null) => {
        const { data, error: fetchError } = await getFacilitiesLite();

        if (fetchError || !data) {
          if (fallbackCache && fallbackCache.length > 0) {
            setError(null);
          } else {
            setError("Unable to load map data. Please try again later.");
            setItems([]);
            setFiltered([]);
          }
          setIsLoading(false);
          return;
        }

        // Cast Lite objects to Facility for now since coordinates/etc match.
        // The components will need to handle missing descriptions if they try to access them.
        // We'll fix the cache logic to handle Lite objects in a moment or cast it.
        setCachedFacilities(data as unknown as Facility[]);
        applyFacilitySnapshot(data as unknown as Facility[]);
        setError(null);
        setIsLoading(false);
      };

      void Promise.all([fetchFacilities(cached), loadRooms(), loadNavigation()]);
    };

    void load();
  }, []);

  useEffect(() => {
    if (!items.length || !pendingFacilityId) return;
    if (selectedFacility?.id === pendingFacilityId) return;

    const match = items.find((facility) => facility.id === pendingFacilityId);
    if (match) {
      resolvePendingFacility(match);
    }
  }, [items, pendingFacilityId, selectedFacility, resolvePendingFacility]);

  // The map overlay is a simple on/off toggle (detailed price/amenity filtering
  // lives on the listings page). boardingHouses is already restricted to
  // published+verified; memoize the entity mapping so MapMarker's icon
  // memoization is not defeated by fresh object identities each render.
  const boardingHouseEntities = useMemo(
    () => boardingHouses.map((listing) => toBoardingHouseMapEntity(listing)),
    [boardingHouses],
  );

  return (
    <section
      id="map-panel"
      role="tabpanel"
      aria-label="Map panel"
      className="relative flex h-full w-full flex-col overflow-hidden bg-background"
      tabIndex={0}
    >
      <div className="relative flex-1 w-full overflow-hidden">
        <div className="absolute right-4 top-[4.5rem] z-[1000]">
          <div className="flex flex-col items-end gap-2">
            <MapSearchPanel
              items={items}
              onResultsChange={(results) => setFiltered(results as Facility[])}
              showBoardingHouses={showBoardingHouses}
              onToggleBoardingHouses={(next) => setShowBoardingHouses(next)}
              boardingHousesLoading={isBoardingLoading}
            />
          </div>
        </div>

        {/* Floating Action Button (Submit) */}
        {/* Adjusted bottom position to clear mobile tabs (approx 4rem/64px + 1rem buffer = bottom-20 or bottom-24) */}
        {/* Desktop remains bottom-8 */}
        <div className="absolute right-6 bottom-24 z-30 md:right-8 md:bottom-8">
          <Button
            type="button"
            size="default"
            className="gap-2 rounded-full font-semibold shadow-lg ring-1 ring-black/5"
            onClick={() => setSuggestOpen(true)}
            title="Submit a location"
            data-tour="map-submit"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden md:inline">Submit Location</span>
            <span className="md:hidden sr-only">Submit Location</span>
          </Button>
        </div>

        <MapView
          filtered={
            showBoardingHouses ? [...filtered, ...boardingHouseEntities] : filtered
          }
          isLoading={isLoading}
          error={error}
          selectedId={selectedBoardingHouse?.id ?? selectedFacility?.id ?? null}
          selectedFacility={selectedFacility} // Pass selectedFacility
          selectedBoardingHouse={selectedBoardingHouse}
          onSelect={(id) => {
            const boardingHouse = boardingHouses.find((listing) => listing.id === id);
            if (boardingHouse) {
              selectFacility(null);
              setSelectedBoardingHouse(toBoardingHouseMapEntity(boardingHouse));
              return;
            }

            const facility = items.find((f) => f.id === id) || null;
            setSelectedBoardingHouse(null);
            selectFacility(facility);
          }}
          onClearSelection={() => {
            setSelectedBoardingHouse(null);
            selectFacility(null);
          }}
          graphData={graphData}
          pendingNavigationFacility={pendingNavigationFacility}
          onPendingNavigationConsumed={clearPendingNavigationFacility}
        />
      </div>

      <SuggestAddModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onSuccess={() => setSuggestOpen(false)}
      />
    </section>
  );
}

import { useNavigationPersistence } from "@/hooks/use-navigation-persistence";
import type { MapNode, MapEdge, PathResult } from "@/lib/types/graph";
import {
  createManualStartPoint,
  resolveNavigationStart,
  type NavigationPoint,
} from "@/lib/navigation/manual-start";
import { shouldConsumeFacilityNavigationRequest } from "@/lib/navigation/facility-navigation";
import {
  shouldClearRouteForMapSearch,
  shouldClearRouteForSelectedItem,
} from "@/lib/navigation/selection-route-reset";

type NavigationOrigin = "live" | "manual" | null;

function MapView({
  filtered,
  isLoading,
  error,
  selectedId,
  selectedFacility, // Receive selectedFacility prop
  selectedBoardingHouse,
  onSelect,
  onClearSelection,
  graphData,
  pendingNavigationFacility,
  onPendingNavigationConsumed,
}: {
  filtered: readonly MapItem[];
  isLoading: boolean;
  error: string | null;
  selectedId: string | null;
  selectedFacility: Facility | null; 
  selectedBoardingHouse: BoardingHouseMapItem | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  graphData: { nodes: MapNode[], edges: MapEdge[] };
  pendingNavigationFacility: Facility | null;
  onPendingNavigationConsumed: () => void;
}) {
  const {
    selectedCategories,
    debouncedQuery,
    defaultTransportMode,
    setFacilitySheetOpen,
  } = useApp();
  const hasResults = filtered.length > 0;
  const hasActiveFilters = selectedCategories.length > 0 || debouncedQuery.trim().length > 0;
  
  const geo = useGeolocation();
  const { position, error: locationError, startTracking } = geo;
  
  const [targetFacilityId, setTargetFacilityId] = useState<string | undefined>(undefined);
  
  // Use persistent navigation state
  const { navStart, setNavStart, navEnd, setNavEnd, clearNavigation } = useNavigationPersistence();
  
  const [navMode, setNavMode] = useState<TransportMode>('walking');
  const [mapBounds, setMapBounds] = useState<LatLngBoundsExpression | null>(null);
  const [navigationOrigin, setNavigationOrigin] = useState<NavigationOrigin>(null);
  const [isManualStartPending, setIsManualStartPending] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<PathResult[]>([]);
  const [routeReportOpen, setRouteReportOpen] = useState(false);
  const [manualLocationRequestPending, setManualLocationRequestPending] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const lastConsumedPendingNavigationId = useRef<string | null>(null);
  const hasActiveRoute = availableRoutes.length > 0 && Boolean(navStart && navEnd);
  const hasNavigationState = Boolean(navStart || navEnd || isManualStartPending || availableRoutes.length);
  const isWaitingForLocation = navigationOrigin === "live" && Boolean(navEnd) && !navStart;
  const navigationControls = getNavigationControlsState({
    hasActiveRoute,
    isManualStartPending,
    isWaitingForLocation,
  });
  const selectedMapItem: MapItem | null =
    selectedBoardingHouse ?? (selectedFacility?.id === selectedId ? selectedFacility : null);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const clearRouteState = useCallback(() => {
    clearNavigation();
    setNavigationOrigin(null);
    setIsManualStartPending(false);
    setManualLocationRequestPending(false);
    setTargetFacilityId(undefined);
    setAvailableRoutes([]);
    setMapBounds(null);
    setRouteReportOpen(false);
  }, [clearNavigation]);

  useEffect(() => {
    setAvailableRoutes([]);
  }, [navEnd?.lat, navEnd?.lng, navMode]);

  useEffect(() => {
    setNavMode(defaultTransportMode);
  }, [defaultTransportMode]);

  useEffect(() => {
    if (navigationOrigin === "live" && position && navEnd) {
      const liveStart = { lat: position.coords.latitude, lng: position.coords.longitude };
      const routeStart = clampPointToVsuCampus(liveStart);

      setNavStart({ lat: routeStart.lat, lng: routeStart.lng } as LatLng);
    }
  }, [position, navigationOrigin, navEnd, setNavStart]);

  useEffect(() => {
    if (!manualLocationRequestPending || !isManualStartPending || !position || !navEnd) return;

    const liveStart = { lat: position.coords.latitude, lng: position.coords.longitude };
    const routeStart = clampPointToVsuCampus(liveStart);

    setNavigationOrigin("live");
    setIsManualStartPending(false);
    setManualLocationRequestPending(false);
    setNavStart({ lat: routeStart.lat, lng: routeStart.lng } as LatLng);
  }, [isManualStartPending, manualLocationRequestPending, navEnd, position, setNavStart]);

  useEffect(() => {
    if (!manualLocationRequestPending || !locationError) return;

    toast.error("Unable to use your location for the route start. You can still tap the map or start from the main gate.");
    setManualLocationRequestPending(false);
  }, [locationError, manualLocationRequestPending]);

  useEffect(() => {
      if (!navStart || !navEnd) {
          setMapBounds(null);
      }
  }, [navStart, navEnd]);

  useEffect(() => {
    if (
      shouldClearRouteForSelectedItem({
        selectedItemId: selectedId,
        routeDestinationId: targetFacilityId ?? null,
        hasNavigationState,
      })
    ) {
      clearRouteState();
    }
  }, [
    clearRouteState,
    hasNavigationState,
    selectedId,
    targetFacilityId,
  ]);

  useEffect(() => {
    if (
      shouldClearRouteForMapSearch({
        searchQuery: debouncedQuery,
        selectedItemName: selectedMapItem?.name ?? null,
        hasNavigationState,
      })
    ) {
      clearRouteState();
    }
  }, [clearRouteState, debouncedQuery, hasNavigationState, selectedMapItem?.name]);

  const handleRoutesFound = useCallback((routes: PathResult[]) => {
    setAvailableRoutes(routes);
    setMapBounds(routes[0] ? getRouteBounds(routes[0].path) : null);
  }, []);

  const beginNavigationToItem = useCallback((item: MapItem) => {
    const decision = resolveNavigationStart(position);

    setTargetFacilityId(item.id);
    setNavEnd({ lat: item.coordinates.lat, lng: item.coordinates.lng } as LatLng);
    setAvailableRoutes([]);

    if (decision.mode === "live") {
      setNavigationOrigin("live");
      setIsManualStartPending(false);
      setNavStart({ lat: decision.start.lat, lng: decision.start.lng } as LatLng);
      return;
    }

    setNavigationOrigin("manual");
    setIsManualStartPending(true);
    setNavStart(null);
  }, [position, setNavEnd, setNavStart]);

  useEffect(() => {
    if (!pendingNavigationFacility) {
      lastConsumedPendingNavigationId.current = null;
      return;
    }

    if (
      !shouldConsumeFacilityNavigationRequest(
        pendingNavigationFacility.id,
        lastConsumedPendingNavigationId.current
      )
    ) {
      return;
    }

    lastConsumedPendingNavigationId.current = pendingNavigationFacility.id;
    beginNavigationToItem(pendingNavigationFacility);
    onPendingNavigationConsumed();
  }, [beginNavigationToItem, onPendingNavigationConsumed, pendingNavigationFacility]);

  const handleManualStartPlacement = useCallback((point: NavigationPoint) => {
    if (!isManualStartPending) return;

    const start = createManualStartPoint(point);
    setNavigationOrigin("manual");
    setIsManualStartPending(false);
    setNavStart({ lat: start.lat, lng: start.lng } as LatLng);
  }, [isManualStartPending, setNavStart]);

  const handleManualStartMarkerTap = useCallback((item: MapItem) => {
    handleManualStartPlacement(item.coordinates);
  }, [handleManualStartPlacement]);

  const handleUseMyLocationStart = useCallback(() => {
    if (!isManualStartPending) return;

    if (position) {
      const liveStart = { lat: position.coords.latitude, lng: position.coords.longitude };
      const routeStart = clampPointToVsuCampus(liveStart);

      setNavigationOrigin("live");
      setIsManualStartPending(false);
      setManualLocationRequestPending(false);
      setNavStart({ lat: routeStart.lat, lng: routeStart.lng } as LatLng);
      return;
    }

    setManualLocationRequestPending(true);
    startTracking();
  }, [isManualStartPending, position, setNavStart, startTracking]);

  const handleUseMainGateStart = useCallback(() => {
    if (!isManualStartPending) return;

    setNavigationOrigin("manual");
    setIsManualStartPending(false);
    setManualLocationRequestPending(false);
    setNavStart({ lat: VSU_MAIN_GATE.lat, lng: VSU_MAIN_GATE.lng } as LatLng);
  }, [isManualStartPending, setNavStart]);

  return (
    <div className="relative h-full w-full">
      <div className="relative h-full w-full overflow-hidden">
        <MapContainerClient className="h-full w-full" bounds={getNavigationMapBounds(mapBounds)}>
          <MapSelectionLayer
            items={filtered}
            selectedId={selectedId}
            routeDestinationId={hasActiveRoute ? targetFacilityId ?? null : null}
            minimizeNonDestinationMarkers={hasActiveRoute}
            onSelect={(item) => onSelect(item.id)}
            onMarkerTapOverride={isManualStartPending ? handleManualStartMarkerTap : undefined}
            onDirections={(item) => beginNavigationToItem(item)}
            onMapClick={isManualStartPending ? handleManualStartPlacement : undefined}
            onClearSelection={() => {
              onClearSelection();
            }}
          />
          {hasHydrated && navigationOrigin === "manual" && navStart && (
            <ManualStartPin
              point={{ lat: navStart.lat, lng: navStart.lng }}
              onChange={(point) => setNavStart({ lat: point.lat, lng: point.lng } as LatLng)}
            />
          )}
          {/* ... */}
          <UserLocationControl 
              destination={navEnd} 
              selectedFacility={
                selectedFacility?.id === selectedId 
                  ? (selectedFacility && 'coordinates' in selectedFacility ? selectedFacility.coordinates : null) 
                  : null
              }
              geo={geo}
          />
          
          {hasHydrated && graphData.nodes.length > 0 && graphData.edges.length > 0 && (
            <NavigationLayer 
              key={`nav-${graphData.nodes.length}-${navStart ? 's' : 'x'}-${navEnd ? 'e' : 'x'}`}
              startPoint={navStart} 
              endPoint={navEnd} 
            destinationId={targetFacilityId}
              mode={navMode} 
              nodes={graphData.nodes}
              edges={graphData.edges}
              waitingForUserLocation={navigationOrigin === "live" && !navStart}
              onRoutesFound={handleRoutesFound}
            />
          )}
        </MapContainerClient>

        {hasHydrated && navEnd && (
          <div className="absolute top-20 left-1/2 z-[1000] flex -translate-x-1/2 flex-col items-center gap-2">
            {navigationControls.statusText && (
              <div
                className="rounded-full border bg-background/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground shadow-lg ring-1 ring-black/5 backdrop-blur"
                role="status"
              >
                {navigationControls.statusText}
              </div>
            )}

            <div className="flex gap-2">
                <Button 
                  variant={hasActiveRoute ? "destructive" : "outline"}
                  size="sm" 
                  className={cn(
                    "rounded-full px-4 text-xs font-semibold uppercase tracking-wider shadow-lg ring-1 ring-black/5",
                    isManualStartPending ? "h-11" : "h-8",
                    !hasActiveRoute && "bg-background/90 backdrop-blur hover:bg-background",
                  )}
                  onClick={clearRouteState}
                  aria-label={`${navigationControls.primaryActionLabel} navigation`}
                >
                  {navigationControls.primaryActionLabel}
                </Button>

                {navigationControls.canReportRoute && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full bg-background/90 px-4 text-xs font-semibold uppercase tracking-wider shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                    onClick={() => setRouteReportOpen(true)}
                  >
                    Report Route
                  </Button>
                )}
            </div>

            {isManualStartPending && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-full bg-background/90 px-4 text-xs font-semibold shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                  onClick={handleUseMyLocationStart}
                  aria-label="Use my location as route start"
                >
                  Use my location
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-full bg-background/90 px-4 text-xs font-semibold shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                  onClick={handleUseMainGateStart}
                  aria-label="Start route from main gate"
                >
                  Start from main gate
                </Button>
              </div>
            )}

            {!isManualStartPending && availableRoutes[0] && (
                <div className="flex animate-in gap-3 rounded-full border bg-background/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-lg ring-1 ring-black/5 backdrop-blur fade-in slide-in-from-top-1">
                    <span className="flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        {availableRoutes[0].totalDistance.toFixed(0)}m
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {availableRoutes[0].estimatedTime} min
                    </span>
                </div>
            )}
          </div>
        )}

        <ReportRouteDialog
          open={routeReportOpen}
          onOpenChange={setRouteReportOpen}
          context={{
            fromText: navigationOrigin === "live" ? "My location" : navigationOrigin === "manual" && navStart ? "Custom start pin" : null,
            toText: selectedBoardingHouse?.name ?? selectedFacility?.name ?? null,
            destinationId: targetFacilityId ?? selectedBoardingHouse?.id ?? selectedFacility?.id ?? null,
            start: navStart ? { lat: navStart.lat, lng: navStart.lng } : null,
            end: navEnd ? { lat: navEnd.lat, lng: navEnd.lng } : null,
            mode: navMode,
            routeIndex: 0,
            routeCount: availableRoutes.length,
            totalDistanceMeters: availableRoutes[0]?.totalDistance ?? null,
          }}
        />

        <MapBottomCard
          item={selectedMapItem}
          onClose={onClearSelection}
          onViewDetails={() => setFacilitySheetOpen(true)}
          onDirections={beginNavigationToItem}
        />

        {!hasResults && !error && !isLoading && hasActiveFilters && (
          <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/90 px-4 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <p className="text-sm font-medium text-foreground">No locations found.</p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm" aria-label="Loading map">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map and locations...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <p className="text-sm text-destructive font-medium bg-destructive/10 px-4 py-2 rounded-md" role="alert">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
