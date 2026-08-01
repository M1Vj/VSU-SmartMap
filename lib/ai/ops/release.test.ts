import assert from "node:assert/strict";
import test from "node:test";

import { getAiModelLadder, getAiReleaseId } from "./release.ts";

test("getAiModelLadder binds configured model order without sensitive environment data", () => {
  assert.deepEqual(
    getAiModelLadder({
      GEMINI_MODEL_IDS: "model-b, model-a, model-b",
      GEMINI_API_KEY: "must-not-be-read",
    }),
    ["model-b", "model-a"]
  );
});

test("getAiReleaseId is stable for identical explicit behavior inputs", () => {
  const input = {
    promptVersion: "prompt-v3",
    schemaVersion: "schema-v2",
    retrievalVersion: "retrieval-v4",
    cacheVersion: "cache-v5",
    modelLadder: ["gemini-fast", "gemini-safe"],
    codeRelease: "sha-abc123",
  };

  assert.equal(getAiReleaseId(input), getAiReleaseId({ ...input }));
  assert.match(getAiReleaseId(input), /^ai_[a-f0-9]{16}$/);
});

test("getAiReleaseId changes for every behavior binding", () => {
  const base = {
    promptVersion: "prompt-v3",
    schemaVersion: "schema-v2",
    retrievalVersion: "retrieval-v4",
    cacheVersion: "cache-v5",
    modelLadder: ["gemini-fast", "gemini-safe"],
    codeRelease: "sha-abc123",
  };
  const baseId = getAiReleaseId(base);

  for (const changed of [
    { ...base, promptVersion: "prompt-v4" },
    { ...base, schemaVersion: "schema-v3" },
    { ...base, retrievalVersion: "retrieval-v5" },
    { ...base, cacheVersion: "cache-v6" },
    { ...base, modelLadder: ["gemini-safe", "gemini-fast"] },
    { ...base, codeRelease: "sha-def456" },
  ]) {
    assert.notEqual(getAiReleaseId(changed), baseId);
  }
});

test("getAiReleaseId hashes code release values instead of exposing them", () => {
  const secretLikeRelease = "deployment-with-sensitive-internal-name";
  const releaseId = getAiReleaseId({
    promptVersion: "p1",
    schemaVersion: "s1",
    retrievalVersion: "r1",
    cacheVersion: "c1",
    modelLadder: ["model-a"],
    codeRelease: secretLikeRelease,
  });

  assert.equal(releaseId.includes(secretLikeRelease), false);
});
