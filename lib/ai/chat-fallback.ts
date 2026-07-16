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

export function buildChatFallbackContent(query: string): string {
  const topic = query.trim() || "that";

  return [
    `I can still help with "${topic}" using Campus SmartMap basics, but live AI is temporarily unavailable.`,
    "Use the Map tab to search campus locations listed in the app, select a pin, then tap Directions. Routes and pins are limited to the VSU campus area.",
    "For office policies, schedules, or requirements, verify with the relevant VSU office if the answer is urgent.",
  ].join("\n\n");
}
