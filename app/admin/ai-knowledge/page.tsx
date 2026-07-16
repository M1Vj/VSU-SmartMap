import type { Metadata } from "next";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AiKnowledgeManager } from "@/components/admin/ai-knowledge-manager";
import { getAiKnowledgeEntries } from "@/lib/supabase/queries/ai-knowledge";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Knowledge | Campus SmartMap for VSU Admin",
  description: "Manage university facts used by the campus assistant.",
};

export default async function AiKnowledgePage() {
  const { data, error } = await getAiKnowledgeEntries({
    client: getSupabaseServiceRoleClient(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">AI Knowledge</h1>
          <p className="text-muted-foreground">
            Add trusted university facts that the campus assistant can use.
          </p>
        </div>
      </div>

      <AiKnowledgeManager entries={data ?? []} />
    </div>
  );
}
