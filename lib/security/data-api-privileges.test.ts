import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server-only write revokes tolerate absent legacy tables", async () => {
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20260716001500_explicit_data_api_privileges.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /FOREACH relation_name IN ARRAY/);
  assert.match(migration, /to_regclass\(format\('public\.%I'/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.%I/);
  assert.doesNotMatch(
    migration,
    /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.submissions/,
  );
});
