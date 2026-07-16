import { NextResponse } from "next/server";

import { signStoragePaths } from "@/lib/boarding-houses/photo-urls";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import { getBoardingHouseSummaries } from "@/lib/supabase/queries/boarding-houses";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );
  const offset = parsePositiveInt(searchParams.get("offset"), 0);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await getBoardingHouseSummaries(supabase, { limit, offset });

  if (error) {
    console.warn("[boarding-houses] Public listing fetch failed:", error.message);
    return NextResponse.json({ error: "Failed to load boarding houses" }, { status: 500 });
  }

  const summaries = data ?? [];

  const byBucket = new Map<string, number[]>();
  summaries.forEach((summary, index) => {
    if (summary.coverPhotoBucket && summary.coverPhotoPath) {
      const indexes = byBucket.get(summary.coverPhotoBucket) ?? [];
      indexes.push(index);
      byBucket.set(summary.coverPhotoBucket, indexes);
    }
  });

  const signedThumbnails = new Array<string | null>(summaries.length).fill(null);
  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, indexes]) => {
      const paths = indexes.map((index) => summaries[index].coverPhotoPath as string);
      const signed = await signStoragePaths(bucket, paths);
      indexes.forEach((index, i) => {
        signedThumbnails[index] = signed[i] ?? null;
      });
    }),
  );

  const result: BoardingHouseSummary[] = summaries.map((summary, index) => ({
    ...summary,
    thumbnailUrl: signedThumbnails[index] ?? summary.thumbnailUrl ?? null,
  }));

  return NextResponse.json(result, { status: 200 });
}
