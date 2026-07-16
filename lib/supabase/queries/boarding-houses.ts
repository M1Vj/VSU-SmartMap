import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { normalizeError } from "@/lib/supabase/queries/facilities";
import type {
  BoardingHouseDetail,
  BoardingHouseOccupancyPolicy,
  BoardingHouseReview,
  BoardingHouseRoomType,
  BoardingHouseSummary,
} from "@/lib/boarding-houses/types";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };
type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

export type BoardingHouseRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  verification_status: string;
  address_line: string;
  latitude: number;
  longitude: number;
  thumbnail_url: string | null;
  price_min: number | null;
  price_max: number | null;
  price_changed_at: string | null;
  available_slots: number | null;
  room_types: string[] | null;
  occupancy_policies: string[] | null;
  wifi: boolean;
  cooking_allowed: boolean;
  furnished: boolean;
  air_conditioning: boolean;
  laundry_area: boolean;
  parking: boolean;
  study_area: boolean;
  has_curfew: boolean;
  curfew_time: string | null;
  allows_visitors: boolean;
  allows_pets: boolean;
  walking_minutes_to_campus_gate: number | null;
  owner_display_name: string;
  avg_rating: number;
  rating_count: number;
  water_included?: boolean;
  electricity_included?: boolean;
  private_bathroom?: boolean;
  advance_months?: number | null;
  deposit_months?: number | null;
  smoking_allowed?: boolean;
  drying_area?: boolean;
  safety_features?: string[] | null;
  appliance_fee?: number | null;
  mobile_carriers?: string[] | null;
  boarding_house_photos?: Array<{
    storage_bucket: string;
    storage_path: string;
    sort_order: number;
  }>;
  published_at: string | null;
  updated_at: string;
};

type BoardingHouseDetailRow = Omit<BoardingHouseRow, "boarding_house_photos"> & {
  description: string;
  contact_phone: string | null;
  contact_facebook: string | null;
  contact_email: string | null;
  boarding_house_photos?: Array<{
    id: string;
    storage_bucket: string;
    storage_path: string;
    public_url: string;
    alt_text: string;
    sort_order: number;
  }>;
  boarding_house_offerings?: Array<{
    id: string;
    listing_id: string;
    room_type: string;
    label: string;
    monthly_price: number;
    available_slots: number;
    occupancy_policy: string;
    capacity?: number | null;
    size_sqm?: number | null;
    has_aircon?: boolean;
    private_bathroom?: boolean;
    image_path?: string | null;
  }>;
};

const summaryColumns = `
  id,
  slug,
  name,
  status,
  verification_status,
  address_line,
  latitude,
  longitude,
  thumbnail_url,
  price_min,
  price_max,
  price_changed_at,
  available_slots,
  room_types,
  occupancy_policies,
  wifi,
  cooking_allowed,
  furnished,
  air_conditioning,
  laundry_area,
  parking,
  study_area,
  has_curfew,
  curfew_time,
  allows_visitors,
  allows_pets,
  walking_minutes_to_campus_gate,
  owner_display_name,
  avg_rating,
  rating_count,
  water_included,
  electricity_included,
  private_bathroom,
  advance_months,
  deposit_months,
  smoking_allowed,
  drying_area,
  safety_features,
  appliance_fee,
  mobile_carriers,
  published_at,
  updated_at
`;

const summarySelect = `
  ${summaryColumns},
  boarding_house_photos(storage_bucket, storage_path, sort_order)
`;

const detailSelect = `
  ${summaryColumns},
  description,
  contact_phone,
  contact_facebook,
  contact_email,
  boarding_house_photos(id, storage_bucket, storage_path, public_url, alt_text, sort_order),
  boarding_house_offerings(
    id,
    listing_id,
    room_type,
    label,
    monthly_price,
    available_slots,
    occupancy_policy,
    capacity,
    size_sqm,
    has_aircon,
    private_bathroom,
    image_path
  )
`;

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

