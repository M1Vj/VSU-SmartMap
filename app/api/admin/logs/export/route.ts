import { NextResponse, type NextRequest } from "next/server";

import { assertAdminAction } from "@/lib/auth/server";
import { buildBugIncidentExport, exportBugIncidentsCsv } from "@/lib/observability/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await assertAdminAction();
  if ("error" in admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") ?? "json";
  const incidentId = searchParams.get("incidentId");

  if (format === "csv") {
    const csv = await exportBugIncidentsCsv();
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="smartmap-bug-incidents.csv"`,
      },
    });
  }

  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required for JSON export." }, { status: 400 });
  }

  const exported = await buildBugIncidentExport(incidentId);
  if (!exported) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  return NextResponse.json(exported, {
    headers: {
      "content-disposition": `attachment; filename="smartmap-incident-${incidentId}.json"`,
    },
  });
}
