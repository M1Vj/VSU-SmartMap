import "server-only";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

export async function signStoragePath(
  bucket: string,
  path: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string | null> {
  if (!bucket || !path) return null;
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function signStoragePaths(
  bucket: string,
  paths: string[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Array<string | null>> {
  if (!bucket || paths.length === 0) return [];
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, ttlSeconds);
  if (error || !data) return paths.map(() => null);
  return data.map((entry) => entry.signedUrl ?? null);
}
