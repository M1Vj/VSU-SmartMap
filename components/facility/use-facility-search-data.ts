"use client";

import { useEffect, useState } from "react";
import { getCachedFacilities, setCachedFacilities } from "@/lib/cache/facilities-cache";
import { getCachedRooms } from "@/lib/cache/rooms-cache";
import {
  loadFacilitySearchFacilities,
  loadFacilitySearchRooms,
  type SearchDataSource,
} from "@/lib/map/facility-search-loader";
import type { RoomSearchSource } from "@/lib/map/search-suggestions";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import { searchRooms } from "@/lib/supabase/queries/rooms";
import type { Facility } from "@/lib/types/facility";

type UseFacilitySearchDataOptions = {
  enabled: boolean;
  query: string;
  initialFacilities?: readonly Facility[];
};

type FacilitySearchData = {
  facilities: Facility[];
  rooms: RoomSearchSource[];
  loading: boolean;
  source: SearchDataSource;
  error: string | null;
};

const SAFE_LOAD_ERROR = "Search suggestions could not be refreshed.";

export function useFacilitySearchData({
  enabled,
  query,
  initialFacilities = [],
}: UseFacilitySearchDataOptions): FacilitySearchData {
  const [state, setState] = useState<FacilitySearchData>({
    facilities: [...initialFacilities],
    rooms: [],
    loading: false,
    source: initialFacilities.length > 0 ? "cache" : "empty",
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        rooms: [],
        loading: false,
        source: current.facilities.length > 0 ? current.source : "empty",
        error: null,
      }));
      return;
    }

    let cancelled = false;
    let hadError = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    const recordError = () => {
      hadError = true;
      if (!cancelled) {
        setState((current) => ({ ...current, error: SAFE_LOAD_ERROR }));
      }
    };

    const facilitiesPromise = loadFacilitySearchFacilities<Facility>({
      readCache: getCachedFacilities,
      writeCache: setCachedFacilities,
      fetchRemote: async () => {
        const result = await getFacilitiesLite();
        if (result.error) recordError();
        return {
          data: result.data as Facility[] | null,
          error: result.error,
        };
      },
      publish: (facilities, source) => {
        if (!cancelled) {
          setState((current) => ({ ...current, facilities, source }));
        }
      },
    }).catch(() => {
      recordError();
      return [] as Facility[];
    });

    const roomsPromise = loadFacilitySearchRooms<RoomSearchSource>({
      query,
      readCache: getCachedRooms,
      fetchRemote: async () => {
        const result = await searchRooms({
          term: query.trim().toLowerCase(),
          includeFacility: true,
        });
        if (result.error) recordError();
        return {
          data: result.data as RoomSearchSource[] | null,
          error: result.error,
        };
      },
      publish: (rooms, source) => {
        if (!cancelled) {
          setState((current) => ({ ...current, rooms, source }));
        }
      },
    }).catch(() => {
      recordError();
      return [] as RoomSearchSource[];
    });

    void Promise.all([facilitiesPromise, roomsPromise]).then(() => {
      if (!cancelled) {
        setState((current) => ({
          ...current,
          loading: false,
          error: hadError ? SAFE_LOAD_ERROR : current.error,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, query]);

  return state;
}
