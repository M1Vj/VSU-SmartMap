import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  Facility,
  FacilityCategory,
  FacilityRow,
  FacilityInsert,
  FacilityUpdate,
  FacilityWithRooms,
  FacilityPOI,
  FacilityLite,
} from "@/lib/types/facility";
import { FACILITY_CATEGORIES } from "@/lib/types/facility";
import { getSupabaseBrowserClient } from "../browser-client";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };
type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

const selectBase = () =>
  "id, code, name, slug, description, category, has_rooms, latitude, longitude, image_url, image_credit, website, facebook, phone, created_at, updated_at";

export const normalizeError = (error: PostgrestError | null) =>
  error ? { ...error, message: `Unable to request: ${error.message}` } : null;

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

function toFacility(row: FacilityRow): Facility {
  const code = row.code?.trim();
  const base = {
    id: row.id,
    code: code ? code : undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    category: row.category as FacilityCategory,
    coordinates: { lat: row.latitude, lng: row.longitude },
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    website: row.website ?? undefined,
    facebook: row.facebook ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.has_rooms) {
    return { ...base, hasRooms: true } as FacilityWithRooms;
  }
  return { ...base, hasRooms: false } as FacilityPOI;
}

function mapInsertPayload(input: FacilityInsert) {
  return {
    code: input.code ?? null,
    name: input.name,
    slug: input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"),
    description: input.description ?? null,
    category: input.category,
    has_rooms: input.hasRooms,
    latitude: input.coordinates.lat,
    longitude: input.coordinates.lng,
    image_url: input.imageUrl ?? null,
    image_credit: input.imageCredit ?? null,
    website: input.website ?? null,
    facebook: input.facebook ?? null,
    phone: input.phone ?? null,
  };
}

function mapUpdatePayload(input: FacilityUpdate) {
  const patch: Record<string, unknown> = {};
  if (input.code !== undefined) patch.code = input.code ?? null;
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.hasRooms !== undefined) patch.has_rooms = input.hasRooms;
  if (input.coordinates) {
    patch.latitude = input.coordinates.lat;
    patch.longitude = input.coordinates.lng;
  }
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl ?? null;
  if (input.imageCredit !== undefined) patch.image_credit = input.imageCredit ?? null;
  if (input.website !== undefined) patch.website = input.website ?? null;
  if (input.facebook !== undefined) patch.facebook = input.facebook ?? null;
  if (input.phone !== undefined) patch.phone = input.phone ?? null;
  return patch;
}

export type RoomChatContext = {
  roomCode: string;
  name?: string;
};

export type FacilityChatContext = Pick<Facility, "id" | "name" | "category" | "description" | "code"> & {
  rooms?: RoomChatContext[];
};

export async function getFacilitiesForChat(
  client?: MaybeClient
): Promise<BaseResult<FacilityChatContext[]>> {
  const resolved = await resolveClient(client);
  const { data, error } = await resolved
    .from("facilities")
    .select("id, name, code, category, description, rooms:rooms(room_code, name)")
    .order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: normalizeError(error) };
  }

  const mapped = (data as unknown as Array<{
    id: string;
    name: string;
    code: string | null;
    category: string;
    description: string | null;
    rooms: unknown;
  }>).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    code: (f.code ?? undefined) as string | undefined,
    category: f.category as FacilityCategory,
    description: (f.description ?? undefined) as string | undefined,
    rooms: Array.isArray(f.rooms) && f.rooms.length > 0
      ? (f.rooms as unknown as Array<{ room_code: string; name: string | null }>).map((r) => ({
        roomCode: r.room_code,
        name: r.name ?? undefined,
      }))
      : undefined,
  }));

  return { data: mapped, error: null };
}

export async function getFacilities(params?: {
  category?: FacilityCategory | FacilityCategory[];
  hasRooms?: boolean;
  client?: MaybeClient;
}): Promise<BaseResult<Facility[]>> {
  const client = await resolveClient(params?.client);
  const query = client.from("facilities").select(selectBase());

  if (params?.category) {
    if (Array.isArray(params.category)) {
      query.in("category", params.category);
    } else {
      query.eq("category", params.category);
    }
  }

  if (params?.hasRooms !== undefined) {
    query.eq("has_rooms", params.hasRooms);
  }

  const { data, error } = await query.order("name", { ascending: true });
  const rows = data as FacilityRow[] | null;
  return { data: rows ? rows.map(toFacility) : null, error: normalizeError(error) };
}

