import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { roomSchema } from "@/lib/validation";
import { getSupabaseBrowserClient } from "../browser-client";

export type RoomRow = {
  id: string;
  facility_id: string;
  room_code: string;
  name: string | null;
  description: string | null;
  floor: number | null;
  image_url: string | null;
  image_credit: string | null;
  created_at: string;
  updated_at: string;
};

type FacilitySummary = {
  id: string;
  name: string;
  slug: string;
};

export type RoomRowWithFacility = RoomRow & {
  facility: FacilitySummary | null;
};

type BaseResult<T> = { data: T | null; error: PostgrestError | null };
type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

const selectBase = () =>
  "id, facility_id, room_code, name, description, floor, image_url, image_credit, created_at, updated_at";
const selectWithFacility = () =>
  `${selectBase()}, facility:facilities(id, name, slug)`;

const toPostgrestError = (message: string): PostgrestError => ({
  name: "PostgrestError",
  message,
  details: "",
  hint: "",
  code: "PGRST_INVALID_INPUT",
});

const normalizeError = (error: PostgrestError | null) =>
  error ? { ...error, message: "Unable to complete room request" } : null;

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

const mapInsert = (payload: unknown) => {
  const parsed = roomSchema.parse(payload);
  return {
    facility_id: parsed.facilityId,
    room_code: parsed.roomCode,
    name: parsed.name || null,
    description: parsed.description || null,
    floor: parsed.floor ?? null,
    image_url: parsed.imageUrl || null,
    image_credit: parsed.imageCredit || null,
  };
};

const mapUpdate = (payload: unknown) => {
  const parsed = roomSchema.partial().parse(payload);
  const patch: Record<string, unknown> = {};

  if (parsed.facilityId !== undefined) patch.facility_id = parsed.facilityId;
  if (parsed.roomCode !== undefined) patch.room_code = parsed.roomCode;
  if (parsed.name !== undefined) patch.name = parsed.name || null;
  if (parsed.description !== undefined) patch.description = parsed.description || null;
  if (parsed.floor !== undefined) patch.floor = parsed.floor;
  if (parsed.imageUrl !== undefined) patch.image_url = parsed.imageUrl || null;
  if (parsed.imageCredit !== undefined) patch.image_credit = parsed.imageCredit || null;

  return patch;
};

/**
 * Get all rooms for a facility.
 */
export async function getRoomsByFacility(params: {
  facilityId: string;
  includeFacility?: boolean;
  client?: MaybeClient;
}): Promise<BaseResult<RoomRow[] | RoomRowWithFacility[]>> {
  const client = await resolveClient(params.client);
  const { data, error } = await client
    .from("rooms")
    .select(params.includeFacility ? selectWithFacility() : selectBase())
    .eq("facility_id", params.facilityId)
    .order("room_code", { ascending: true });

  return {
    data: data as RoomRow[] | RoomRowWithFacility[] | null,
    error: normalizeError(error),
  };
}

export async function getRoomById(params: {
  id: string;
  includeFacility?: boolean;
  client?: MaybeClient;
}): Promise<BaseResult<RoomRow | RoomRowWithFacility>> {
  const client = await resolveClient(params.client);
  const { data, error } = await client
    .from("rooms")
    .select(params.includeFacility ? selectWithFacility() : selectBase())
    .eq("id", params.id)
    .maybeSingle();

  return {
    data: data as RoomRow | RoomRowWithFacility | null,
    error: normalizeError(error),
  };
}

export async function searchRooms(params: {
  term: string;
  facilityId?: string;
  includeFacility?: boolean;
  client?: MaybeClient;
}): Promise<BaseResult<RoomRow[] | RoomRowWithFacility[]>> {
  const client = await resolveClient(params.client);
  const query = client
    .from("rooms")
    .select(params.includeFacility ? selectWithFacility() : selectBase())
    .or(`room_code.ilike.%${params.term}%,description.ilike.%${params.term}%`)
    .order("room_code", { ascending: true });

  if (params.facilityId) {
    query.eq("facility_id", params.facilityId);
  }

  const { data, error } = await query;
  return {
    data: data as RoomRow[] | RoomRowWithFacility[] | null,
    error: normalizeError(error),
  };
}

export async function createRoom(
  payload: unknown,
  client?: MaybeClient,
): Promise<BaseResult<RoomRow>> {
  try {
    const supabase = await resolveClient(client);
    const insertPayload = mapInsert(payload);

    const { data, error } = await supabase
      .from("rooms")
      .insert(insertPayload)
      .select(selectBase())
      .single();

    return { data: data as RoomRow | null, error: normalizeError(error) };
  } catch (err) {
    return {
      data: null,
      error: toPostgrestError(err instanceof Error ? err.message : "Invalid room payload"),
    };
  }
}

export async function updateRoom(
  payload: { id: string } & Record<string, unknown>,
  client?: MaybeClient,
): Promise<BaseResult<RoomRow>> {
  const { id, ...rest } = payload;

  try {
    const supabase = await resolveClient(client);
    const updatePayload = mapUpdate(rest);

    const { data, error } = await supabase
      .from("rooms")
      .update(updatePayload)
      .eq("id", id)
      .select(selectBase())
      .single();

    return { data: data as RoomRow | null, error: normalizeError(error) };
  } catch (err) {
    return {
      data: null,
      error: toPostgrestError(err instanceof Error ? err.message : "Invalid room payload"),
    };
  }
}

export async function deleteRoom(
  id: string,
  client?: MaybeClient,
): Promise<BaseResult<RoomRow>> {
  const supabase = await resolveClient(client);

  const { data, error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", id)
    .select(selectBase())
    .single();

  return { data: data as RoomRow | null, error: normalizeError(error) };
}
