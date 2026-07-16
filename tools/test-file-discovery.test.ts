import assert from "node:assert/strict";
import test from "node:test";

import { escapeNodeGlobPath } from "./test-file-discovery.mjs";

test("escapeNodeGlobPath preserves Next.js dynamic route test files", () => {
  assert.equal(
    escapeNodeGlobPath("app/api/items/[id]/route.test.ts"),
    "app/api/items/[[]id]/route.test.ts",
  );
});