export function toBoardingHouseSummary(row: BoardingHouseRow): BoardingHouseSummary {
  const coverPhoto = (row.boarding_house_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as BoardingHouseSummary["status"],
    verificationStatus:
      row.verification_status as BoardingHouseSummary["verificationStatus"],
    addressLine: row.address_line,
    coordinates: { lat: row.latitude, lng: row.longitude },
    thumbnailUrl: row.thumbnail_url,
    coverPhotoBucket: coverPhoto?.storage_bucket ?? null,
    coverPhotoPath: coverPhoto?.storage_path ?? null,
    priceMin: row.price_min,
    priceMax: row.price_max,
    priceChangedAt: row.price_changed_at,
    availableSlots: row.available_slots,
    roomTypes: (row.room_types ?? []) as BoardingHouseRoomType[],
    occupancyPolicies: (row.occupancy_policies ?? []) as BoardingHouseOccupancyPolicy[],
    amenities: {
      wifi: row.wifi,
      cookingAllowed: row.cooking_allowed,
      furnished: row.furnished,
      airConditioning: row.air_conditioning,
      laundryArea: row.laundry_area,
      dryingArea: row.drying_area ?? false,
      parking: row.parking,
      studyArea: row.study_area,
    },
    rules: {
      hasCurfew: row.has_curfew,
      curfewTime: row.curfew_time,
      allowsVisitors: row.allows_visitors,
      allowsPets: row.allows_pets,
      smokingAllowed: row.smoking_allowed ?? false,
    },
    walkingMinutesToCampusGate: row.walking_minutes_to_campus_gate,
    ownerDisplayName: row.owner_display_name,
    averageRating: row.avg_rating,
    reviewCount: row.rating_count,
    waterIncluded: row.water_included ?? false,
    electricityIncluded: row.electricity_included ?? false,
    privateBathroom: row.private_bathroom ?? false,
    advanceMonths: row.advance_months ?? null,
    depositMonths: row.deposit_months ?? null,
    safetyFeatures: (row.safety_features ??
      []) as BoardingHouseSummary["safetyFeatures"],
    applianceFee: row.appliance_fee ?? null,
    mobileCarriers: (row.mobile_carriers ??
      []) as BoardingHouseSummary["mobileCarriers"],
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export function toBoardingHouseDetail(row: BoardingHouseDetailRow): BoardingHouseDetail {
  return {
    ...toBoardingHouseSummary(row),
    description: row.description,
    contactPhone: row.contact_phone,
    contactFacebook: row.contact_facebook,
    contactEmail: row.contact_email,
    photos: (row.boarding_house_photos ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((photo) => ({
        id: photo.id,
        url: photo.public_url,
        alt: photo.alt_text,
        sortOrder: photo.sort_order,
        storageBucket: photo.storage_bucket,
        storagePath: photo.storage_path,
      })),
    offerings: (row.boarding_house_offerings ?? []).map((offering) => ({
      id: offering.id,
      listingId: offering.listing_id,
      roomType: offering.room_type as BoardingHouseRoomType,
      label: offering.label,
      monthlyPrice: offering.monthly_price,
      availableSlots: offering.available_slots,
      occupancyPolicy: offering.occupancy_policy as BoardingHouseOccupancyPolicy,
      capacity: offering.capacity ?? null,
      sizeSqm: offering.size_sqm ?? null,
      hasAircon: offering.has_aircon ?? false,
      privateBathroom: offering.private_bathroom ?? false,
      imagePath: offering.image_path ?? null,
      imageUrl: null,
    })),
  };
}

export async function getBoardingHouseSummaries(
  client?: MaybeClient,
  options?: { limit?: number; offset?: number },
): Promise<BaseResult<BoardingHouseSummary[]>> {
  const supabase = await resolveClient(client);
  let builder = supabase
    .from("boarding_house_listings")
    .select(summarySelect)
    .eq("status", "published")
    .eq("verification_status", "verified")
    .order("updated_at", { ascending: false });

  if (typeof options?.limit === "number") {
    const offset = options.offset ?? 0;
    builder = builder.range(offset, offset + options.limit - 1);
  } else if (typeof options?.offset === "number") {
    builder = builder.range(options.offset, options.offset + 499);
  }

  const { data, error } = await builder;

  if (error || !data) {
    return { data: null, error: normalizeError(error) };
  }

  return { data: (data as BoardingHouseRow[]).map(toBoardingHouseSummary), error: null };
}

export async function getBoardingHouseBySlug(
  slug: string,
  client?: MaybeClient,
): Promise<BaseResult<BoardingHouseDetail>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("boarding_house_listings")
    .select(detailSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("verification_status", "verified")
    .maybeSingle();

  if (error || !data) {
    return { data: null, error: normalizeError(error) };
  }

  return {
    data: toBoardingHouseDetail(data as unknown as BoardingHouseDetailRow),
    error: null,
  };
}

export type BoardingHouseReviewRow = {
  id: string;
  listing_id: string;
  author_display_name: string;
  rating: number;
  body: string;
  is_verified_stay: boolean;
  created_at: string;
};

export function toBoardingHouseReview(row: BoardingHouseReviewRow): BoardingHouseReview {
  return {
    id: row.id,
    listingId: row.listing_id,
    authorDisplayName: row.author_display_name || "VSU student",
    rating: row.rating,
    body: row.body,
    isVerifiedStay: row.is_verified_stay,
    createdAt: row.created_at,
  };
}

export async function getApprovedBoardingHouseReviews(
  listingId: string,
  client?: MaybeClient,
): Promise<BaseResult<BoardingHouseReview[]>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("boarding_house_reviews")
    .select(
      "id, listing_id, author_display_name, rating, body, is_verified_stay, created_at",
    )
    .eq("listing_id", listingId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { data: null, error: normalizeError(error) };
  }

  return {
    data: (data as BoardingHouseReviewRow[]).map(toBoardingHouseReview),
    error: null,
  };
}
