import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeNodeGlobPath,
  toNodeTestArgument,
} from "./test-file-discovery.mjs";

test("escapeNodeGlobPath preserves Next.js dynamic route test files", () => {
  assert.equal(
    escapeNodeGlobPath("app/api/items/[id]/route.test.ts"),
    "app/api/items/[[]id]/route.test.ts",
  );
});

test("toNodeTestArgument supports literal Node 20 paths and Node 22+ globs", () => {
  const filePath = "app/api/items/[id]/route.test.ts";

  assert.equal(toNodeTestArgument(filePath, 20), filePath);
  assert.equal(
    toNodeTestArgument(filePath, 22),
    "app/api/items/[[]id]/route.test.ts",
  );
});
