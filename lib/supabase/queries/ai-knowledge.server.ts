'use server';

import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { AiKnowledgeChatContext } from "@/lib/types/ai-knowledge";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { getAiKnowledgeForChat, normalizeError } from "./ai-knowledge";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };

const getCachedAiKnowledgeForChat = unstable_cache(
  async (query: string, limit = 5): Promise<BaseResult<AiKnowledgeChatContext[]>> => {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await getAiKnowledgeForChat({ query, limit, client });

    return { data, error: normalizeError(error) };
  },
  ["ai-knowledge-chat-context"],
  {
    tags: ["ai-knowledge"],
    revalidate: 3600,
  }
);

export async function getAiKnowledgeForChatCached(params: {
  query: string;
  limit?: number;
}): Promise<BaseResult<AiKnowledgeChatContext[]>> {
  return getCachedAiKnowledgeForChat(params.query, params.limit ?? 5);
}

export async function revalidateAiKnowledgeCache() {
  return revalidateTag("ai-knowledge", "max");
}
