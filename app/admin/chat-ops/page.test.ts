import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat operations page requires admin authorization before querying", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const authorization = source.indexOf("await requireAdminSession()")
  const query = source.indexOf("getChatOpsDashboard(");
  assert.ok(authorization >= 0);
  assert.ok(query > authorization);
  assert.match(source, /session\.serviceClient/);
  assert.match(source, /<ChatOpsDashboard data=/);
});

test("admin navigation exposes Chat Operations", async () => {
  const source = await readFile(
    new URL("../../../components/admin/admin-sidebar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /href: ['"]\/admin\/chat-ops['"], label: ['"]Chat Operations['"]/);
});
