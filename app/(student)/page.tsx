"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
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
import type { LatLng } from "leaflet";
import type { TransportMode } from "@/lib/types/graph";
import { ReportRouteDialog } from "@/components/navigation/report-route-dialog";
import { filterGraphToRoutingBoundary } from "@/lib/pathfinding/transition-gates";
import { clampPointToVsuCampus } from "@/lib/map/vsu-campus-boundary";
import { doesNavigationOwnViewport } from "@/lib/navigation/map-camera-policy";
import { createRouteAnnouncementTracker } from "@/lib/navigation/route-announcement";
import {
  areFacilityMarkerListsEquivalent,
  getVisibleFacilitiesForMapLoad,
} from "@/lib/map/facility-marker-list";
import { toast } from "sonner";
import { VSU_MAIN_GATE } from "@/lib/constants/map";
import {
  createMapRuntimeController,
  getRouteFacingEndpoint,
  getPresentedNavigationSnapshot,
} from "@/lib/map/map-runtime";
import type { NavigationRequestMetadata } from "@/components/map/navigation-layer";
import {
  beginMapPerformanceRequest,
  commitMapPerformanceRequest,
  clearMapPerformanceRequest,
  failMapPerformanceRequest,
} from "@/lib/map/performance-marks";

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
  // Bumping this re-runs the initial load. Without it the only way out of the
  // "Unable to load map data" overlay was for the student to reload the page.
  const [reloadKey, setReloadKey] = useState(0);
  const handleRetryLoad = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  }, []);
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
             
             // These resolve to { data, error } rather than throwing, so a
             // failed query used to fall straight through this branch: the
             // catch never ran, the graph stayed empty, and directions were
             // silently unavailable with no message and no retry.
             if (nodesRes.error || edgesRes.error) {
               throw nodesRes.error ?? edgesRes.error;
             }

             if (nodesRes.data && edgesRes.data) {
               setGraphData(filterGraphToRoutingBoundary(nodesRes.data, edgesRes.data));
               await setCachedNavigationGraph(nodesRes.data, edgesRes.data);
             }
           } catch (e) {
             console.warn("Failed to sync navigation graph", e);
             if (!cachedNav) {
               toast.error("Directions are unavailable right now. The map still works.");
             }
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
  }, [reloadKey]);

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
        {/* Preserve the same gap above mobile tabs on home-indicator devices. */}
        {/* Desktop remains bottom-8 */}
        <div className="absolute right-6 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 md:right-8 md:bottom-8">
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
          onRetry={handleRetryLoad}
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
  shouldRestoreCommittedRouteForSelectedItem,
} from "@/lib/navigation/selection-route-reset";
import { canReuseCommittedRoute } from "@/lib/navigation/route-reuse";

