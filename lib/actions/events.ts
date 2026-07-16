"use server";

import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { assertAdminAction } from "@/lib/auth/server";
import { consumeRateLimit, hashRateLimitSubject } from "@/lib/security/rate-limit";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  Event,
  EventRow,
  EventSuggestion,
  EventSuggestionRow,
  EventFilters,
  SuggestionStatus,
} from "@/lib/types/events";

type SerializablePostgrestError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

type BaseResult<T> = { data: T | null; error: SerializablePostgrestError | null };

const normalizeError = (error: PostgrestError | Error | null): SerializablePostgrestError | null => {
  if (!error) return null;
  
  const message = error.message || "An unknown error occurred";
  
  if (message.includes("public.event_suggestions") || message.includes("public.events")) {
    return {
      message: `${message}. Please ensure the database migrations for the events system have been applied.`,
      code: 'code' in error ? (error as any).code : undefined,
    };
  }

  if (message.toLowerCase().includes("bucket not found")) {
    return {
      message: `${message}. Storage bucket is missing. Consolidating to smartmap-bucket.`,
      code: 'code' in error ? (error as any).code : undefined,
    };
  }

  return {
    message,
    details: 'details' in error ? (error as any).details : undefined,
    hint: 'hint' in error ? (error as any).hint : undefined,
    code: 'code' in error ? (error as any).code : undefined,
  };
};

const toEvent = (row: EventRow): Event => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
  locationText: row.location_text,
  locationId: row.location_id,
  category: row.category,
  imageUrl: row.image_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toEventSuggestion = (row: EventSuggestionRow): EventSuggestion => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
  locationText: row.location_text,
  category: row.category,
  proofAvailable: Boolean(
    !row.proof_deleted_at && (row.proof_object_path || row.proof_file_url),
  ),
  status: row.status,
  submittedBy: row.submitted_by,
  createdAt: row.created_at,
});

const eventSelectBase =
  "id, title, description, start_time, end_time, location_text, location_id, category, image_url, created_at, updated_at";

const suggestionSelectBase =
  "id, title, description, start_time, end_time, location_text, category, proof_file_url, proof_object_path, decided_at, proof_retain_until, proof_deleted_at, status, submitted_by, created_at";

const EVENTS_CACHE_TAG = "events";
const EVENTS_CACHE_SECONDS = 5 * 60;

export async function getEvents(
  filters?: EventFilters
): Promise<BaseResult<Event[]>> {
  try {
    const supabase = getSupabaseServiceRoleClient();
    let query = supabase.from("events").select(eventSelectBase);

    const nowIso = new Date().toISOString();
    if (filters?.timeframe === "upcoming") {
      query = query.gte("end_time", nowIso);
    } else if (filters?.timeframe === "past") {
      query = query.lt("end_time", nowIso);
    }

    if (filters?.category) {
      if (Array.isArray(filters.category)) {
        query = query.in("category", filters.category);
      } else {
        query = query.eq("category", filters.category);
      }
    }

    if (filters?.query) {
      query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
    }

    if (filters?.startDate) {
      query = query.gte("start_time", filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte("end_time", filters.endDate.toISOString());
    }

    const sortAscending = filters?.timeframe !== "past";
    const { data, error } = await query.order("start_time", { ascending: sortAscending });
    
    const rows = data as EventRow[] | null;
    return {
      data: rows ? rows.map(toEvent) : [],
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: [],
      error: normalizeError(err instanceof Error ? err : new Error("Failed to fetch events")),
    };
  }
}

export const getEventsCached = unstable_cache(
  async (filters?: EventFilters) => getEvents(filters),
  ["events"],
  {
    revalidate: EVENTS_CACHE_SECONDS,
    tags: [EVENTS_CACHE_TAG],
  }
);

const eventInsertSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  locationText: z.string().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  category: z.enum(["academic", "sports", "cultural", "religious", "other"]),
  imageUrl: z.string().optional().nullable(),
});

export async function createEvent(
  data: unknown
): Promise<BaseResult<Event>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: null, error: normalizeError(new Error(session.error)) };
    }

    const parsed = eventInsertSchema.safeParse(data);
    if (!parsed.success) {
      return {
        data: null,
        error: normalizeError(new Error(`Invalid event data: ${parsed.error.message}`)),
      };
    }

    const insertData = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      location_text: parsed.data.locationText ?? null,
      location_id: parsed.data.locationId ?? null,
      category: parsed.data.category,
      image_url: parsed.data.imageUrl ?? null,
    };

    const adminClient = session.serviceClient;
    const { data: eventData, error } = await adminClient
      .from("events")
      .insert(insertData)
      .select(eventSelectBase)
      .single();

    if (error) return { data: null, error: normalizeError(error) };

    const row = eventData as EventRow | null;
    
    if (row) {
      updateTag(EVENTS_CACHE_TAG);
      revalidatePath("/events");
      revalidatePath("/admin/events");
    }

    return {
      data: row ? toEvent(row) : null,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(err instanceof Error ? err : new Error("Failed to create event")),
    };
  }
}

export async function updateEvent(
  id: string,
  data: unknown
): Promise<BaseResult<Event>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: null, error: normalizeError(new Error(session.error)) };
    }

    const parsed = eventInsertSchema.partial().safeParse(data);
    if (!parsed.success) {
      return {
        data: null,
        error: normalizeError(new Error(`Invalid event data: ${parsed.error.message}`)),
      };
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.startTime !== undefined) updateData.start_time = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) updateData.end_time = parsed.data.endTime;
    if (parsed.data.locationText !== undefined) updateData.location_text = parsed.data.locationText;
    if (parsed.data.locationId !== undefined) updateData.location_id = parsed.data.locationId;
    if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
    if (parsed.data.imageUrl !== undefined) updateData.image_url = parsed.data.imageUrl;

    const adminClient = session.serviceClient;
    const { data: eventData, error } = await adminClient
      .from("events")
      .update(updateData)
      .eq("id", id)
      .select(eventSelectBase)
      .single();

    const row = eventData as EventRow | null;
    
    if (row) {
      updateTag(EVENTS_CACHE_TAG);
      revalidatePath("/events");
      revalidatePath("/admin/events");
    }

    return {
      data: row ? toEvent(row) : null,
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(err instanceof Error ? err : new Error("Failed to update event")),
    };
  }
}

