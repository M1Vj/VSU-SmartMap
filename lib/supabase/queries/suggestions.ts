import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  Suggestion,
  SuggestionInsert,
  SuggestionRow,
  SuggestionStatus,
  SuggestionType,
} from "@/lib/types/suggestion";
import { getSupabaseBrowserClient } from "../browser-client";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };
type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

const selectBase =
  "id, type, status, target_id, payload, admin_note, created_at, updated_at";

const normalizeError = (error: PostgrestError | null) => (error ? { ...error } : null);

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

export const toSuggestion = (row: SuggestionRow): Suggestion => ({
  id: row.id,
  type: row.type,
  status: row.status,
  targetId: row.target_id,
  payload: row.payload ?? {},
  adminNote: row.admin_note ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapInsertPayload = (input: SuggestionInsert) => ({
  id: input.id ?? undefined,
  type: input.type,
  status: input.status ?? "PENDING",
  target_id: input.targetId ?? null,
  payload: input.payload ?? {},
  ...(input.adminNote ? { admin_note: input.adminNote } : {}),
});

export async function createSuggestion(
  input: SuggestionInsert,
  client?: MaybeClient,
): Promise<BaseResult<Suggestion>> {
  const supabase = await resolveClient(client);
  const insertPayload = mapInsertPayload(input);

  const { data, error } = await supabase
    .from("suggestions")
    .insert(insertPayload)
    .select(selectBase)
    .single();

  const row = data as SuggestionRow | null;
  return { data: row ? toSuggestion(row) : null, error: normalizeError(error) };
}

export async function getSuggestions(params?: {
  status?: SuggestionStatus | SuggestionStatus[];
  type?: SuggestionType | SuggestionType[];
  targetId?: string;
  client?: MaybeClient;
}): Promise<BaseResult<Suggestion[]>> {
  const supabase = await resolveClient(params?.client);
  const query = supabase.from("suggestions").select(selectBase);

  if (params?.status) {
    if (Array.isArray(params.status)) {
      query.in("status", params.status);
    } else {
      query.eq("status", params.status);
    }
  }

  if (params?.type) {
    if (Array.isArray(params.type)) {
      query.in("type", params.type);
    } else {
      query.eq("type", params.type);
    }
  }

  if (params?.targetId) {
    query.eq("target_id", params.targetId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  const rows = data as SuggestionRow[] | null;

  return {
    data: rows ? rows.map(toSuggestion) : [],
    error: normalizeError(error),
  };
}

export async function getSuggestionById(
  id: string,
  client?: MaybeClient,
): Promise<BaseResult<Suggestion>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("suggestions")
    .select(selectBase)
    .eq("id", id)
    .maybeSingle();

  const row = data as SuggestionRow | null;
  return { data: row ? toSuggestion(row) : null, error: normalizeError(error) };
}

export async function updateSuggestion(
  id: string,
  input: Partial<SuggestionInsert>,
  client?: MaybeClient,
): Promise<BaseResult<Suggestion>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("suggestions")
    .update({
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.targetId !== undefined ? { target_id: input.targetId } : {}),
      ...(input.payload ? { payload: input.payload } : {}),
      ...(input.adminNote !== undefined ? { admin_note: input.adminNote } : {}),
    })
    .eq("id", id)
    .select(selectBase)
    .maybeSingle();

  const row = data as SuggestionRow | null;
  return { data: row ? toSuggestion(row) : null, error: normalizeError(error) };
}

export async function pruneHistory(params: {
  targetId: string;
  type: SuggestionType | SuggestionType[];
  limit: number;
  client?: MaybeClient;
}): Promise<void> {
  const supabase = await resolveClient(params.client);
  const types = Array.isArray(params.type) ? params.type : [params.type];

  const { data: keepIds } = await supabase
    .from("suggestions")
    .select("id")
    .eq("target_id", params.targetId)
    .in("type", types)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (!keepIds || keepIds.length < params.limit) {
    return;
  }

  const idsToKeep = (keepIds as unknown as Array<{ id: string }>).map((row) => row.id);

  const { data: allEntries } = await supabase
    .from("suggestions")
    .select("id")
    .eq("target_id", params.targetId)
    .in("type", types);

  if (!allEntries) return;

  const idsToDelete = (allEntries as unknown as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => !idsToKeep.includes(id));

  if (idsToDelete.length > 0) {
    await supabase
      .from("suggestions")
      .delete()
      .in("id", idsToDelete);
  }
}
