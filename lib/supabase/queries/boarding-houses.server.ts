"use server";

import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { normalizeError } from "@/lib/supabase/queries/facilities";
import type {
  BoardingHouseOccupancyPolicy,
  BoardingHouseRoomType,
} from "@/lib/boarding-houses/types";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };

export type BoardingHouseChatContext = {
  id: string;
  slug: string;
  name: string;
  addressLine: string;
  priceMin: number | null;
  priceMax: number | null;
  availableSlots: number | null;
  roomTypes: BoardingHouseRoomType[];
  occupancyPolicies: BoardingHouseOccupancyPolicy[];
  wifi: boolean;
  cookingAllowed: boolean;
  furnished: boolean;
  airConditioning: boolean;
  laundryArea: boolean;
  dryingArea: boolean;
  waterIncluded: boolean;
  electricityIncluded: boolean;
  privateBathroom: boolean;
  advanceMonths: number | null;
  depositMonths: number | null;
  hasCurfew: boolean;
  curfewTime: string | null;
  smokingAllowed: boolean;
  cctv: boolean;
  walkingMinutesToCampusGate: number | null;
};

type BoardingHouseChatRow = {
  id: string;
  slug: string;
  name: string;
  address_line: string;
  price_min: number | null;
  price_max: number | null;
  available_slots: number | null;
  room_types: BoardingHouseRoomType[] | null;
  occupancy_policies: BoardingHouseOccupancyPolicy[] | null;
  wifi: boolean;
  cooking_allowed: boolean;
  furnished: boolean;
  air_conditioning: boolean;
  laundry_area: boolean;
  drying_area: boolean | null;
  water_included: boolean | null;
  electricity_included: boolean | null;
  private_bathroom: boolean | null;
  advance_months: number | null;
  deposit_months: number | null;
  has_curfew: boolean;
  curfew_time: string | null;
  smoking_allowed: boolean | null;
  safety_features: string[] | null;
  walking_minutes_to_campus_gate: number | null;
};

const boardingHouseChatSelect = `
  id,
  slug,
  name,
  address_line,
  price_min,
  price_max,
  available_slots,
  room_types,
  occupancy_policies,
  wifi,
  cooking_allowed,
  furnished,
  air_conditioning,
  laundry_area,
  drying_area,
  water_included,
  electricity_included,
  private_bathroom,
  advance_months,
  deposit_months,
  has_curfew,
  curfew_time,
  smoking_allowed,
  safety_features,
  walking_minutes_to_campus_gate
`;

const getCachedBoardingHousesForChat = unstable_cache(
  async (): Promise<BaseResult<BoardingHouseChatContext[]>> => {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client
      .from("boarding_house_listings")
      .select(boardingHouseChatSelect)
      .eq("status", "published")
      .eq("verification_status", "verified")
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error || !data) {
      return { data: null, error: normalizeError(error) };
    }

    return {
      data: (data as BoardingHouseChatRow[]).map(toBoardingHouseChatContext),
      error: null,
    };
  },
  ["boarding-houses-chat-context"],
  {
    tags: ["boarding-houses"],
    revalidate: 15 * 60,
  }
);

function toBoardingHouseChatContext(row: BoardingHouseChatRow): BoardingHouseChatContext {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    addressLine: row.address_line,
    priceMin: row.price_min,
    priceMax: row.price_max,
    availableSlots: row.available_slots,
    roomTypes: row.room_types ?? [],
    occupancyPolicies: row.occupancy_policies ?? [],
    wifi: row.wifi,
    cookingAllowed: row.cooking_allowed,
    furnished: row.furnished,
    airConditioning: row.air_conditioning,
    laundryArea: row.laundry_area,
    dryingArea: row.drying_area ?? false,
    waterIncluded: row.water_included ?? false,
    electricityIncluded: row.electricity_included ?? false,
    privateBathroom: row.private_bathroom ?? false,
    advanceMonths: row.advance_months,
    depositMonths: row.deposit_months,
    hasCurfew: row.has_curfew,
    curfewTime: row.curfew_time,
    smokingAllowed: row.smoking_allowed ?? false,
    cctv: (row.safety_features ?? []).includes("cctv"),
    walkingMinutesToCampusGate: row.walking_minutes_to_campus_gate,
  };
}

export async function getBoardingHousesForChatCached(): Promise<BaseResult<BoardingHouseChatContext[]>> {
  return getCachedBoardingHousesForChat();
}

export async function revalidateBoardingHousesCache() {
  return revalidateTag("boarding-houses", "max");
}
