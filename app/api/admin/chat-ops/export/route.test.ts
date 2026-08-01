import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat ops CSV export authenticates before its bounded sanitized query", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  const authorization = source.indexOf("await assertAdminAction()")
  const query = source.indexOf("getChatOpsDashboard(");
  assert.ok(authorization >= 0);
  assert.ok(query > authorization);
  assert.match(source, /admin\.serviceClient/);
  assert.match(source, /limit: 100/);
  assert.match(source, /serializeChatOpsCsv/);
  assert.doesNotMatch(source, /feedback_token_hash|metadata/);
});
