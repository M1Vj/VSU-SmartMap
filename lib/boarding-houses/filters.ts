import type {
  BoardingHouseFilters,
  BoardingHouseMapEntity,
  BoardingHouseSummary,
} from "./types";

export type BoardingHouseSortOption =
  | "nearest"
  | "price_asc"
  | "price_desc"
  | "top_rated"
  | "recently_updated";

export type BoardingHouseSortableResult<TListing extends BoardingHouseSummary = BoardingHouseSummary> = {
  readonly listing: TListing;
  readonly meters: number | null;
};

export const BOARDING_HOUSE_DEFAULT_FILTERS: BoardingHouseFilters = {
  showOnMap: false,
  query: "",
  minMonthlyPrice: null,
  maxMonthlyPrice: null,
  minAvailableSlots: null,
  roomTypes: [],
  occupancyPolicies: [],
  waterIncluded: false,
  electricityIncluded: false,
  wifi: false,
  cookingAllowed: false,
  furnished: false,
  airConditioning: false,
  privateBathroom: false,
  allowsNoCurfew: false,
  dryingArea: false,
  smokingAllowed: false,
  cctv: false,
};

export function filterBoardingHouses(
  listings: readonly BoardingHouseSummary[],
  filters: BoardingHouseFilters,
): BoardingHouseSummary[] {
  const query = filters.query.trim().toLowerCase();
  const minMonthlyPrice = clampFilterNumber(filters.minMonthlyPrice);
  const maxMonthlyPrice = clampFilterNumber(filters.maxMonthlyPrice);
  const minAvailableSlots = clampFilterNumber(filters.minAvailableSlots);

  return listings.filter((listing) => {
    if (listing.status !== "published") {
      return false;
    }

    if (query && !matchesQuery(listing, query)) {
      return false;
    }

    // Null-price rule (BH-DATA-05): an unpriced listing FAILS a min-price
    // filter (we cannot confirm it meets the floor) but PASSES a max-price
    // filter (it may still be affordable, so we do not hide it). Min and max
    // are handled symmetrically against the listing's nearest comparable price.
    if (minMonthlyPrice !== null) {
      if (listing.priceMax === null || listing.priceMax < minMonthlyPrice) {
        return false;
      }
    }

    if (maxMonthlyPrice !== null) {
      if (listing.priceMin !== null && listing.priceMin > maxMonthlyPrice) {
        return false;
      }
    }

    if (minAvailableSlots !== null) {
      if (
        listing.availableSlots === null ||
        listing.availableSlots < minAvailableSlots
      ) {
        return false;
      }
    }

    if (
      filters.roomTypes.length > 0 &&
      !filters.roomTypes.some((roomType) => listing.roomTypes.includes(roomType))
    ) {
      return false;
    }

    if (
      filters.occupancyPolicies.length > 0 &&
      !filters.occupancyPolicies.some((policy) =>
        listing.occupancyPolicies.includes(policy),
      )
    ) {
      return false;
    }

    if (filters.waterIncluded && !listing.waterIncluded) {
      return false;
    }

    if (filters.electricityIncluded && !listing.electricityIncluded) {
      return false;
    }

    if (filters.airConditioning && !listing.amenities.airConditioning) {
      return false;
    }

    if (filters.privateBathroom && !listing.privateBathroom) {
      return false;
    }

    if (filters.wifi && !listing.amenities.wifi) {
      return false;
    }

    if (filters.cookingAllowed && !listing.amenities.cookingAllowed) {
      return false;
    }

    if (filters.furnished && !listing.amenities.furnished) {
      return false;
    }

    if (filters.allowsNoCurfew && listing.rules.hasCurfew) {
      return false;
    }

    if (filters.dryingArea && !listing.amenities.dryingArea) {
      return false;
    }

    if (filters.smokingAllowed && !listing.rules.smokingAllowed) {
      return false;
    }

    if (filters.cctv && !listing.safetyFeatures.includes("cctv")) {
      return false;
    }

    return true;
  });
}

export function sortBoardingHouseResults<
  TResult extends BoardingHouseSortableResult,
>(results: readonly TResult[], sort: BoardingHouseSortOption): TResult[] {
  return results
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const result = compareBoardingHouseResults(a.entry, b.entry, sort);
      return result === 0 ? a.index - b.index : result;
    })
    .map(({ entry }) => entry);
}

function compareBoardingHouseResults(
  a: BoardingHouseSortableResult,
  b: BoardingHouseSortableResult,
  sort: BoardingHouseSortOption,
): number {
  switch (sort) {
    case "nearest":
      return compareNullableNumberAsc(a.meters, b.meters);
    case "price_asc":
      return compareNullableNumberAsc(a.listing.priceMin, b.listing.priceMin);
    case "price_desc": {
      const byMax = compareNullableNumberDesc(a.listing.priceMax, b.listing.priceMax);
      if (byMax !== 0) return byMax;
      return compareNullableNumberDesc(a.listing.priceMin, b.listing.priceMin);
    }
    case "top_rated": {
      const byRated = compareNullableNumberDesc(
        a.listing.reviewCount > 0 ? a.listing.averageRating : null,
        b.listing.reviewCount > 0 ? b.listing.averageRating : null,
      );
      if (byRated !== 0) return byRated;
      return compareNullableNumberDesc(
        a.listing.reviewCount > 0 ? a.listing.reviewCount : null,
        b.listing.reviewCount > 0 ? b.listing.reviewCount : null,
      );
    }
    case "recently_updated":
      return compareNullableNumberDesc(
        readTime(a.listing.updatedAt),
        readTime(b.listing.updatedAt),
      );
  }
}

/**
 * Normalizes a numeric filter input. Negative, NaN, or non-finite values are
 * treated as "no filter" (null) so a malformed input never silently drops
 * valid listings. Zero is preserved (a valid floor / ceiling).
 */
function clampFilterNumber(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function compareNullableNumberAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareNullableNumberDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function readTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function formatBoardingHousePriceRange(listing: BoardingHouseSummary): string {
  if (listing.priceMin === null && listing.priceMax === null) {
    return "Price not listed";
  }

  if (listing.priceMin !== null && listing.priceMax !== null) {
    if (listing.priceMin === listing.priceMax) {
      return `${formatPeso(listing.priceMin)} / month`;
    }

    return `${formatPeso(listing.priceMin)}–${formatPeso(listing.priceMax)} / month`;
  }

  if (listing.priceMin !== null) {
    return `From ${formatPeso(listing.priceMin)} / month`;
  }

  return `Up to ${formatPeso(listing.priceMax ?? 0)} / month`;
}

export function toBoardingHouseMapEntity(
  listing: BoardingHouseSummary,
): BoardingHouseMapEntity {
  return {
    kind: "boarding_house",
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    coordinates: listing.coordinates,
    summary: listing,
  };
}

function matchesQuery(listing: BoardingHouseSummary, query: string): boolean {
  return `${listing.name} ${listing.addressLine} ${listing.ownerDisplayName}`
    .toLowerCase()
    .includes(query);
}

function formatPeso(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}
