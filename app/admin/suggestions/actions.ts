"use server";

import { revalidatePath } from "next/cache";
import { baseFacilitySchema, unifiedFacilitySchema } from "@/lib/validation/facility";
import { z } from "zod";
import { roomSchema } from "@/lib/validation/room";
import { createFacility, updateFacility } from "@/lib/supabase/queries/facilities";
import { createRoom, updateRoom } from "@/lib/supabase/queries/rooms";
import { getSuggestionById, updateSuggestion } from "@/lib/supabase/queries/suggestions";
import type { FacilityCategory, FacilityInsert, FacilityUpdate } from "@/lib/types/facility";
import { deleteImage } from "@/lib/supabase/storage";
import { getFacilityById } from "@/lib/supabase/queries/facilities";
import { getRoomById } from "@/lib/supabase/queries/rooms";
import { revalidateFacilitiesCache } from "@/lib/supabase/queries/facilities.server";
import { assertAdminAction } from "@/lib/auth/server";

const GENERIC_ERROR = "Unable to process suggestion. Please try again.";

const mapFacilityInsert = (input: FacilityInsert): FacilityInsert => ({
  code: input.code ?? undefined,
  name: input.name,
  description: input.description ?? undefined,
  category: input.category as FacilityCategory,
  hasRooms: input.hasRooms,
  coordinates: input.coordinates,
  imageUrl: input.imageUrl ?? undefined,
  imageCredit: input.imageCredit ?? undefined,
  website: input.website ?? undefined,
  facebook: input.facebook ?? undefined,
  phone: input.phone ?? undefined,
  slug: input.slug,
});

const mapFacilityUpdate = (input: FacilityUpdate): FacilityUpdate => {
  const update: FacilityUpdate = {};
  if (input.code !== undefined) update.code = input.code;
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description ?? undefined;
  if (input.category !== undefined) update.category = input.category as FacilityCategory;
  if (input.hasRooms !== undefined) update.hasRooms = input.hasRooms;
  if (input.coordinates) update.coordinates = input.coordinates;
  if (input.imageUrl !== undefined) update.imageUrl = input.imageUrl ?? undefined;
  if (input.imageCredit !== undefined) update.imageCredit = input.imageCredit ?? undefined;
  if (input.website !== undefined) update.website = input.website ?? undefined;
  if (input.facebook !== undefined) update.facebook = input.facebook ?? undefined;
  if (input.phone !== undefined) update.phone = input.phone ?? undefined;
  if (input.slug !== undefined) update.slug = input.slug;
  return update;
};

