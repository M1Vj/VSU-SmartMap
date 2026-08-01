import type { Metadata } from "next";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { ChatOpsDashboard } from "@/components/admin/chat-ops-dashboard";
import { requireAdminSession } from "@/lib/auth/server";
import { getChatOpsDashboard, parseChatOpsFilters } from "@/lib/supabase/queries/chat-ops.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat Operations | Campus SmartMap for VSU Admin",
  description: "Review bounded, sanitized assistant operations and feedback.",
};

export default async function AdminChatOpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const requestedOffset = Number.parseInt(params.offset ?? "0", 10);
  const filters = parseChatOpsFilters(params);
  const data = await getChatOpsDashboard(session.serviceClient, {
    offset: Number.isFinite(requestedOffset) ? requestedOffset : 0,
    filters,
  });

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Chat Operations</h1>
        <p className="text-muted-foreground">
          Monitor assistant outcomes, performance, grounding, safety signals, and user feedback.
        </p>
      </div>
      <ChatOpsDashboard data={data} filters={filters} />
    </div>
  );
}
