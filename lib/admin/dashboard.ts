import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type AdminStats = {
  facilities: number;
  rooms: number;
  events: number;
  pendingSubmissions: number;
  pendingEventSuggestions: number;
};

export type AdminSubmission = {
  id: string;
  type: string;
  suggestedName: string;
  status: string;
  createdAt: string;
  source?: string;
};

function extractSuggestionName(payload: Record<string, unknown> | null): string {
  if (!payload) return "Unnamed suggestion";

  const isDeleted = payload.deleted === true;
  let baseName = "Unnamed suggestion";

  const nameField = payload.name;
  if (nameField) {
    if (typeof nameField === "object" && nameField !== null && "to" in nameField) {
      baseName = String((nameField as { to: unknown }).to);
    } else {
      baseName = String(nameField);
    }
  } else {
    const roomCodeField = payload.roomCode;
    if (roomCodeField) {
      if (typeof roomCodeField === "object" && roomCodeField !== null && "to" in roomCodeField) {
        baseName = `Room ${String((roomCodeField as { to: unknown }).to)}`;
      } else {
        baseName = `Room ${String(roomCodeField)}`;
      }
    }
  }

  if (isDeleted) {
    return `${baseName} (Deleted)`;
  }

  return baseName;
}

export async function getAdminStats(): Promise<AdminStats> {
  let client;
  try {
    const admin = await getSupabaseAdminClient({ requireServiceRole: true });
    client = admin.client;
  } catch (error) {
    console.error("Failed to get admin client for stats:", error);
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin dashboard. Add it to .env.local and restart."
    );
  }

  const [
    facilitiesResult,
    roomsResult,
    pendingSubmissionsResult,
    eventsResult,
    pendingEventSuggestionsResult,
  ] = await Promise.all([
    client.from("facilities").select("id", { count: "exact", head: true }),
    client.from("rooms").select("id", { count: "exact", head: true }),
    client
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    client.from("events").select("id", { count: "exact", head: true }),
    client
      .from("event_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  if (eventsResult.error) {
    console.warn("[getAdminStats] Failed to count events:", eventsResult.error.message);
  }

  if (pendingEventSuggestionsResult.error) {
    console.warn(
      "[getAdminStats] Failed to count event suggestions:",
      pendingEventSuggestionsResult.error.message
    );
  }

  return {
    facilities: facilitiesResult.count ?? 0,
    rooms: roomsResult.count ?? 0,
    events: eventsResult.error ? 0 : eventsResult.count ?? 0,
    pendingSubmissions: pendingSubmissionsResult.count ?? 0,
    pendingEventSuggestions: pendingEventSuggestionsResult.error
      ? 0
      : pendingEventSuggestionsResult.count ?? 0,
  };
}

export async function getRecentSubmissions(limit = 5): Promise<AdminSubmission[]> {
  let client;
  try {
    const admin = await getSupabaseAdminClient({ requireServiceRole: true });
    client = admin.client;
  } catch (error) {
    console.error("Failed to get admin client for submissions:", error);
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin dashboard. Add it to .env.local and restart."
    );
  }

  const { data } = await client
    .from("suggestions")
    .select("id, payload, status, type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (
    data?.map((row) => {
      const payload = row.payload as Record<string, unknown> | null;
      const name = extractSuggestionName(payload);

      return {
        id: row.id,
        type: row.type,
        suggestedName: name,
        status: row.status,
        createdAt: row.created_at,
        source: (payload?.source as string) ?? "USER",
      };
    }) ?? []
  );
}
