"use client";

import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { DirectoryList } from "./directory-list";

import { Button } from "@/components/ui/button";
import type { Facility } from "@/lib/types/facility";
import { useApp } from "@/lib/context/app-context";
import { searchRooms } from "@/lib/supabase/queries/rooms";
import { getRoomMatchedFacilityIds } from "@/lib/map/search-suggestions";


export interface DirectoryContainerProps {
  facilities: Facility[];
}

export function DirectoryContainer({ facilities }: DirectoryContainerProps) {
  const router = useRouter();
  const {
    searchQuery,
    selectedCategories,
    clearFilters,
    selectFacility,
  } = useApp();

  const [roomMatchFacilityIds, setRoomMatchFacilityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower.length < 2) {
      setRoomMatchFacilityIds(new Set());
      return;
    }

    let cancelled = false;
    const doRoomSearch = async () => {
      const { data } = await searchRooms({ term: searchLower, includeFacility: true });
      if (cancelled) return;

      if (data && data.length > 0) {
        setRoomMatchFacilityIds(getRoomMatchedFacilityIds(data, searchLower));
      } else {
        setRoomMatchFacilityIds(new Set());
      }
    };

    const timer = setTimeout(() => void doRoomSearch(), 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      const searchLower = searchQuery.toLowerCase().trim();

      const matchesFacilitySearch =
        searchLower === "" ||
        facility.name.toLowerCase().includes(searchLower) ||
        facility.code?.toLowerCase().includes(searchLower) ||
        facility.description?.toLowerCase().includes(searchLower);

      const matchesRoomSearch = roomMatchFacilityIds.has(facility.id);

      const matchesSearch = matchesFacilitySearch || matchesRoomSearch;

      // If no categories selected, show NO items. Otherwise, filter by selected categories.
      const matchesCategory =
        selectedCategories.length > 0 && selectedCategories.includes(facility.category);

      return matchesSearch && matchesCategory;
    });
  }, [facilities, searchQuery, selectedCategories, roomMatchFacilityIds]);

  const hasActiveFilters = searchQuery !== "" || selectedCategories.length > 0;

  const handleViewOnMap = (facility: Facility) => {
    router.push(`/?facility=${facility.id}`, { scroll: false });
  };



  return (
    <>
      <div className="space-y-4">
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredFacilities.length} of {facilities.length} facilities
          </p>
        )}

        {filteredFacilities.length === 0 && hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg text-muted-foreground">
              No facilities match your filters.
            </p>
            <Button
              type="button"
              variant="link"
              onClick={clearFilters}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <DirectoryList
            facilities={filteredFacilities}
            onFacilityClick={selectFacility}
            onViewOnMap={handleViewOnMap}
          />
        )}
      </div>


    </>
  );
}
