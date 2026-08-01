import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createGenerationRunMetadata } from "./genkit.ts";

test("generation metadata reports the selected model and bounded attempt count", () => {
  assert.deepEqual(createGenerationRunMetadata("gemini-test", 4), {
    selectedModel: "gemini-test",
    attemptCount: 2,
  });
  assert.deepEqual(createGenerationRunMetadata("gemini-test", -10), {
    selectedModel: "gemini-test",
    attemptCount: 6,
  });
});

test("provider retry logs never include API-key fragments", () => {
  const source = readFileSync(new URL("./genkit.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /currentKey\.slice|key ending/i);
});
