import type { MapItem } from "@/lib/types/map";
import type { FacilityCategory } from "@/lib/types/facility";

export function filterMapItems(
  items: readonly MapItem[],
  term: string,
  selectedCategories?: FacilityCategory[],
  roomMatchedIds?: Set<string>,
) {
  const normalizedTerm = term.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (item.kind === "boarding_house") {
      return (
        normalizedTerm.length === 0 ||
        item.name.toLowerCase().includes(normalizedTerm) ||
        item.summary.addressLine.toLowerCase().includes(normalizedTerm)
      );
    }

    // If no categories selected, show NO items. Otherwise, filter by selected categories.
    const matchesCategory = !selectedCategories || selectedCategories.length === 0
      ? false
      : (item.category ? selectedCategories.includes(item.category) : false);

    const matchesFacilityTerm =
      normalizedTerm.length === 0 ||
      item.name.toLowerCase().includes(normalizedTerm) ||
      (item.code ? item.code.toLowerCase().includes(normalizedTerm) : false) ||
      (item.description ? item.description.toLowerCase().includes(normalizedTerm) : false);

    const matchesRoomSearch = roomMatchedIds?.has(item.id) ?? false;

    const matchesTerm = matchesFacilityTerm || matchesRoomSearch;

    return matchesCategory && matchesTerm;
  });

  return { results: filtered, matchCount: filtered.length };
}
