export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { reclaimExpiredEventProofs } from "@/lib/storage/event-proofs";
import { reclaimExpiredPendingUploads } from "@/lib/storage/pending-uploads";

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function hasExactBearerToken(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return response({ error: "Storage retention unavailable." }, 503);
  if (!hasExactBearerToken(request.headers.get("authorization"), secret)) {
    return response({ error: "Unauthorized." }, 401);
  }

  try {
    const pendingUploads = await reclaimExpiredPendingUploads();
    const eventProofs = await reclaimExpiredEventProofs();
    return response({ pendingUploads, eventProofs }, 200);
  } catch {
    return response({ error: "Unable to reclaim storage." }, 500);
  }
}
