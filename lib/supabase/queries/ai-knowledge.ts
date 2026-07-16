import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../browser-client";
import type {
  AiKnowledgeChatContext,
  AiKnowledgeEntry,
  AiKnowledgeEntryInsert,
  AiKnowledgeEntryRow,
  AiKnowledgeEntryUpdate,
} from "@/lib/types/ai-knowledge";

type BaseResult<T> = { data: T | null; error: PostgrestError | null };
type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

const selectBase =
  "id, title, content, keywords, source, is_active, priority, created_at, updated_at";

const STOP_WORDS = new Set([
  "a",
  "an",
  "ang",
  "are",
  "at",
  "ba",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "ko",
  "me",
  "my",
  "ng",
  "on",
  "sa",
  "saan",
  "the",
  "there",
  "to",
  "where",
  "with",
  "yung",
]);

const QUERY_ALIASES: Record<string, string[]> = {
  admission: ["admissions", "applicant", "vsucat"],
  canteen: ["cafeteria", "dining", "food", "kainan"],
  cr: ["bathroom", "comfort", "restroom", "toilet"],
  dorm: ["dormitory", "housing", "residential"],
  enroll: ["enrollment", "admission", "registration"],
  grades: ["portal", "my.vsu", "student"],
  library: ["learning", "commons", "books"],
  registrar: ["records", "registration", "credentials", "enrollment"],
  room: ["classroom", "assignment", "schedule"],
  tba: ["announced", "schedule", "room"],
  usso: ["student", "services", "guidance", "scholarship"],
};

export const normalizeError = (error: PostgrestError | null) =>
  error ? { ...error, message: `Unable to request: ${error.message}` } : null;

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

export function toAiKnowledgeEntry(row: AiKnowledgeEntryRow): AiKnowledgeEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    keywords: row.keywords ?? [],
    source: row.source,
    isActive: row.is_active,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInsertPayload(input: AiKnowledgeEntryInsert) {
  return {
    id: input.id ?? undefined,
    title: input.title,
    content: input.content,
    keywords: [...(input.keywords ?? [])],
    source: input.source ?? null,
    is_active: input.isActive ?? true,
    priority: input.priority ?? 0,
  };
}

function mapUpdatePayload(input: AiKnowledgeEntryUpdate) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.keywords !== undefined) patch.keywords = [...input.keywords];
  if (input.source !== undefined) patch.source = input.source ?? null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.priority !== undefined) patch.priority = input.priority;
  return patch;
}

function toChatContext(entry: AiKnowledgeEntry): AiKnowledgeChatContext {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    keywords: entry.keywords,
    source: entry.source,
    priority: entry.priority,
  };
}

function tokenize(input: string): string[] {
  const baseTokens = input
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  const expanded = new Set<string>();
  for (const token of baseTokens) {
    expanded.add(token);
    for (const alias of QUERY_ALIASES[token] ?? []) {
      expanded.add(alias);
    }
  }

  return Array.from(expanded);
}

function getPhrases(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[?!.,;:\n\r]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    )
  );
}

function scoreEntry(entry: AiKnowledgeEntryRow, tokens: readonly string[], query: string): number {
  if (tokens.length === 0) return 1;

  const title = entry.title.toLowerCase();
  const content = entry.content.toLowerCase();
  const keywords = (entry.keywords ?? []).map((keyword) => keyword.toLowerCase());
  const phrases = getPhrases(query);
  const phraseScore = phrases.reduce((score, phrase) => {
    if (title.includes(phrase)) return score + 14;
    if (keywords.some((keyword) => keyword.includes(phrase))) return score + 10;
    if (content.includes(phrase)) return score + 4;
    return score;
  }, 0);

  const tokenScore = tokens.reduce((score, token) => {
    const keywordExactMatch = keywords.some((keyword) => keyword === token);
    const keywordPartialMatch = keywords.some((keyword) => keyword.includes(token));
    const titleExactMatch = title === token;
    const titleMatch = title.includes(token);
    const contentMatch = content.includes(token);

    return (
      score +
      (keywordExactMatch ? 12 : 0) +
      (keywordPartialMatch ? 6 : 0) +
      (titleExactMatch ? 12 : 0) +
      (titleMatch ? 5 : 0) +
      (contentMatch ? 1 : 0)
    );
  }, 0);

  return phraseScore + tokenScore;
}

