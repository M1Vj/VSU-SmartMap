import { notFound } from "next/navigation";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { SuggestionDiffView } from "@/components/admin/suggestions/suggestion-diff-view";
import { SuggestionRoomDiffView } from "@/components/admin/suggestions/suggestion-room-diff-view";
import { getFacilityById } from "@/lib/supabase/queries/facilities";
import { getRoomById } from "@/lib/supabase/queries/rooms";
import { getSuggestionById } from "@/lib/supabase/queries/suggestions";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { baseFacilitySchema } from "@/lib/validation/facility";
import { roomSchema } from "@/lib/validation/room";
import { z } from "zod";

export default async function SuggestionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { client } = await getSupabaseAdminClient({ requireServiceRole: true });
  const { data: suggestion } = await getSuggestionById(params.id, client);

  if (!suggestion) {
    notFound();
  }

  const isRoomSuggestion = suggestion.type === "ADD_ROOM" || suggestion.type === "EDIT_ROOM";
  const isFacilitySuggestion = suggestion.type === "ADD_FACILITY" || suggestion.type === "EDIT_FACILITY";

  const currentFacility =
    suggestion.targetId && suggestion.type === "EDIT_FACILITY"
      ? (await getFacilityById({ id: suggestion.targetId, client })).data ?? null
      : null;

  const targetFacility =
    suggestion.targetId && isRoomSuggestion
      ? (await getFacilityById({ id: suggestion.targetId, client })).data ?? null
      : null;

  const currentRoom =
    suggestion.type === "EDIT_ROOM" && suggestion.payload && typeof suggestion.payload === "object" && "roomId" in suggestion.payload
      ? (await getRoomById({ id: suggestion.payload.roomId as string, client })).data ?? null
      : null;

  if (isRoomSuggestion) {
    const parsedPayload = roomSchema.partial().safeParse(suggestion.payload);
    const payload = parsedPayload.success ? parsedPayload.data : {};

    return (
      <div className="space-y-6">
        <AdminBreadcrumbs />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Suggestion ID: {suggestion.id}</p>
          <h1 className="text-3xl font-bold">Suggestion Review</h1>
          <p className="text-muted-foreground">
            Type: {suggestion.type.replace("_", " ")} · Status: {suggestion.status}
          </p>
        </div>

        <SuggestionRoomDiffView
          suggestion={suggestion}
          payload={payload}
          currentRoom={currentRoom}
          targetFacility={targetFacility}
        />
      </div>
    );
  }

  if (isFacilitySuggestion) {
    const partialSchema = baseFacilitySchema.extend({ hasRooms: z.boolean().optional() }).partial();
    const parsedPayload = partialSchema.safeParse(suggestion.payload);
    const payload = parsedPayload.success ? parsedPayload.data : {};

    return (
      <div className="space-y-6">
        <AdminBreadcrumbs />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Suggestion ID: {suggestion.id}</p>
          <h1 className="text-3xl font-bold">Suggestion Review</h1>
          <p className="text-muted-foreground">
            Type: {suggestion.type.replace("_", " ")} · Status: {suggestion.status}
          </p>
        </div>

        <SuggestionDiffView
          suggestion={suggestion}
          payload={payload}
          currentFacility={currentFacility}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <h1 className="text-3xl font-bold">Unknown Suggestion Type</h1>
    </div>
  );
}
