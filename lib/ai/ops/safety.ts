export const PROMPT_INJECTION_SIGNAL_TYPES = [
  "direct_override",
  "prompt_extraction",
  "role_spoofing",
  "encoded_payload",
  "delimiter_attack",
] as const;

export type PromptInjectionSignal = (typeof PROMPT_INJECTION_SIGNAL_TYPES)[number];

const SIGNAL_PATTERNS: Readonly<Record<PromptInjectionSignal, RegExp>> = {
  direct_override:
    /\b(?:ignore|disregard|forget|override)\b.{0,40}\b(?:previous|prior|above|system|developer)\b.{0,25}\b(?:instruction|prompt|message|rule)s?\b/i,
  prompt_extraction:
    /\b(?:reveal|show|print|repeat|expose|leak|extract)\b.{0,50}\b(?:system|developer|hidden|initial)\b.{0,20}\b(?:prompt|instruction|message|rule)s?\b/i,
  role_spoofing:
    /\b(?:you are now|act as|pretend (?:to be|you are)|switch to)\b.{0,30}\b(?:system|developer|administrator|admin|root)\b/i,
  encoded_payload:
    /\b(?:base64|rot13|hex(?:adecimal)?|decode|encoded payload)\b\s*(?::|is|this)?\s*[a-z0-9+/=]{8,}/i,
  delimiter_attack:
    /(?:<\|\s*(?:system|assistant|developer|user)\s*\|>|\[\s*(?:system|assistant|developer)\s*\]|###\s*(?:system|developer)\b)/i,
};

/** Reports heuristic signals for observability; it does not claim to prevent injection. */
export function detectPromptInjectionSignals(input: string): PromptInjectionSignal[] {
  return PROMPT_INJECTION_SIGNAL_TYPES.filter((signal) => SIGNAL_PATTERNS[signal].test(input));
}