export async function deleteEvent(id: string): Promise<BaseResult<void>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: null, error: normalizeError(new Error(session.error)) };
    }

    const adminClient = session.serviceClient;
    const { error } = await adminClient
      .from("events")
      .delete()
      .eq("id", id);

    if (!error) {
      updateTag(EVENTS_CACHE_TAG);
      revalidatePath("/events");
      revalidatePath("/admin/events");
    }

    return {
      data: error ? null : undefined as unknown as void,
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(err instanceof Error ? err : new Error("Failed to delete event")),
    };
  }
}

const suggestionInsertSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  locationText: z.string().max(300).optional().nullable(),
  category: z.enum(["academic", "sports", "cultural", "religious", "other"]),
  uploadId: z.string().uuid(),
}).strict().refine(
  (value) => new Date(value.endTime).getTime() > new Date(value.startTime).getTime(),
  { message: "End time must follow start time." },
);

const GENERIC_SUGGESTION_ERROR = "Unable to submit suggestion. Please try again.";

function submissionClientIp(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

export async function submitEventSuggestion(
  data: unknown
): Promise<BaseResult<EventSuggestion>> {
  try {
    const parsed = suggestionInsertSchema.safeParse(data);
    if (!parsed.success) {
      return {
        data: null,
        error: normalizeError(new Error(GENERIC_SUGGESTION_ERROR)),
      };
    }

    const requestHeaders = await headers();
    const ip = submissionClientIp(requestHeaders);
    const ownerHash = hashRateLimitSubject(ip);
    if (!ownerHash) {
      return { data: null, error: normalizeError(new Error(GENERIC_SUGGESTION_ERROR)) };
    }

    const quota = await consumeRateLimit({
      scope: "public:event-suggestion",
      subject: ip,
      requestLimit: 6,
      windowSeconds: 60 * 60,
    });
    if (!quota.allowed) {
      return { data: null, error: normalizeError(new Error(GENERIC_SUGGESTION_ERROR)) };
    }

    const adminClient = getSupabaseServiceRoleClient();
    const { data: suggestionData, error } = await adminClient
      .rpc("submit_event_suggestion", {
        p_owner_hash: ownerHash,
        p_upload_id: parsed.data.uploadId,
        p_title: parsed.data.title,
        p_description: parsed.data.description ?? null,
        p_start_time: parsed.data.startTime,
        p_end_time: parsed.data.endTime,
        p_location_text: parsed.data.locationText ?? null,
        p_category: parsed.data.category,
      });

    if (error || !suggestionData) {
      return { data: null, error: normalizeError(new Error(GENERIC_SUGGESTION_ERROR)) };
    }

    const row = suggestionData as EventSuggestionRow | null;
    
    if (row) {
      revalidatePath("/admin/events");
    }

    return {
      data: row ? toEventSuggestion(row) : null,
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(new Error(GENERIC_SUGGESTION_ERROR)),
    };
  }
}

export async function getEventSuggestions(
  status?: SuggestionStatus
): Promise<BaseResult<EventSuggestion[]>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: [], error: normalizeError(new Error(session.error)) };
    }

    const adminClient = session.serviceClient;
    let query = adminClient
      .from("event_suggestions")
      .select(suggestionSelectBase);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    
    const rows = data as EventSuggestionRow[] | null;
    return {
      data: rows ? rows.map(toEventSuggestion) : [],
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: [],
      error: normalizeError(err instanceof Error ? err : new Error("Failed to fetch suggestions")),
    };
  }
}

export async function approveEventSuggestion(
  id: string
): Promise<BaseResult<Event>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: null, error: normalizeError(new Error(session.error)) };
    }

    const adminClient = session.serviceClient;
    const { data: eventData, error } = await adminClient.rpc(
      "approve_event_suggestion",
      { p_suggestion_id: id },
    );
    if (error) return { data: null, error: normalizeError(error) };

    const row = eventData as EventRow | null;
    
    if (row) {
      updateTag(EVENTS_CACHE_TAG);
      revalidatePath("/events");
      revalidatePath("/admin/events");
    }

    return {
      data: row ? toEvent(row) : null,
      error: row ? null : normalizeError(new Error("Unable to approve suggestion")),
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(err instanceof Error ? err : new Error("Failed to approve suggestion")),
    };
  }
}

export async function rejectEventSuggestion(
  id: string
): Promise<BaseResult<EventSuggestion>> {
  try {
    const session = await assertAdminAction();
    if ("error" in session) {
      return { data: null, error: normalizeError(new Error(session.error)) };
    }

    const adminClient = session.serviceClient;
    const { data: suggestionData, error } = await adminClient.rpc(
      "reject_event_suggestion",
      { p_suggestion_id: id },
    );

    const row = suggestionData as EventSuggestionRow | null;
    
    if (row) {
      revalidatePath("/admin/events");
    }

    return {
      data: row ? toEventSuggestion(row) : null,
      error: normalizeError(error),
    };
  } catch (err) {
    return {
      data: null,
      error: normalizeError(err instanceof Error ? err : new Error("Failed to reject suggestion")),
    };
  }
}
