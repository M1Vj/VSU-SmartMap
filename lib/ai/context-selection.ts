import type { FacilityCategory } from "@/lib/types/facility";
import type { FacilityChatContext } from "@/lib/supabase/queries/facilities";
import type { LocationQuery } from "./schemas/location";

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
  "near",
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

const TERM_ALIASES: Record<string, string[]> = {
  admin: ["administration", "administrative"],
  canteen: ["cafeteria", "dining", "food", "kainan", "stall"],
  cr: ["bathroom", "comfort", "restroom", "toilet", "utility"],
  dorm: ["dormitory", "hall", "residential"],
  gym: ["gymnasium", "sports"],
  lib: ["library"],
  registrar: ["records", "registration", "enrollment"],
  usso: ["student", "services"],
};

const CATEGORY_TERMS: Record<FacilityCategory, string[]> = {
  academic: ["academic", "college", "class", "classroom", "lecture", "lab", "laboratory"],
  administrative: ["admin", "administration", "administrative"],
  research: ["research", "laboratory", "lab"],
  office: ["office", "registrar", "cashier", "usso", "services"],
  residential: ["residential", "housing"],
  dormitory: ["dorm", "dormitory", "hall"],
  lodging: ["guest", "guesthouse", "hostel", "lodging"],
  sports: ["gym", "gymnasium", "oval", "court", "sports"],
  dining: ["canteen", "cafeteria", "dining", "food", "kainan", "stall"],
  library: ["library", "lib", "books", "study"],
  medical: ["clinic", "hospital", "infirmary", "medical"],
  parking: ["parking", "park"],
  landmark: ["landmark", "gate", "entrance", "oval"],
  religious: ["chapel", "church", "religious"],
  utility: ["cr", "comfort", "restroom", "toilet", "bathroom", "utility"],
  commercial: ["print", "printing", "shop", "store", "market"],
  transportation: ["terminal", "transport", "shuttle"],
  atm: ["atm", "bank", "cash"],
  other: ["other"],
};

export function tokenizeForRetrieval(input: string): string[] {
  const baseTokens = input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  const expanded = new Set<string>();
  for (const token of baseTokens) {
    expanded.add(token);
    for (const alias of TERM_ALIASES[token] ?? []) {
      expanded.add(alias);
    }
  }

  return Array.from(expanded);
}

function scoreFacility(facility: FacilityChatContext, tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;

  const name = facility.name.toLowerCase();
  const code = facility.code?.toLowerCase();
  const description = facility.description?.toLowerCase();
  const categoryTerms = CATEGORY_TERMS[facility.category] ?? [];
  const roomText = facility.rooms
    ?.map((room) => `${room.roomCode} ${room.name ?? ""}`)
    .join(" ")
    .toLowerCase();

  return tokens.reduce((score, token) => {
    const exactName = name === token;
    const nameMatch = name.includes(token);
    const codeMatch = code === token || code?.includes(token);
    const roomMatch = roomText?.includes(token);
    const descriptionMatch = description?.includes(token);
    const categoryMatch = categoryTerms.includes(token);

    return (
      score +
      (exactName ? 30 : 0) +
      (codeMatch ? 24 : 0) +
      (roomMatch ? 22 : 0) +
      (nameMatch ? 12 : 0) +
      (categoryMatch ? 8 : 0) +
      (descriptionMatch ? 2 : 0)
    );
  }, 0);
}

export function buildRetrievalQuery(
  query: string,
  context?: LocationQuery["context"]
): string {
  const recentUserTurns =
    context?.conversationHistory
      ?.filter((entry) => entry.role === "user")
      .slice(-2)
      .map((entry) => entry.content) ?? [];

  return [query, ...recentUserTurns, context?.summary ?? ""].filter(Boolean).join(" ");
}

export function selectFacilitiesForChatContext(
  facilities: readonly FacilityChatContext[],
  query: string,
  limit = 32
): FacilityChatContext[] {
  const tokens = tokenizeForRetrieval(query);
  if (tokens.length === 0) return [];

  return facilities
    .map((facility, index) => ({
      facility,
      index,
      score: scoreFacility(facility, tokens),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.facility.name.localeCompare(b.facility.name) || a.index - b.index;
    })
    .slice(0, limit)
    .map(({ facility }) => facility);
}

export function compactFacilitiesForPrompt(
  facilities: readonly FacilityChatContext[]
): Array<{
  id: string;
  name: string;
  code?: string;
  category: FacilityCategory;
  description?: string;
  rooms?: Array<{ roomCode: string; name?: string }>;
}> {
  return facilities.map((facility) => ({
    id: facility.id,
    name: facility.name,
    code: facility.code,
    category: facility.category,
    description: facility.description?.slice(0, 180),
    rooms: facility.rooms?.slice(0, 18),
  }));
}
