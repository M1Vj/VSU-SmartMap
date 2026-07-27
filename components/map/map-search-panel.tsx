"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapItem } from "@/lib/types/map";
import { filterMapItems } from "@/lib/map/filter-map-items";
import { useApp } from "@/lib/context/app-context";
import { CategoryFilters } from "./category-filters";
import { searchRooms } from "@/lib/supabase/queries/rooms";
import { getCachedRooms } from "@/lib/cache/rooms-cache";
import { getRoomMatchedFacilityIds } from "@/lib/map/search-suggestions";


type MapSearchPanelProps = {
  items: readonly MapItem[];
  onResultsChange?: (items: MapItem[]) => void;
  onMatchCountChange?: (count: number) => void;
  showBoardingHouses?: boolean;
  onToggleBoardingHouses?: (next: boolean) => void;
  boardingHousesLoading?: boolean;
};

export function MapSearchPanel({
  items,
  onResultsChange,
  onMatchCountChange,
  showBoardingHouses,
  onToggleBoardingHouses,
  boardingHousesLoading,
}: MapSearchPanelProps) {
  const {
    debouncedQuery,
    selectedCategories,
    setCategories,
    toggleCategory,
  } = useApp();

  const [roomMatchFacilityIds, setRoomMatchFacilityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const searchLower = debouncedQuery.toLowerCase().trim();
    if (searchLower.length < 2) {
      setRoomMatchFacilityIds(new Set());
      return;
    }

    let cancelled = false;
    const doRoomSearch = async () => {
      // Try cache first for immediate (and offline) results
      const cachedRooms = await getCachedRooms();
      if (cancelled) return;

      const cachedIds = cachedRooms && cachedRooms.length > 0
        ? getRoomMatchedFacilityIds(cachedRooms, searchLower)
        : new Set<string>();

      if (cachedIds.size > 0) {
        setRoomMatchFacilityIds(cachedIds);
        // If we found results in cache and we're offline, we're done
        if (!navigator.onLine) return;
      }

      const { data } = await searchRooms({ term: searchLower, includeFacility: true });
      if (cancelled) return;

      const remoteIds = new Set<string>();
      for (const room of data ?? []) {
        const roomWithFacility = room as { facility_id?: string; facility?: { id?: string } };
        const fid = roomWithFacility.facility?.id ?? roomWithFacility.facility_id;
        if (fid) remoteIds.add(fid);
      }

      // Commit exactly one outcome for this query, the empty set included. The
      // previous branch only cleared when the cache was empty too, so a warm
      // cache that matched nothing for the current term left the previous
      // query's building on the map as though it had matched.
      setRoomMatchFacilityIds(remoteIds.size > 0 ? remoteIds : cachedIds);
    };

    const timer = setTimeout(() => void doRoomSearch(), 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [debouncedQuery]);

  const { results, matchCount } = useMemo(
    () => filterMapItems(items, debouncedQuery, selectedCategories, roomMatchFacilityIds),
    [items, debouncedQuery, selectedCategories, roomMatchFacilityIds],
  );

  useEffect(() => {
    onResultsChange?.(results);
  }, [results, onResultsChange]);

  useEffect(() => {
    if (onMatchCountChange) {
      onMatchCountChange(matchCount);
    }
  }, [matchCount, onMatchCountChange]);

  return (
    <div className="flex items-center w-full gap-2">
        <CategoryFilters
        value={selectedCategories}
        onChange={setCategories}
        onToggle={toggleCategory}
        showBoardingHouses={showBoardingHouses}
        onToggleBoardingHouses={onToggleBoardingHouses}
        boardingHousesLoading={boardingHousesLoading}
        />
    </div>
  );
}