export function selectAiKnowledgeForQuery(
  rows: readonly AiKnowledgeEntryRow[],
  query: string,
  limit = 5
): AiKnowledgeChatContext[] {
  const tokens = tokenize(query);

  return rows
    .filter((row) => row.is_active)
    .map((row) => ({
      row,
      score: scoreEntry(row, tokens, query),
    }))
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .sort((a, b) => {
      const aAdjustedScore = a.score + a.row.priority / 100;
      const bAdjustedScore = b.score + b.row.priority / 100;
      if (bAdjustedScore !== aAdjustedScore) return bAdjustedScore - aAdjustedScore;
      if (b.row.priority !== a.row.priority) return b.row.priority - a.row.priority;
      return a.row.title.localeCompare(b.row.title);
    })
    .slice(0, limit)
    .map(({ row }) => toChatContext(toAiKnowledgeEntry(row)));
}

export async function getAiKnowledgeForChat(params: {
  query: string;
  limit?: number;
  client?: MaybeClient;
}): Promise<BaseResult<AiKnowledgeChatContext[]>> {
  const supabase = await resolveClient(params.client);
  const limit = params.limit ?? 5;
  const fetchLimit = Math.max(limit * 10, 100);

  const rpcResult = await supabase.rpc("search_ai_knowledge_entries", {
    search_query: params.query,
    match_limit: limit,
    fetch_limit: fetchLimit,
  });

  if (!rpcResult.error && rpcResult.data) {
    return {
      data: (rpcResult.data as AiKnowledgeEntryRow[]).map(toAiKnowledgeEntry).map(toChatContext),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("ai_knowledge_entries")
    .select(selectBase)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(fetchLimit);

  if (error || !data) {
    return { data: null, error: normalizeError(error) };
  }

  return {
    data: selectAiKnowledgeForQuery(data as AiKnowledgeEntryRow[], params.query, limit),
    error: null,
  };
}

export async function getAiKnowledgeEntries(params?: {
  client?: MaybeClient;
}): Promise<BaseResult<AiKnowledgeEntry[]>> {
  const supabase = await resolveClient(params?.client);
  const { data, error } = await supabase
    .from("ai_knowledge_entries")
    .select(selectBase)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  return {
    data: data ? (data as AiKnowledgeEntryRow[]).map(toAiKnowledgeEntry) : [],
    error: normalizeError(error),
  };
}

export async function createAiKnowledgeEntry(
  input: AiKnowledgeEntryInsert,
  client?: MaybeClient
): Promise<BaseResult<AiKnowledgeEntry>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("ai_knowledge_entries")
    .insert(mapInsertPayload(input))
    .select(selectBase)
    .single();

  return {
    data: data ? toAiKnowledgeEntry(data as AiKnowledgeEntryRow) : null,
    error: normalizeError(error),
  };
}

export async function updateAiKnowledgeEntry(
  id: string,
  input: AiKnowledgeEntryUpdate,
  client?: MaybeClient
): Promise<BaseResult<AiKnowledgeEntry>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("ai_knowledge_entries")
    .update(mapUpdatePayload(input))
    .eq("id", id)
    .select(selectBase)
    .single();

  return {
    data: data ? toAiKnowledgeEntry(data as AiKnowledgeEntryRow) : null,
    error: normalizeError(error),
  };
}

export async function deleteAiKnowledgeEntry(
  id: string,
  client?: MaybeClient
): Promise<BaseResult<void>> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("ai_knowledge_entries")
    .delete()
    .eq("id", id);

  return {
    data: error ? null : undefined as unknown as void,
    error: normalizeError(error),
  };
}