function toFacilityLite(row: FacilityRow): FacilityLite {
  const code = row.code?.trim();
  const base = {
    id: row.id,
    code: code ? code : undefined,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    category: row.category as FacilityCategory,
    coordinates: { lat: row.latitude, lng: row.longitude },
    imageUrl: row.image_url ?? undefined,
  };

  if (row.has_rooms) {
    return { ...base, hasRooms: true };
  }
  return { ...base, hasRooms: false };
}

export async function getFacilitiesLite(params?: {
  category?: FacilityCategory | FacilityCategory[];
  hasRooms?: boolean;
  client?: MaybeClient;
}): Promise<BaseResult<FacilityLite[]>> {
  const client = await resolveClient(params?.client);
  const query = client.from("facilities").select(
    "id, code, name, slug, description, category, has_rooms, latitude, longitude, image_url"
  );

  if (params?.category) {
    if (Array.isArray(params.category)) {
      query.in("category", params.category);
    } else {
      query.eq("category", params.category);
    }
  }

  if (params?.hasRooms !== undefined) {
    query.eq("has_rooms", params.hasRooms);
  }

  const { data, error } = await query.order("name", { ascending: true });
  const rows = data as FacilityRow[] | null;
  return {
    data: rows ? rows.map(toFacilityLite) : null,
    error: normalizeError(error),
  };
}

export async function getBuildings(params?: {
  category?: FacilityCategory | FacilityCategory[];
  client?: MaybeClient;
}): Promise<BaseResult<FacilityWithRooms[]>> {
  const result = await getFacilities({
    ...params,
    hasRooms: true,
  });
  return {
    data: result.data as FacilityWithRooms[] | null,
    error: result.error,
  };
}

export async function getPOIs(params?: {
  category?: FacilityCategory | FacilityCategory[];
  client?: MaybeClient;
}): Promise<BaseResult<FacilityPOI[]>> {
  const result = await getFacilities({
    ...params,
    hasRooms: false,
  });
  return {
    data: result.data as FacilityPOI[] | null,
    error: result.error,
  };
}

export async function getFacilityById(params: {
  id: string;
  client?: MaybeClient;
}): Promise<BaseResult<Facility>> {
  const client = await resolveClient(params.client);
  const { data, error } = await client
    .from("facilities")
    .select(selectBase())
    .eq("id", params.id)
    .maybeSingle();

  const row = data as FacilityRow | null;
  return { data: row ? toFacility(row) : null, error: normalizeError(error) };
}

export async function getFacilityBySlug(params: {
  slug: string;
  client?: MaybeClient;
}): Promise<BaseResult<Facility>> {
  const client = await resolveClient(params.client);
  const { data, error } = await client
    .from("facilities")
    .select(selectBase())
    .eq("slug", params.slug)
    .maybeSingle();

  const row = data as FacilityRow | null;
  return { data: row ? toFacility(row) : null, error: normalizeError(error) };
}

export async function createFacility(
  input: FacilityInsert,
  client?: MaybeClient,
): Promise<BaseResult<Facility>> {
  const supabase = await resolveClient(client);
  const insertPayload = mapInsertPayload(input);
  const { data, error } = await supabase
    .from("facilities")
    .insert(insertPayload)
    .select(selectBase())
    .maybeSingle();

  const row = data as FacilityRow | null;
  return { data: row ? toFacility(row) : null, error: normalizeError(error) };
}

export async function updateFacility(
  id: string,
  input: FacilityUpdate,
  client?: MaybeClient,
): Promise<BaseResult<Facility>> {
  const supabase = await resolveClient(client);
  const updatePayload = mapUpdatePayload(input);

  const { data, error } = await supabase
    .from("facilities")
    .update(updatePayload)
    .eq("id", id)
    .select(selectBase())
    .maybeSingle();

  const row = data as FacilityRow | null;
  return { data: row ? toFacility(row) : null, error: normalizeError(error) };
}

export async function deleteFacility(
  id: string,
  client?: MaybeClient,
): Promise<BaseResult<Facility>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("facilities")
    .delete()
    .eq("id", id)
    .select(selectBase())
    .maybeSingle();

  const row = data as FacilityRow | null;
  return { data: row ? toFacility(row) : null, error: normalizeError(error) };
}

export async function getFacilitiesByIds(params: {
  ids: string[];
  client?: MaybeClient;
}): Promise<BaseResult<Facility[]>> {
  if (!params.ids.length) {
    return { data: [], error: null };
  }

  const client = await resolveClient(params.client);
  const { data, error } = await client
    .from("facilities")
    .select(selectBase())
    .in("id", params.ids);

  const rows = data as FacilityRow[] | null;
  return { data: rows ? rows.map(toFacility) : [], error: normalizeError(error) };
}

export function isValidCategory(category: string): category is FacilityCategory {
  return (FACILITY_CATEGORIES as readonly string[]).includes(category);
}
