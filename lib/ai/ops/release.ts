import { createHash } from "node:crypto";

export type AiReleaseBindings = {
  promptVersion: string;
  schemaVersion: string;
  retrievalVersion: string;
  cacheVersion: string;
  modelLadder: readonly string[];
  codeRelease: string;
};

const DEFAULT_MODEL_LADDER = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
] as const;
const DEPRECATED_MODEL_IDS = new Set([
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
]);

type ModelEnvironment = Partial<Record<string, string | undefined>>;

export function getAiModelLadder(env: ModelEnvironment = process.env): string[] {
  const configured = [
    ...new Set(
      (env.GEMINI_MODEL_IDS ?? "")
        .split(",")
        .map((model) => model.trim())
        .filter((model) => model.length > 0 && !DEPRECATED_MODEL_IDS.has(model))
    ),
  ];
  if (configured.length > 0) return configured;

  const primary = env.GEMINI_MODEL_ID?.trim();
  if (primary && !DEPRECATED_MODEL_IDS.has(primary)) {
    return [primary, ...DEFAULT_MODEL_LADDER.filter((model) => model !== primary)];
  }

  return [...DEFAULT_MODEL_LADDER];
}

export const AI_RELEASE_BINDINGS: Readonly<AiReleaseBindings> = Object.freeze({
  promptVersion: "chat-prompt-v1",
  schemaVersion: "chat-schema-v1",
  retrievalVersion: "chat-retrieval-v1",
  cacheVersion: "chat-cache-v3",
  modelLadder: Object.freeze(getAiModelLadder()),
  codeRelease:
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.COMMIT_SHA ??
    "local",
});

export function getAiReleaseId(bindings: AiReleaseBindings = AI_RELEASE_BINDINGS): string {
  const canonicalBindings = JSON.stringify([
    bindings.promptVersion,
    bindings.schemaVersion,
    bindings.retrievalVersion,
    bindings.cacheVersion,
    [...bindings.modelLadder],
    bindings.codeRelease,
  ]);
  const digest = createHash("sha256").update(canonicalBindings).digest("hex").slice(0, 16);

  return `ai_${digest}`;
}

export const AI_RELEASE_ID = getAiReleaseId();
