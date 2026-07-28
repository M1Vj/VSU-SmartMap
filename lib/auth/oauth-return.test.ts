import assert from "node:assert/strict";
import test from "node:test";

import { oauthFailurePath, safeOauthNext } from "./oauth-return.ts";

test("safeOauthNext accepts only the exact approved OAuth return paths", () => {
  assert.equal(safeOauthNext("/schedule"), "/schedule");
  assert.equal(safeOauthNext("/owner"), "/owner");
});

test("safeOauthNext rejects missing and dangerous OAuth return values", () => {
  const rejected = [
    null,
    "",
    "https://evil.example/schedule",
    "//evil.example/schedule",
    String.raw`\schedule`,
    "/%5cschedule",
    "/%5Cschedule",
    "/%2fschedule",
    "/%2Fschedule",
    "/schedule\n",
    "/schedule#fragment",
    "/schedule?tab=week",
    "/schedule/../owner",
    "/schedule/%2e%2e/owner",
    "/%2e/schedule",
    "/schedule/",
    "/other",
  ];

  for (const value of rejected) {
    assert.equal(safeOauthNext(value), "/", `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test("oauthFailurePath returns failures to the safe initiating surface", () => {
  assert.equal(oauthFailurePath("/schedule"), "/schedule?auth_error=oauth");
  assert.equal(oauthFailurePath("/owner"), "/owner/login?error=oauth");
  assert.equal(oauthFailurePath("/"), "/owner/login?error=oauth");
});
