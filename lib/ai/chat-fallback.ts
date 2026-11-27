export class IncompleteChatGenerationError extends Error {
  constructor() {
    super("AI generation incomplete");
    this.name = "IncompleteChatGenerationError";
  }
}

const FALLBACK_ERROR_PATTERNS = [
  "no api keys configured",
  "api key not valid",
  "model",
  "404",
  "quota",
  "429",
  "rate limit",
  "too many requests",
  "timeout",
  "etimedout",
  "network",
  "econnrefused",
  "max retries",
];

export function shouldUseChatFallback(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

// Match an explicit VSU or campus name, not a bare town in a facility name.
const OTHER_CAMPUS_NAMES = String.raw`alang(?:[\s–—-]*)alang|isabel|tolosa|villaba`;
const CAMPUS_NAMES = `${OTHER_CAMPUS_NAMES}|baybay|main|visca`;
const UNIVERSITY = String.raw`(?:vsu|visayas\s+state\s+university)`;
const CAMPUS_LABEL = String.raw`(${CAMPUS_NAMES})(?:\s+campus)?`;
const CAMPUS_REFERENCE = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?:${UNIVERSITY}(?:(?:[\s–—-]+|\s*[:,]\s*)${CAMPUS_LABEL}|(?:\s*[:,])?\s*\(\s*${CAMPUS_LABEL}\s*\))|(${CAMPUS_NAMES})\s+(?:campus|branch\s+of\s+${UNIVERSITY}))(?![\p{L}\p{N}_])`,
  "giu",
);
const MAIN_CAMPUS_NAMES = new Set(["baybay", "main", "visca"]);
const FROM = /\b(?:from|(?:gikan|mula)\s+sa)\s*$/i;
const DESTINATION_FOLLOWS = /^\s*(?:,?\s*(?:to|(?:padulong|paingon|adto|papunta)\s+sa)\b|,\s*(?:where|asa)\b)/i;
const EXPLICIT_ORIGIN = /\b(?:coming|starting)\s+from\s*$/i;
const ALTERNATIVE_PREFIX = String.raw`^(?:\s+|\s*,\s*)(?:or|o)\b`;
const ALTERNATIVE_BEGIN = new RegExp(ALTERNATIVE_PREFIX, "i");
const REQUEST_TAIL = String.raw`(?:please|if\s+you\s+know)`;
const BARE_LABEL_END = String.raw`(?=\s*,(?:\s|$|${REQUEST_TAIL}\b)|(?:\s+${REQUEST_TAIL})?\s*[?!.]*\s*$)`;
const BARE_CAMPUS_ALTERNATIVE = new RegExp(
  String.raw`${ALTERNATIVE_PREFIX}\s+(?:(?:at|in|sa)\s+)?${CAMPUS_LABEL}${BARE_LABEL_END}`, "i",
);
const NON_MAIN_TOWN_IN_DESTINATION = new RegExp(
  String.raw`(?<![\p{L}\p{N}_])(?:in|at|sa)\s+(?:${OTHER_CAMPUS_NAMES})${BARE_LABEL_END}`, "iu",
);

export function getFallbackCampusNotice(query: string): string | undefined {
  const references = [...query.matchAll(CAMPUS_REFERENCE)];
  if (references.length === 0) return undefined;

  const destinations = new Set<string>();
  const origins = new Set<string>();
  let unresolvedOriginScope = false;
  function campusScope(label: string) {
    const name = label.toLowerCase().replace(/[\s–—-]/g, "");
    return MAIN_CAMPUS_NAMES.has(name) ? "main" : name;
  }
  for (const match of references) {
    const start = match.index ?? 0;
    const before = query.slice(0, start);
    const after = query.slice(start + match[0].length);
    const scope = campusScope(match[1] ?? match[2] ?? match[3]);
    const alternative = after.match(BARE_CAMPUS_ALTERNATIVE);
    const alternativeScope = alternative ? campusScope(alternative[1]) : undefined;

    const hasDestinationClause = DESTINATION_FOLLOWS.test(after);
    if (EXPLICIT_ORIGIN.test(before) || (FROM.test(before) && (hasDestinationClause || references.length === 1))) {
      origins.add(scope);
      if (
        (ALTERNATIVE_BEGIN.test(after) && alternativeScope !== scope) ||
        // A bare town after a route marker is a reason to clarify, not a campus match.
        (scope === "main" && hasDestinationClause && NON_MAIN_TOWN_IN_DESTINATION.test(after))
      ) {
        unresolvedOriginScope = true;
      }
      continue;
    }

    destinations.add(scope);
    if (alternativeScope) destinations.add(alternativeScope);
  }

  // A route starting only at Main Campus can still use ordinary Baybay lookup.
  // A different or unresolved origin does not establish the destination.
  if (destinations.size === 0 && origins.size === 1 && origins.has("main") && !unresolvedOriginScope) {
    return undefined;
  }

  if (destinations.size !== 1) {
    return "Which VSU campus is your destination? SmartMap only shows locations at the Main Campus in Baybay.";
  }
  if (!destinations.has("main")) {
    return "SmartMap only shows locations at the VSU Main Campus in Baybay. I can’t verify this location at another campus.";
  }
  return undefined;
}

export function buildChatFallbackContent(query: string): string {
  const topic = query.trim() || "that";

  return [
    `I can still help with "${topic}" using Campus SmartMap basics, but live AI is temporarily unavailable.`,
    "Use the Map tab to search campus locations listed in the app, select a pin, then tap Directions. Routes and pins are limited to the VSU campus area.",
    "For office policies, schedules, or requirements, verify with the relevant VSU office if the answer is urgent.",
  ].join("\n\n");
}
