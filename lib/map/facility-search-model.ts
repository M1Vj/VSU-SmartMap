import { getCategoryMeta } from "@/lib/constants/facilities";
import {
  getSearchSuggestions,
  type RoomSearchSource,
} from "@/lib/map/search-suggestions";
import type { Facility } from "@/lib/types/facility";

export type FacilitySearchOption = {
  id: string;
  facility: Facility;
  primary: string;
  secondary: string;
  color: string;
  matchedRoomCode?: string;
};

export function buildFacilitySearchOptions(input: {
  facilities: readonly Facility[];
  rooms: readonly RoomSearchSource[];
  query: string;
  limit?: number;
}): FacilitySearchOption[] {
  return getSearchSuggestions(input).map((suggestion) => {
    const meta = getCategoryMeta(suggestion.facility.category);
    const secondary = [
      suggestion.facility.code,
      meta.label,
      suggestion.matchedRoomCode
        ? `Room ${suggestion.matchedRoomCode}`
        : null,
    ].filter(Boolean).join(" - ");

    return {
      id: suggestion.facility.id,
      facility: suggestion.facility,
      primary: suggestion.facility.name,
      secondary: secondary || meta.label,
      color: meta.color,
      matchedRoomCode: suggestion.matchedRoomCode,
    };
  });
}
