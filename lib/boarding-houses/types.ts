import type { LatLng } from "@/lib/types/common";

export const BOARDING_HOUSE_ROOM_TYPES = [
  "bedspace",
  "shared_room",
  "private_room",
  "studio",
  "whole_unit",
] as const;

export type BoardingHouseRoomType = (typeof BOARDING_HOUSE_ROOM_TYPES)[number];

export const BOARDING_HOUSE_OCCUPANCY_POLICIES = [
  "any_gender",
  "female_only",
  "male_only",
  "family_only",
] as const;

export type BoardingHouseOccupancyPolicy =
  (typeof BOARDING_HOUSE_OCCUPANCY_POLICIES)[number];

export const BOARDING_HOUSE_SAFETY_FEATURES = [
  "cctv",
  "fire_extinguisher",
  "smoke_detector",
  "fire_alarm",
  "emergency_exit",
  "emergency_lights",
  "sprinkler",
  "fenced_property",
] as const;

export type BoardingHouseSafetyFeature =
  (typeof BOARDING_HOUSE_SAFETY_FEATURES)[number];

export const BOARDING_HOUSE_SAFETY_FEATURE_LABELS: Record<
  BoardingHouseSafetyFeature,
  string
> = {
  cctv: "CCTV",
  fire_extinguisher: "Fire extinguisher",
  smoke_detector: "Smoke detector",
  fire_alarm: "Fire alarm",
  emergency_exit: "Emergency exit",
  emergency_lights: "Emergency lights",
  sprinkler: "Sprinkler",
  fenced_property: "Fenced property",
};

export const BOARDING_HOUSE_MOBILE_CARRIERS = ["smart", "globe", "dito"] as const;

export type BoardingHouseMobileCarrier =
  (typeof BOARDING_HOUSE_MOBILE_CARRIERS)[number];

export const BOARDING_HOUSE_MOBILE_CARRIER_LABELS: Record<
  BoardingHouseMobileCarrier,
  string
> = {
  smart: "Smart/TNT",
  globe: "Globe/TM",
  dito: "DITO",
};

export type BoardingHousePublicationStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "unpublished"
  | "suspended";

export type BoardingHouseVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

export interface BoardingHouseAmenities {
  readonly wifi: boolean;
  readonly cookingAllowed: boolean;
  readonly furnished: boolean;
  readonly airConditioning: boolean;
  readonly laundryArea: boolean;
  readonly dryingArea: boolean;
  readonly parking: boolean;
  readonly studyArea: boolean;
}

export interface BoardingHouseRules {
  readonly hasCurfew: boolean;
  readonly curfewTime: string | null;
  readonly allowsVisitors: boolean;
  readonly allowsPets: boolean;
  readonly smokingAllowed: boolean;
}

export interface BoardingHouseSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: BoardingHousePublicationStatus;
  readonly verificationStatus: BoardingHouseVerificationStatus;
  readonly addressLine: string;
  readonly coordinates: LatLng;
  readonly thumbnailUrl: string | null;
  readonly coverPhotoBucket: string | null;
  readonly coverPhotoPath: string | null;
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly priceChangedAt: string | null;
  readonly availableSlots: number | null;
  readonly roomTypes: readonly BoardingHouseRoomType[];
  readonly occupancyPolicies: readonly BoardingHouseOccupancyPolicy[];
  readonly amenities: BoardingHouseAmenities;
  readonly rules: BoardingHouseRules;
  readonly walkingMinutesToCampusGate: number | null;
  readonly ownerDisplayName: string;
  readonly averageRating: number;
  readonly reviewCount: number;
  readonly waterIncluded?: boolean;
  readonly electricityIncluded?: boolean;
  readonly privateBathroom?: boolean;
  readonly advanceMonths?: number | null;
  readonly depositMonths?: number | null;
  readonly safetyFeatures: readonly BoardingHouseSafetyFeature[];
  readonly applianceFee: number | null;
  readonly mobileCarriers: readonly BoardingHouseMobileCarrier[];
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

export interface BoardingHouseDetail extends BoardingHouseSummary {
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactFacebook: string | null;
  readonly contactEmail: string | null;
  readonly photos: readonly BoardingHousePhoto[];
  readonly offerings: readonly BoardingHouseOffering[];
}

export interface BoardingHousePhoto {
  readonly id: string;
  readonly url: string;
  readonly alt: string;
  readonly sortOrder: number;
  readonly storageBucket: string;
  readonly storagePath: string;
}

export interface BoardingHouseOffering {
  readonly id: string;
  readonly listingId: string;
  readonly roomType: BoardingHouseRoomType;
  readonly label: string;
  readonly monthlyPrice: number;
  readonly availableSlots: number;
  readonly occupancyPolicy: BoardingHouseOccupancyPolicy;
  readonly capacity?: number | null;
  readonly sizeSqm?: number | null;
  readonly hasAircon?: boolean;
  readonly privateBathroom?: boolean;
  readonly imagePath?: string | null;
  readonly imageUrl?: string | null;
}

export interface BoardingHouseReview {
  readonly id: string;
  readonly listingId: string;
  readonly authorDisplayName: string;
  readonly rating: number;
  readonly body: string;
  readonly isVerifiedStay: boolean;
  readonly createdAt: string;
}

export interface BoardingHouseFilters {
  readonly showOnMap: boolean;
  readonly query: string;
  readonly minMonthlyPrice: number | null;
  readonly maxMonthlyPrice: number | null;
  readonly minAvailableSlots: number | null;
  readonly roomTypes: readonly BoardingHouseRoomType[];
  readonly occupancyPolicies: readonly BoardingHouseOccupancyPolicy[];
  readonly waterIncluded: boolean;
  readonly electricityIncluded: boolean;
  readonly wifi: boolean;
  readonly cookingAllowed: boolean;
  readonly furnished: boolean;
  readonly airConditioning: boolean;
  readonly privateBathroom: boolean;
  readonly allowsNoCurfew: boolean;
  readonly dryingArea: boolean;
  readonly smokingAllowed: boolean;
  readonly cctv: boolean;
}

export interface BoardingHouseMapEntity {
  readonly kind: "boarding_house";
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly coordinates: LatLng;
  readonly summary: BoardingHouseSummary;
}
