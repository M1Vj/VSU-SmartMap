import type { Metadata } from "next";
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';
import { FacilitiesPageClient } from '@/components/admin/facilities-page-client';
import { getFacilities } from '@/lib/supabase/queries/facilities';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Facilities | Campus SmartMap for VSU Admin",
  description: "Manage campus buildings and points of interest.",
};

export default async function FacilitiesPage() {
  const client = await getSupabaseServerClient();
  const { data, error } = await getFacilities({ client });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Facilities</h1>
          <p className="text-muted-foreground">
            Manage campus buildings and points of interest.
          </p>
        </div>
      </div>

      <FacilitiesPageClient facilities={data ?? []} />
    </div>
  );
}
