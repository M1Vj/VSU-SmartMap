import type { AuditFields, LatLng } from "./common";
import type { Room } from "./room";

/**
 * Unified facility categories matching the database enum.
 * Categories aligned with VSU campus data.
 */
export const FACILITY_CATEGORIES = [
  // Buildings with rooms (has_rooms = true)
  'academic',
  'administrative',
  'research',
  'office',
  'residential',
  'dormitory',
  'lodging',
  // Facilities/POIs (has_rooms = false typically)
  'sports',
  'dining',
  'library',
  'medical',
  'parking',
  'landmark',
  'religious',
  'utility',
  'commercial',
  'transportation',
  'atm',
  'other'
] as const;

export type FacilityCategory = typeof FACILITY_CATEGORIES[number];

/** Categories that typically represent buildings with rooms */
export const BUILDING_FACILITY_CATEGORIES: readonly FacilityCategory[] = [
  'academic', 'administrative', 'research', 'office', 'residential', 'dormitory', 'lodging', 'library'
] as const;

/** Categories that typically represent POIs without rooms */
export const POI_FACILITY_CATEGORIES: readonly FacilityCategory[] = [
  'sports', 'dining', 'medical', 'parking', 'landmark',
  'religious', 'utility', 'commercial', 'transportation', 'atm', 'other'
] as const;

/**
 * Base facility interface with shared fields for all facilities.
 */
export interface BaseFacility extends AuditFields {
  readonly id: string;
  readonly code?: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly category: FacilityCategory;
  readonly coordinates: LatLng;
  readonly imageUrl?: string;
  readonly imageCredit?: string;
  readonly website?: string;
  readonly facebook?: string;
  readonly phone?: string;
}

/**
 * Facility that contains rooms (buildings).
 */
export interface FacilityWithRooms extends BaseFacility {
  readonly hasRooms: true;
  readonly rooms?: readonly Room[];
}

/**
 * Facility without rooms (POIs/amenities).
 */
export interface FacilityPOI extends BaseFacility {
  readonly hasRooms: false;
}

/**
 * Unified Facility type using discriminated union.
 */
export type Facility = FacilityWithRooms | FacilityPOI;



export function isFacilityWithRooms(facility: Facility): facility is FacilityWithRooms {
  return facility.hasRooms === true;
}

export function isFacilityPOI(facility: Facility): facility is FacilityPOI {
  return facility.hasRooms === false;
}

export function isBuildingCategory(category: FacilityCategory): boolean {
  return (BUILDING_FACILITY_CATEGORIES as readonly string[]).includes(category);
}



export type FacilitySummary = Pick<
  Facility,
  "id" | "code" | "slug" | "name" | "category" | "coordinates" | "hasRooms"
>;

export interface FacilityMarkerPayload {
  readonly id: string;
  readonly code?: string;
  readonly name: string;
  readonly category: FacilityCategory;
  readonly coordinates: LatLng;
  readonly hasRooms: boolean;
}

export type FacilityLite = Pick<
  Facility,
  "id" | "code" | "slug" | "name" | "description" | "category" | "coordinates" | "hasRooms" | "imageUrl"
>;



export interface FacilityRow {
  id: string;
  code: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  has_rooms: boolean;
  latitude: number;
  longitude: number;
  image_url: string | null;
  image_credit: string | null;
  website: string | null;
  facebook: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}



export interface FacilityInsert {
  code?: string | null;
  name: string;
  slug?: string;
  description?: string | null;
  category: FacilityCategory;
  hasRooms: boolean;
  coordinates: LatLng;
  imageUrl?: string | null;
  imageCredit?: string | null;
  website?: string | null;
  facebook?: string | null;
  phone?: string | null;
}

export type FacilityUpdate = Partial<FacilityInsert>;