export async function approveSuggestion(id: string, overridePayload?: unknown) {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };
  const client = admin.serviceClient;

  const { data: suggestion, error } = await getSuggestionById(id, client);

  if (error || !suggestion) {
    return { error: error?.message ?? GENERIC_ERROR };
  }

  if (suggestion.status !== "PENDING") {
    return { error: "Suggestion already processed." };
  }

  const payloadToUse = overridePayload ?? suggestion.payload;

  switch (suggestion.type) {
    case "ADD_FACILITY": {
      const parsed = unifiedFacilitySchema.safeParse(payloadToUse);
      if (!parsed.success) {
        return { error: "Suggestion payload is invalid." };
      }

      const payload = mapFacilityInsert(parsed.data);
      const { data, error: createError } = await createFacility(payload, client);
      if (createError || !data) {
        return { error: createError?.message ?? GENERIC_ERROR };
      }

      await updateSuggestion(id, { status: "APPROVED", targetId: data.id, payload: parsed.data }, client);
      await revalidateFacilitiesCache();
      break;
    }

    case "EDIT_FACILITY": {
      if (!suggestion.targetId) {
        return { error: "Missing target facility for edit." };
      }

      const partialSchema = baseFacilitySchema.extend({ hasRooms: z.boolean().optional() }).partial();
      const parsed = partialSchema.safeParse(payloadToUse);
      if (!parsed.success) {
        return { error: "Suggestion payload is invalid." };
      }

      // Delete old image if being replaced with a new one OR if being cleared
      const isClearing = parsed.data.imageUrl === null || parsed.data.imageUrl === '';
      const isReplacing = typeof parsed.data.imageUrl === "string" && parsed.data.imageUrl;
      if (isClearing || isReplacing) {
        const { data: currentFacility } = await getFacilityById({
          id: suggestion.targetId,
          client,
        });
        if (currentFacility?.imageUrl && (isClearing || currentFacility.imageUrl !== parsed.data.imageUrl)) {
          await deleteImage(currentFacility.imageUrl, true);
        }
      }

      const updatePayload = mapFacilityUpdate(parsed.data);
      const { error: updateError } = await updateFacility(suggestion.targetId, updatePayload, client);
      if (updateError) {
        return { error: updateError.message ?? GENERIC_ERROR };
      }

      await updateSuggestion(id, { status: "APPROVED", payload: parsed.data }, client);
      await revalidateFacilitiesCache();
      break;
    }

    case "ADD_ROOM": {
      const parsed = roomSchema.safeParse(payloadToUse);
      if (!parsed.success) {
        return { error: "Room payload is invalid." };
      }

      const { error: addRoomError } = await createRoom(parsed.data, client);
      if (addRoomError) {
        return { error: addRoomError.message ?? GENERIC_ERROR };
      }

      await updateSuggestion(id, { status: "APPROVED", payload: parsed.data }, client);
      break;
    }

    case "EDIT_ROOM": {
      if (!suggestion.targetId) {
        return { error: "Missing target room for edit." };
      }

      const parsed = roomSchema.partial().safeParse(payloadToUse);
      if (!parsed.success) {
        return { error: "Room payload is invalid." };
      }

      // Delete old room image if being replaced with a new one OR if being cleared
      const isClearing = parsed.data.imageUrl === null || parsed.data.imageUrl === '';
      const isReplacing = typeof parsed.data.imageUrl === "string" && parsed.data.imageUrl;
      if (isClearing || isReplacing) {
        const { data: currentRoom } = await getRoomById({
          id: suggestion.targetId,
          client,
        });
        if (currentRoom && "image_url" in currentRoom && currentRoom.image_url && (isClearing || currentRoom.image_url !== parsed.data.imageUrl)) {
          await deleteImage(currentRoom.image_url, true);
        }
      }

      const { error: editRoomError } = await updateRoom(
        { id: suggestion.targetId, ...parsed.data },
        client,
      );
      if (editRoomError) {
        return { error: editRoomError.message ?? GENERIC_ERROR };
      }

      await updateSuggestion(id, { status: "APPROVED", payload: parsed.data }, client);
      break;
    }

    default:
      return { error: "Unsupported suggestion type." };
  }

  revalidatePath("/admin/suggestions");
  revalidatePath(`/admin/suggestions/${id}`);
  revalidatePath("/admin/facilities");
  revalidatePath("/directory");
  revalidatePath("/");

  return { data: true };
}

export async function rejectSuggestion(id: string, reason?: string) {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };
  const client = admin.serviceClient;

  const { data: suggestion, error } = await getSuggestionById(id, client);

  if (error || !suggestion) {
    return { error: error?.message ?? GENERIC_ERROR };
  }

  if (suggestion.status !== "PENDING") {
    return { error: "Suggestion already processed." };
  }

  if (suggestion.type === "ADD_FACILITY") {
    const payload = suggestion.payload as unknown as FacilityInsert;
    if (typeof payload.imageUrl === "string" && payload.imageUrl) {
      await deleteImage(payload.imageUrl, true);
    }
  } else if (suggestion.type === "EDIT_FACILITY") {
    const payload = suggestion.payload as unknown as FacilityUpdate;
    if (typeof payload.imageUrl === "string" && payload.imageUrl && suggestion.targetId) {
      const { data: currentFacility } = await getFacilityById({
        id: suggestion.targetId,
        client,
      });

      if (currentFacility && currentFacility.imageUrl !== payload.imageUrl) {
        await deleteImage(payload.imageUrl, true);
      }
    }
  }

  await updateSuggestion(
    id,
    {
      status: "REJECTED",
      adminNote: reason ?? null,
    },
    client,
  );

  revalidatePath("/admin/suggestions");
  revalidatePath(`/admin/suggestions/${id}`);

  return { data: true };
}

export async function bulkRejectSuggestions(ids: string[], reason?: string) {
  const admin = await assertAdminAction();
  if ("error" in admin) return { error: admin.error };

  const results = await Promise.allSettled(
    ids.map((id) => rejectSuggestion(id, reason))
  );

  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error)
  ).length;

  revalidatePath("/admin/suggestions");

  if (failed > 0) {
    return { data: { processed: ids.length - failed, failed } };
  }

  return { data: { processed: ids.length, failed: 0 } };
}
