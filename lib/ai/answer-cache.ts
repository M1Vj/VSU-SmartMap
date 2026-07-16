import { createHash } from "node:crypto";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import type { EventMatch } from "@/lib/types/chat";

export type CachedFacilityRef = {
  facilityId: string;
  name: string;
};

export type CachedBoardingHouseRef = {
  listingId: string;
  name: string;
};

export type ChatAnswerCachePayload = {
  question: string;
  content: string;
  facilities?: CachedFacilityRef[];
  events?: EventMatch[];
  boardingHouses?: CachedBoardingHouseRef[];
  model?: string;
};

export type ChatAnswerCacheHit = ChatAnswerCachePayload & {
  questionHash: string;
};

type ChatAnswerCacheRow = {
  question_hash: string;
  question: string;
  content: string;
  facilities: CachedFacilityRef[] | null;
  events: EventMatch[] | null;
  boarding_houses: CachedBoardingHouseRef[] | null;
  model: string | null;
};

export function normalizeChatQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
}

// Bump when prompt/behavior changes make previously cached answers wrong;
// old rows simply stop matching and expire on their own TTL.
const CHAT_ANSWER_CACHE_VERSION = "v2";

export function getChatQuestionHash(question: string): string {
  return createHash("sha256")
    .update(`${CHAT_ANSWER_CACHE_VERSION}|${normalizeChatQuestion(question)}`)
    .digest("hex");
}

export async function getCachedChatAnswer(questionHash: string): Promise<ChatAnswerCacheHit | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("chat_answer_cache")
    .select("question_hash, question, content, facilities, events, boarding_houses, model")
    .eq("question_hash", questionHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  const row = data as ChatAnswerCacheRow;
  return {
    questionHash: row.question_hash,
    question: row.question,
    content: row.content,
    facilities: row.facilities ?? undefined,
    events: row.events ?? undefined,
    boardingHouses: row.boarding_houses ?? undefined,
    model: row.model ?? undefined,
  };
}

export async function upsertCachedChatAnswer(
  questionHash: string,
  payload: ChatAnswerCachePayload,
  now = new Date()
): Promise<void> {
  const supabase = getSupabaseServiceRoleClient();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("chat_answer_cache").upsert(
    {
      question_hash: questionHash,
      question: payload.question,
      content: payload.content,
      facilities: payload.facilities ?? null,
      events: payload.events ?? null,
      boarding_houses: payload.boardingHouses ?? null,
      model: payload.model ?? null,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "question_hash" }
  );

  if (error) {
    console.warn("Failed to upsert chat answer cache", error.message);
  }
}
