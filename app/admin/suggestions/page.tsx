import type { Metadata } from "next";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { SuggestionsTable } from "@/components/admin/suggestions/suggestions-table";
import { getFacilitiesByIds } from "@/lib/supabase/queries/facilities";
import { getSuggestions } from "@/lib/supabase/queries/suggestions";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Suggestions | Campus SmartMap for VSU Admin",
  description: "Review pending facility additions and edits.",
};

export default async function SuggestionsPage() {
  const { client } = await getSupabaseAdminClient({ requireServiceRole: true }).catch(
    (error) => {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for the admin suggestions page. Add it to .env.local and restart dev server.",
        { cause: error },
      );
    },
  );

  const { data: suggestions, error } = await getSuggestions({ status: "PENDING", client });

  if (error) {
    throw new Error(error.message);
  }

  const targetIds = Array.from(
    new Set(
      (suggestions ?? [])
        .map((suggestion) => suggestion.targetId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: facilities } = await getFacilitiesByIds({
    ids: targetIds,
    client,
  });

  const facilityNames = Object.fromEntries(
    (facilities ?? []).map((facility) => [facility.id, facility.name]),
  );

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Suggestions</h1>
          <p className="text-muted-foreground">Review pending facility additions and edits.</p>
        </div>
      </div>

      <SuggestionsTable suggestions={suggestions ?? []} facilityNames={facilityNames} />
    </div>
  );
}