function MapView({
  filtered,
  isLoading,
  error,
  onRetry,
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
  onRetry: () => void;
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
  
  const runtime = useMemo(() => createMapRuntimeController(), []);
  const runtimeState = useSyncExternalStore(
    runtime.subscribe,
    runtime.getState,
    runtime.getState,
  );
  
  // Use persistent navigation state
  const { navStart, setNavStart, navEnd, setNavEnd, clearNavigation } = useNavigationPersistence();
  
  const [navMode, setNavMode] = useState<TransportMode>('walking');
  const [routeReportOpen, setRouteReportOpen] = useState(false);
  const [mapBottomCardHeight, setMapBottomCardHeight] = useState(0);
  const [manualLocationRequestPending, setManualLocationRequestPending] = useState(false);
  const [reuseCommittedRouteAfterRestore, setReuseCommittedRouteAfterRestore] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const lastConsumedPendingNavigationId = useRef<string | null>(null);
  const routeAnnouncementTracker = useMemo(() => createRouteAnnouncementTracker(), []);
  const [navigationSessionId, setNavigationSessionId] = useState(0);
  const pendingNavigation = runtimeState.navigation.request;
  const committedNavigation = runtimeState.navigation.committed;
  const presentedNavigation = getPresentedNavigationSnapshot(runtimeState);
  const routeRequestDestinationId = pendingNavigation?.destinationId ?? committedNavigation?.destinationId ?? undefined;
  const routeDestinationId = committedNavigation?.destinationId ?? presentedNavigation?.destinationId ?? null;
  const routeSelectionDestinationId = runtimeState.navigation.selectionDestinationId;
  const routeFacingEnd = getRouteFacingEndpoint(runtimeState, navEnd ? { lat: navEnd.lat, lng: navEnd.lng } : null);
  const navigationOrigin = pendingNavigation?.origin ?? committedNavigation?.origin ?? runtimeState.navigation.origin;
  const isManualStartPending = runtimeState.navigation.phase === "acquiring";
  const committedRoute = committedNavigation?.route ?? runtimeState.navigation.committedRoute;
  const hasCommittedOverlay = Boolean(committedRoute);
  const shouldReuseCommittedRoute =
    reuseCommittedRouteAfterRestore &&
    canReuseCommittedRoute({
      committed: committedNavigation,
      destinationId: routeRequestDestinationId,
      mode: navMode,
      start: navStart ? { lat: navStart.lat, lng: navStart.lng } : null,
      end: navEnd ? { lat: navEnd.lat, lng: navEnd.lng } : null,
    });
  const hasNavigationState = Boolean(
    navStart || navEnd || isManualStartPending || pendingNavigation || committedNavigation,
  );
  const navigationControls = {
    primaryActionLabel:
      runtimeState.presentation.controls.primaryAction === "clear" ? "Clear Route" : "Cancel Route",
    canReportRoute: runtimeState.presentation.controls.canReportRoute,
    statusText: runtimeState.presentation.controls.statusText,
  };
  const selectedMapItem: MapItem | null =
    selectedBoardingHouse ?? (selectedFacility?.id === runtimeState.selectedItemId ? selectedFacility : null);
  const reportContext = useMemo(() => {
    const destination = [...filtered, ...(selectedBoardingHouse ? [selectedBoardingHouse] : [])]
      .find((item) => item.id === committedNavigation?.destinationId);
    return {
      fromText:
        committedNavigation?.origin === "live"
          ? "My location"
          : committedNavigation?.origin === "manual" && committedNavigation.start
            ? "Custom start pin"
            : null,
      toText: destination?.name ?? committedNavigation?.destinationId ?? null,
      destinationId: committedNavigation?.destinationId ?? null,
      start: committedNavigation?.start ?? null,
      end: committedNavigation?.end ?? null,
      mode: committedNavigation?.mode ?? navMode,
      routeIndex: 0,
      routeCount: committedNavigation ? 1 : 0,
      totalDistanceMeters: committedNavigation?.route.totalDistance ?? null,
    };
  }, [committedNavigation, filtered, navMode, selectedBoardingHouse]);

  const resolveManualStart = useCallback((point: NavigationPoint, origin: "manual" | "live") => {
    if (!isManualStartPending) return false;
    const pendingRequestId = runtime.getState().navigation.pendingRequestId;
    if (pendingRequestId == null) return false;
    setNavStart({ lat: point.lat, lng: point.lng } as LatLng);
    runtime.dispatch({
      type: "navigation/resolving",
      requestId: pendingRequestId,
      origin,
      start: { lat: point.lat, lng: point.lng },
    });
    return true;
  }, [isManualStartPending, runtime, setNavStart]);

  useEffect(() => {
    if (selectedId && selectedId !== runtimeState.selectedItemId) {
      runtime.dispatch({ type: "selection/set", itemId: selectedId });
    } else if (!selectedId && runtimeState.selectedItemId) {
      runtime.dispatch({ type: "selection/cleared" });
    }
  }, [runtime, runtimeState.selectedItemId, selectedId]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const dismissRouteFoundAnnouncement = useCallback((retiredSessionId?: number) => {
    const toastId = routeAnnouncementTracker.reset(retiredSessionId);
    if (toastId) toast.dismiss(toastId);
  }, [routeAnnouncementTracker]);

  const releaseRouteFoundAnnouncement = useCallback(() => {
    const toastId = routeAnnouncementTracker.releaseToast();
    if (toastId) toast.dismiss(toastId);
  }, [routeAnnouncementTracker]);

  useEffect(() => {
    return () => dismissRouteFoundAnnouncement();
  }, [dismissRouteFoundAnnouncement]);

  const clearRouteState = useCallback(() => {
    dismissRouteFoundAnnouncement(navigationSessionId);
    const pendingRequestId = runtime.getState().navigation.pendingRequestId;
    if (pendingRequestId != null) clearMapPerformanceRequest(pendingRequestId);
    clearMapPerformanceRequest(navigationSessionId);
    clearNavigation();
    setReuseCommittedRouteAfterRestore(false);
    setManualLocationRequestPending(false);
    runtime.dispatch({ type: "navigation/cleared" });
    setRouteReportOpen(false);
  }, [clearNavigation, dismissRouteFoundAnnouncement, navigationSessionId, runtime]);

  const restoreCommittedRoute = useCallback((expectedDestinationId?: string) => {
    const current = runtime.getState();
    const pendingRequestId = current.navigation.pendingRequestId;
    const committed = current.navigation.committed;
    if (
      pendingRequestId === null ||
      committed === null ||
      (expectedDestinationId !== undefined && committed.destinationId !== expectedDestinationId)
    ) {
      return false;
    }

    const restored = runtime.dispatch({
      type: "navigation/restored",
      requestId: pendingRequestId,
      destinationId: committed.destinationId,
    });
    if (restored === current) return false;

    clearMapPerformanceRequest(pendingRequestId);
    dismissRouteFoundAnnouncement(navigationSessionId);
    setNavStart(
      committed.start
        ? ({ lat: committed.start.lat, lng: committed.start.lng } as LatLng)
        : null,
    );
    setNavEnd(
      committed.end
        ? ({ lat: committed.end.lat, lng: committed.end.lng } as LatLng)
        : null,
    );
    setNavMode(committed.mode);
    setReuseCommittedRouteAfterRestore(true);
    setManualLocationRequestPending(false);
    setNavigationSessionId((sessionId) => sessionId + 1);
    return true;
  }, [
    dismissRouteFoundAnnouncement,
    navigationSessionId,
    runtime,
    setNavEnd,
    setNavStart,
  ]);

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

    if (resolveManualStart(routeStart, "live")) setManualLocationRequestPending(false);
  }, [isManualStartPending, manualLocationRequestPending, navEnd, position, resolveManualStart]);

  useEffect(() => {
    if (!manualLocationRequestPending || !locationError) return;

    toast.error("Unable to use your location for the route start. You can still tap the map or start from the main gate.");
    setManualLocationRequestPending(false);
  }, [locationError, manualLocationRequestPending]);

  useEffect(() => {
    if (
      shouldRestoreCommittedRouteForSelectedItem({
        selectedItemId: runtimeState.selectedItemId,
        routeDestinationId: routeSelectionDestinationId,
        committedRouteDestinationId: committedNavigation?.destinationId ?? null,
        pendingRequestId: runtimeState.navigation.pendingRequestId,
      })
    ) {
      restoreCommittedRoute();
      return;
    }

    if (
      shouldClearRouteForSelectedItem({
        selectedItemId: runtimeState.selectedItemId,
        routeDestinationId: routeSelectionDestinationId,
        committedRouteDestinationId: committedNavigation?.destinationId ?? null,
        hasNavigationState,
      })
    ) {
      clearRouteState();
    }
  }, [
    clearRouteState,
    hasNavigationState,
    restoreCommittedRoute,
    runtimeState.selectedItemId,
    runtimeState.navigation.pendingRequestId,
    routeSelectionDestinationId,
    committedNavigation?.destinationId,
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

  const handleRouteCommitted = useCallback((route: PathResult, requestId: number, metadata: NavigationRequestMetadata) => {
    const before = runtime.getState();
    if (before.navigation.pendingRequestId !== requestId || !metadata.destinationId) return;
    const next = runtime.dispatch({
      type: "navigation/committed",
      requestId,
      route,
      snapshot: {
        destinationId: metadata.destinationId,
        origin: metadata.origin,
        mode: metadata.mode,
        start: metadata.start,
        end: metadata.end,
      },
    });
    if (next.navigation.pendingRequestId === null && next.navigation.committed?.route === route) {
      commitMapPerformanceRequest(requestId);
    }
  }, [runtime]);

  const handleRouteFailed = useCallback((message: string, requestId: number) => {
    const before = runtime.getState();
    if (before.navigation.pendingRequestId !== requestId) return;
    const next = runtime.dispatch({ type: "navigation/failed", requestId, message });
    if (next.navigation.pendingRequestId === null && next.navigation.phase === "failed") {
      failMapPerformanceRequest(requestId);
    }
  }, [runtime]);

  const handleRouteRequestStarted = useCallback((requestId: number, metadata: NavigationRequestMetadata) => {
    const current = runtime.getState();
    if (current.navigation.phase === "acquiring" && current.navigation.pendingRequestId === requestId) return;

    if (current.navigation.pendingRequestId !== requestId) {
      const destinationId = metadata.destinationId ?? current.navigation.request?.destinationId ?? current.navigation.destinationId;
      if (!destinationId) return;
      const previousRequestId = current.navigation.pendingRequestId;
      if (previousRequestId !== null) clearMapPerformanceRequest(previousRequestId);
      runtime.dispatch({
        type: "navigation/requested",
        requestId,
        destinationId,
        origin: metadata.origin,
        mode: metadata.mode,
        start: metadata.start,
        end: metadata.end,
      });
      beginMapPerformanceRequest(
        requestId,
        typeof performance === "undefined" ? Date.now() : performance.now(),
        current.navigation.committed !== null,
      );
    }

    runtime.dispatch({
      type: "navigation/resolving",
      requestId,
      origin: metadata.origin,
      start: metadata.start,
      end: metadata.end,
    });
  }, [runtime]);

  const claimRouteFoundAnnouncement = useCallback((sessionId: number) => {
    return routeAnnouncementTracker.claim(sessionId);
  }, [routeAnnouncementTracker]);

  const hasRouteFoundAnnouncement = useCallback((sessionId: number) => {
    return routeAnnouncementTracker.has(sessionId);
  }, [routeAnnouncementTracker]);

  const registerRouteFoundAnnouncement = useCallback((sessionId: number, toastId: string) => {
    routeAnnouncementTracker.register(sessionId, toastId);
  }, [routeAnnouncementTracker]);

  const beginNavigationToItem = useCallback((item: MapItem) => {
    const requestStartedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    const decision = resolveNavigationStart(position);

    dismissRouteFoundAnnouncement(navigationSessionId);
    const requestId = navigationSessionId + 1;
    const end = { lat: item.coordinates.lat, lng: item.coordinates.lng };
    setNavigationSessionId(requestId);
    setReuseCommittedRouteAfterRestore(false);
    runtime.dispatch({
      type: "navigation/requested",
      requestId,
      destinationId: item.id,
      origin: decision.mode,
      mode: navMode,
      awaitingStart: decision.mode === "manual",
      start: decision.mode === "live" ? { lat: decision.start.lat, lng: decision.start.lng } : null,
      end,
    });
    beginMapPerformanceRequest(
      requestId,
      requestStartedAt,
      runtime.getState().navigation.committed !== null,
    );
    setNavEnd(end as LatLng);

    if (decision.mode === "live") {
      setNavStart({ lat: decision.start.lat, lng: decision.start.lng } as LatLng);
      return;
    }

    setNavStart(null);
  }, [dismissRouteFoundAnnouncement, navigationSessionId, navMode, position, runtime, setNavEnd, setNavStart]);

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
    const start = createManualStartPoint(point);
    resolveManualStart(start, "manual");
  }, [resolveManualStart]);

  const handleManualStartMarkerTap = useCallback((item: MapItem) => {
    handleManualStartPlacement(item.coordinates);
  }, [handleManualStartPlacement]);

  const handleUseMyLocationStart = useCallback(() => {
    if (!isManualStartPending) return;

    if (position) {
      const liveStart = { lat: position.coords.latitude, lng: position.coords.longitude };
      const routeStart = clampPointToVsuCampus(liveStart);

      if (resolveManualStart(routeStart, "live")) setManualLocationRequestPending(false);
      return;
    }

    setManualLocationRequestPending(true);
    startTracking();
  }, [isManualStartPending, position, resolveManualStart, startTracking]);

  const handleUseMainGateStart = useCallback(() => {
    if (!isManualStartPending) return;

    if (resolveManualStart(VSU_MAIN_GATE, "manual")) setManualLocationRequestPending(false);
  }, [isManualStartPending, resolveManualStart]);

  return (
    <div className="relative h-full w-full">
      <div className="relative h-full w-full overflow-hidden">
        <MapContainerClient className="h-full w-full">
          <MapSelectionLayer
            items={filtered}
            selectedId={runtimeState.selectedItemId}
            navigationOwnsViewport={doesNavigationOwnViewport({
              hasDestination: Boolean(routeFacingEnd),
              manualStartPending: isManualStartPending,
              pendingNavigation: Boolean(pendingNavigationFacility),
            })}
            routeDestinationId={runtimeState.presentation.markerMode === "destination-focused" ? routeDestinationId : null}
            minimizeNonDestinationMarkers={hasCommittedOverlay || runtimeState.presentation.markerMode === "destination-focused"}
            onSelect={(item) => {
              const current = runtime.getState();
              if (
                shouldRestoreCommittedRouteForSelectedItem({
                  selectedItemId: item.id,
                  routeDestinationId: current.navigation.selectionDestinationId,
                  committedRouteDestinationId: current.navigation.committed?.destinationId ?? null,
                  pendingRequestId: current.navigation.pendingRequestId,
                })
              ) {
                restoreCommittedRoute(item.id);
              }
              runtime.dispatch({ type: "selection/set", itemId: item.id });
              onSelect(item.id);
            }}
            onMarkerTapOverride={isManualStartPending ? handleManualStartMarkerTap : undefined}
            onDirections={(item) => beginNavigationToItem(item)}
            onMapClick={isManualStartPending ? handleManualStartPlacement : undefined}
            onClearSelection={() => {
              runtime.dispatch({ type: "selection/cleared" });
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
              destination={routeFacingEnd}
              selectedFacility={
                selectedFacility?.id === selectedId 
                  ? (selectedFacility && 'coordinates' in selectedFacility ? selectedFacility.coordinates : null) 
                  : null
              }
              geo={geo}
          />
          
          {hasHydrated && graphData.nodes.length > 0 && graphData.edges.length > 0 && (
          <NavigationLayer
              startPoint={navStart} 
              endPoint={navEnd} 
              destinationId={routeRequestDestinationId}
              mode={navMode} 
              nodes={graphData.nodes}
              edges={graphData.edges}
              waitingForUserLocation={navigationOrigin === "live" && !navStart}
              acquiringStart={isManualStartPending}
              enabled={Boolean(routeRequestDestinationId) && runtimeState.navigation.phase !== "cleared" && runtimeState.navigation.phase !== "idle" && runtimeState.navigation.phase !== "failed"}
              navigationSessionId={navigationSessionId}
              hasRouteFoundAnnouncement={hasRouteFoundAnnouncement}
              claimRouteFoundAnnouncement={claimRouteFoundAnnouncement}
              registerRouteFoundAnnouncement={registerRouteFoundAnnouncement}
              releaseRouteFoundAnnouncement={releaseRouteFoundAnnouncement}
              onRouteCommitted={handleRouteCommitted}
              onRouteFailed={handleRouteFailed}
              onRouteRequestStarted={handleRouteRequestStarted}
              committedRoute={committedRoute}
              navigationOrigin={navigationOrigin}
              reuseCommittedRoute={shouldReuseCommittedRoute}
            />
          )}
        </MapContainerClient>

        {hasHydrated && routeFacingEnd && (
          <div data-map-status-hud className="pointer-events-none absolute top-20 left-1/2 z-[1000] flex -translate-x-1/2 flex-col items-center gap-2">
            {navigationControls.statusText && (
              <div
                className="rounded-full border bg-background/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground shadow-lg ring-1 ring-black/5 backdrop-blur"
                role="status"
              >
                {navigationControls.statusText}
              </div>
            )}

            {isManualStartPending && (
              <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-11 rounded-full bg-background/95 px-4 text-xs font-semibold shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                  onClick={handleUseMyLocationStart}
                  aria-label="Use my location as route start"
                >
                  Use my location
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-11 rounded-full bg-background/95 px-4 text-xs font-semibold shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                  onClick={handleUseMainGateStart}
                  aria-label="Start route from main gate"
                >
                  Start from main gate
                </Button>
              </div>
            )}

            {!isManualStartPending && committedRoute && (
                <div className="flex animate-in gap-3 rounded-full border bg-background/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-lg ring-1 ring-black/5 backdrop-blur fade-in slide-in-from-top-1">
                    <span className="flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        {committedRoute.totalDistance.toFixed(0)}m
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {committedRoute.estimatedTime} min
                    </span>
                </div>
            )}
          </div>
        )}

        {hasHydrated && routeFacingEnd && (
          <div
            data-map-action-dock
            style={{ "--map-mini-card-height": `${mapBottomCardHeight}px` } as CSSProperties}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+var(--map-mini-card-height,0px)+1rem+env(safe-area-inset-bottom,0px))] z-[1000] flex flex-wrap justify-center gap-2 px-3 md:absolute md:bottom-8"
          >
            {runtimeState.presentation.controls.primaryAction !== "none" && (
              <Button
                variant={hasCommittedOverlay ? "destructive" : "outline"}
                size="sm"
                className="pointer-events-auto h-11 min-w-11 rounded-full bg-background/95 px-4 text-xs font-semibold uppercase tracking-wider shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                onClick={clearRouteState}
                aria-label={`${navigationControls.primaryActionLabel} navigation`}
              >
                {navigationControls.primaryActionLabel}
              </Button>
            )}
            {navigationControls.canReportRoute && (
              <Button
                variant="outline"
                size="sm"
                className="pointer-events-auto h-11 min-w-11 rounded-full bg-background/95 px-4 text-xs font-semibold uppercase tracking-wider shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-background"
                onClick={() => setRouteReportOpen(true)}
                aria-label="Report route"
              >
                Report Route
              </Button>
            )}
          </div>
        )}

        <ReportRouteDialog
          open={routeReportOpen}
          onOpenChange={setRouteReportOpen}
          context={reportContext}
        />

        <MapBottomCard
          item={selectedMapItem}
          onHeightChange={setMapBottomCardHeight}
          onClose={onClearSelection}
          onViewDetails={() => setFacilitySheetOpen(true)}
          onDirections={beginNavigationToItem}
        />

        {!hasResults && !error && !isLoading && hasActiveFilters && (
          <div className="pointer-events-none absolute bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/90 px-4 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur md:bottom-12">
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
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/60 px-4 backdrop-blur-sm">
          <p className="max-w-sm rounded-md bg-destructive/10 px-4 py-2 text-center text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
