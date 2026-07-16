type FallbackFacilityContext = {
  id: string;
  name: string;
  code?: string;
  category: string;
  description?: string | null;
};

type FacilityRef = {
  facilityId: string;
  name: string;
};

const MAX_FALLBACK_MATCHES = 6;
const STOP_WORDS = new Set([
  "a",
  "an",
  "ang",
  "are",
  "at",
  "building",
  "find",
  "for",
  "is",
  "in",
  "location",
  "map",
  "near",
  "ng",
  "of",
  "pin",
  "sa",
  "show",
  "saan",
  "the",
  "to",
  "where",
]);

const CATEGORY_ALIASES: Record<string, string[]> = {
  dining: ["canteen", "food", "kainan"],
  dormitory: ["dorm", "dorms", "dormitory"],
  library: ["library"],
  medical: ["clinic", "hospital", "infirmary"],
  parking: ["parking"],
  sports: ["gym", "gymnasium", "court", "oval"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreFacility(query: string, queryTokens: Set<string>, facility: FallbackFacilityContext) {
  const name = normalize(facility.name);
  const nameTokens = tokenize(facility.name);
  const code = facility.code ? normalize(facility.code) : "";
  const category = normalize(facility.category);
  const aliases = CATEGORY_ALIASES[category] ?? [];

  if (query === name || query.includes(name)) return 100;
  if (code && queryTokens.has(code)) return 95;

  const matchingNameTokens = nameTokens.filter((token) => queryTokens.has(token));
  if (matchingNameTokens.length === nameTokens.length && nameTokens.length > 0) return 85;
  if (matchingNameTokens.length > 0) return 70 + matchingNameTokens.length;

  if (queryTokens.has(category)) return 60;
  if (aliases.some((alias) => queryTokens.has(alias))) return 55;

  return 0;
}

export function findFallbackFacilityRefs(
  query: string,
  facilities: FallbackFacilityContext[]
): FacilityRef[] {
  const normalizedQuery = normalize(query);
  const queryTokens = new Set(tokenize(query));

  if (!normalizedQuery || queryTokens.size === 0) return [];

  return facilities
    .map((facility, index) => ({
      facility,
      index,
      score: scoreFacility(normalizedQuery, queryTokens, facility),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_FALLBACK_MATCHES)
    .map(({ facility }) => ({
      facilityId: facility.id,
      name: facility.name,
    }));
}
