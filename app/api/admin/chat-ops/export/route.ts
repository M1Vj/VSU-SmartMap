import { NextResponse, type NextRequest } from "next/server";

import { assertAdminAction } from "@/lib/auth/server";
import {
  getChatOpsDashboard,
  parseChatOpsFilters,
  serializeChatOpsCsv,
} from "@/lib/supabase/queries/chat-ops.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await assertAdminAction();
  if ("error" in admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = parseChatOpsFilters(Object.fromEntries(request.nextUrl.searchParams));
  const models = request.nextUrl.searchParams.getAll("model");
  if (models.length > 1 || (models[0] && !filters.model)) {
    return NextResponse.json({ error: "Invalid model filter" }, {
      status: 400,
      headers: { "cache-control": "private, no-store" },
    });
  }
  const data = await getChatOpsDashboard(admin.serviceClient, { limit: 100, filters });
  return new NextResponse(serializeChatOpsCsv(data.turns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="smartmap-chat-operations.csv"',
      "cache-control": "private, no-store",
    },
  });
}
