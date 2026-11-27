import { createHash } from "node:crypto";
import { getChatModelIds } from "../model-policy";

export type AiReleaseBindings = {
  promptVersion: string;
  schemaVersion: string;
  retrievalVersion: string;
  cacheVersion: string;
  modelLadder: readonly string[];
  codeRelease: string;
};

type ModelEnvironment = Partial<Record<string, string | undefined>>;

export function getAiModelLadder(env: ModelEnvironment = process.env): string[] {
  return getChatModelIds(env);
}

export const AI_RELEASE_BINDINGS: Readonly<AiReleaseBindings> = Object.freeze({
  promptVersion: "chat-prompt-v4",
  schemaVersion: "chat-schema-v1",
  retrievalVersion: "chat-retrieval-v2",
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
