'use server';

import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import type { FacilityChatContext } from "./facilities";
import { getFacilitiesForChat, normalizeError } from "./facilities";
import type { PostgrestError } from "@supabase/supabase-js";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };

const getCachedFacilitiesForChat = unstable_cache(
  async (): Promise<BaseResult<FacilityChatContext[]>> => {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await getFacilitiesForChat(client);

    return { data, error: normalizeError(error) };
  },
  ["facilities-chat-context"],
  {
    tags: ["facilities"],
    revalidate: 3600,
  }
);

export async function getFacilitiesForChatCached(): Promise<BaseResult<FacilityChatContext[]>> {
  return getCachedFacilitiesForChat();
}

export async function revalidateFacilitiesCache() {
  return revalidateTag("facilities", "max");
}
