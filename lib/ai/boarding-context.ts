import type { BoardingHouseChatContext } from "@/lib/supabase/queries/boarding-houses.server";

const BOARDING_QUERY_PATTERN =
  /\b(boarding|board house|bedspace|bed space|dorm|rent|rental|room for rent|apartment|stay|live off campus|ladies|male only|female only|aircon room)\b|₱/i;

type CompactBoardingHouse = {
  listingId: string;
  slug: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  slots: number | null;
  walkMinutes: number | null;
  flags: string[];
  occupancy: readonly string[];
  roomTypes: readonly string[];
};

const flagKeys: Array<[keyof BoardingHouseChatContext, string]> = [
  ["wifi", "wifi"],
  ["cookingAllowed", "cookingAllowed"],
  ["furnished", "furnished"],
  ["airConditioning", "airConditioning"],
  ["laundryArea", "laundryArea"],
  ["dryingArea", "dryingArea"],
  ["waterIncluded", "waterIncluded"],
  ["electricityIncluded", "electricityIncluded"],
  ["privateBathroom", "privateBathroom"],
  ["hasCurfew", "hasCurfew"],
  ["smokingAllowed", "smokingAllowed"],
  ["cctv", "cctv"],
];

export function shouldIncludeBoardingHouseContext(query: string): boolean {
  return BOARDING_QUERY_PATTERN.test(query);
}

export function compactBoardingHousesForPrompt(
  listings: readonly BoardingHouseChatContext[],
  maxChars = 2000
): string {
  const compactListings = listings.map(toCompactBoardingHouse);
  let selected = compactListings;
  let serialized = JSON.stringify(selected);

  while (serialized.length > maxChars && selected.length > 0) {
    selected = selected.slice(0, -1);
    serialized = JSON.stringify(selected);
  }

  return serialized;
}

function toCompactBoardingHouse(listing: BoardingHouseChatContext): CompactBoardingHouse {
  return {
    listingId: listing.id,
    slug: listing.slug,
    name: listing.name,
    priceMin: listing.priceMin,
    priceMax: listing.priceMax,
    slots: listing.availableSlots,
    walkMinutes: listing.walkingMinutesToCampusGate,
    flags: flagKeys
      .filter(([key]) => Boolean(listing[key]))
      .map(([, label]) => label),
    occupancy: listing.occupancyPolicies,
    roomTypes: listing.roomTypes,
  };
}
