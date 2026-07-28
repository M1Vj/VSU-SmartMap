"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedFacilities, setCachedFacilities } from "@/lib/cache/facilities-cache";
import { getCachedRooms } from "@/lib/cache/rooms-cache";
import {
  loadFacilitySearchRooms,
  startFacilitySearchFacilities,
  type FacilitySearchRequest,
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
  optionsQuery: string;
  loading: boolean;
  source: SearchDataSource;
  error: string | null;
  ensureFacilitiesLoaded: () => Promise<Facility[]>;
};

const SAFE_LOAD_ERROR = "Search suggestions could not be refreshed.";

export function useFacilitySearchData({
  enabled,
  query,
  initialFacilities = [],
}: UseFacilitySearchDataOptions): FacilitySearchData {
  const [state, setState] = useState<Omit<FacilitySearchData, "ensureFacilitiesLoaded">>({
    facilities: [...initialFacilities],
    rooms: [],
    optionsQuery: "",
    loading: false,
    source: initialFacilities.length > 0 ? "cache" : "empty",
    error: null,
  });
  const facilityRequestRef = useRef<FacilitySearchRequest<Facility> | null>(null);
  const getFacilityRequest = useCallback(() => {
    if (facilityRequestRef.current) return facilityRequestRef.current;

    const request = startFacilitySearchFacilities<Facility>({
      readCache: getCachedFacilities,
      writeCache: setCachedFacilities,
      fetchRemote: async () => {
        const result = await getFacilitiesLite();
        return {
          data: result.data as Facility[] | null,
          error: result.error,
        };
      },
    });
    facilityRequestRef.current = request;
    void request.complete.finally(() => {
      if (facilityRequestRef.current === request) facilityRequestRef.current = null;
    });
    return request;
  }, []);
  const ensureFacilitiesLoaded = useCallback(async () => {
    try {
      return await getFacilityRequest().available;
    } catch {
      return [];
    }
  }, [getFacilityRequest]);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        rooms: [],
        optionsQuery: "",
        loading: false,
        source: current.facilities.length > 0 ? current.source : "empty",
        error: null,
      }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    const facilityRequest = getFacilityRequest();
    const unsubscribeFacilities = facilityRequest.subscribe((facilities, source) => {
      if (!cancelled) {
        setState((current) => ({ ...current, facilities, source }));
      }
    });

    const roomsPromise = loadFacilitySearchRooms<RoomSearchSource>({
      query,
      readCache: getCachedRooms,
      fetchRemote: async () => {
        const result = await searchRooms({
          term: query.trim().toLowerCase(),
          includeFacility: true,
        });
        return {
          data: result.data as RoomSearchSource[] | null,
          error: result.error,
        };
      },
      publish: (rooms) => {
        if (!cancelled) {
          setState((current) => ({ ...current, rooms }));
        }
      },
    });

    void Promise.all([facilityRequest.complete, roomsPromise])
      .then(([facilityResult, roomResult]) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            optionsQuery: query,
            error:
              facilityResult.failed || roomResult.failed
                ? SAFE_LOAD_ERROR
                : null,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            optionsQuery: query,
            error: SAFE_LOAD_ERROR,
          }));
        }
      });

    return () => {
      cancelled = true;
      unsubscribeFacilities();
    };
  }, [enabled, getFacilityRequest, query]);

  return { ...state, ensureFacilitiesLoaded };
}
