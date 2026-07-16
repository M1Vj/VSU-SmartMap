export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { assertAdminAction } from "@/lib/auth/server";
import { createAdminEventProofSignedUrl } from "@/lib/storage/event-proofs";

type RouteContext = { params: Promise<{ id: string }> };

function unavailable() {
  return NextResponse.json(
    { error: "Evidence unavailable." },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const admin = await assertAdminAction();
  if ("error" in admin) return unavailable();

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return unavailable();

  const { id } = await context.params;
  const signedUrl = await createAdminEventProofSignedUrl(
    admin.serviceClient,
    id,
    projectUrl,
    300,
  );
  if (!signedUrl) return unavailable();

  const response = NextResponse.redirect(signedUrl, 302);
  response.headers.set("cache-control", "no-store");
  return response;
}
