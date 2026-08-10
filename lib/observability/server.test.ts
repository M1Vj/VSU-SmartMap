import assert from "node:assert/strict";
import test, { mock } from "node:test";

let tableNames: string[] = [];
let insertedRows: Array<Record<string, unknown>> = [];
let insertError: { message: string } | null = null;

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return {
        from(table: string) {
          tableNames.push(table);
          assert.equal(table, "app_log_events", "public telemetry must never touch incidents");
          return {
            async insert(rows: Array<Record<string, unknown>>) {
              insertedRows.push(...rows);
              return { error: insertError };
            },
          };
        },
      };
    },
  },
});

const serverModule = import("./server.ts");

test.beforeEach(() => {
  tableNames = [];
  insertedRows = [];
  insertError = null;
});

test("recordClientTelemetryEvents writes one direct batch with no incident linkage", async () => {
  const { recordClientTelemetryEvents } = await serverModule;
  const result = await recordClientTelemetryEvents([
    {
      source: "client",
      level: "fatal",
      eventName: "browser.error",
      message: "TypeError",
      route: "/map",
      method: "DELETE",
      statusCode: 599,
      metadata: {},
      breadcrumbs: [],
    },
    {
      source: "client",
      level: "info",
      eventName: "page.view",
      route: "/events",
      metadata: {},
      breadcrumbs: [],
    },
  ]);

  assert.deepEqual(result, { accepted: 2, failed: 0 });
  assert.deepEqual(tableNames, ["app_log_events"]);
  assert.equal(insertedRows.length, 2);
  for (const row of insertedRows) {
    assert.match(
      String(row.id),
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "persisted telemetry must always have a canonical UUID",
    );
    assert.equal(
      Number.isFinite(Date.parse(String(row.occurred_at))),
      true,
      "persisted telemetry must always have a valid occurrence timestamp",
    );
    assert.equal(row.incident_id, null);
    assert.equal(row.fingerprint, null);
    assert.equal(row.source, "client");
    assert.equal(row.method, undefined);
    assert.equal(row.status_code, undefined);
  }
  assert.equal(insertedRows[0]?.level, "error");
});

test("recordClientTelemetryEvents fails the bounded batch without incident fallback", async () => {
  insertError = { message: "private database detail" };
  const { recordClientTelemetryEvents } = await serverModule;
  const result = await recordClientTelemetryEvents([
    { source: "client", level: "warn", eventName: "browser.offline" },
  ]);

  assert.deepEqual(result, { accepted: 0, failed: 1 });
  assert.deepEqual(tableNames, ["app_log_events"]);
});
