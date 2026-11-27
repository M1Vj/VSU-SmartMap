const CURRENT_FLASH_LITE = "gemini-3.5-flash-lite";

export const DEFAULT_CHAT_MODEL_IDS = [
  CURRENT_FLASH_LITE,
  "gemini-3.1-flash-lite",
] as const;

const CURRENT_CHAT_MODEL_IDS = [
  ...DEFAULT_CHAT_MODEL_IDS,
  // Legacy access is limited to existing projects. Keep it explicit only.
  "gemini-2.5-flash-lite",
  // Higher-cost Flash models require an explicit configuration choice.
  "gemini-3.6-flash",
  "gemini-3.8-flash",
] as const;
const SUPPORTED_CHAT_MODEL_IDS = new Set<string>(CURRENT_CHAT_MODEL_IDS);

// Chat Ops filters stored IDs literally, so retired IDs remain filterable
// without making them valid generation targets.
export const CHAT_OPS_MODEL_FILTER_IDS = [
  ...CURRENT_CHAT_MODEL_IDS,
  "gemini-3.5-flash",
  "gemini-2.5-flash",
] as const;

type ModelEnvironment = Partial<Record<"GEMINI_MODEL_ID" | "GEMINI_MODEL_IDS", string | undefined>>;

function resolveModelId(value: string | undefined): string | undefined {
  const id = value?.trim().replace(/^models\//, "");
  // Google's announced replacement for 2.5 Flash is Flash-Lite, not a
  // higher-cost Flash tier. Do not follow other legacy aliases implicitly.
  if (id === "gemini-2.5-flash") return CURRENT_FLASH_LITE;
  return id && SUPPORTED_CHAT_MODEL_IDS.has(id) ? id : undefined;
}

export function getChatModelIds(env?: ModelEnvironment): string[] {
  const source = env ?? {
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    GEMINI_MODEL_IDS: process.env.GEMINI_MODEL_IDS,
  };
  const configured = new Set<string>();
  for (const value of (source.GEMINI_MODEL_IDS ?? "").split(",")) {
    const model = resolveModelId(value);
    if (model) configured.add(model);
  }
  if (configured.size > 0) return [...configured];

  const primary = resolveModelId(source.GEMINI_MODEL_ID);
  return primary
    ? [primary, ...DEFAULT_CHAT_MODEL_IDS.filter((model) => model !== primary)]
    : [...DEFAULT_CHAT_MODEL_IDS];
}
