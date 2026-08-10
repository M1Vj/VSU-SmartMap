import assert from "node:assert/strict";
import test from "node:test";
import { PostgrestClient } from "@supabase/postgrest-js";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/map/search-suggestions";

import { buildRoomSearchFilter, searchRooms } from "./rooms.ts";

test("room search filters normalize code separators without normalizing prose", () => {
  const filter = buildRoomSearchFilter(" AbC 123 ");

  assert.match(filter, /room_code\.ilike\."%a%b%c%1%2%3%"/);
  assert.match(filter, /name\.ilike\."%AbC 123%"/);
  assert.match(filter, /description\.ilike\."%AbC 123%"/);
  assert.doesNotMatch(filter, /name\.ilike\."%a%b%c%1%2%3%"/);
});

test("empty room search keeps the room-code candidate for the offline prefetch", () => {
  assert.match(buildRoomSearchFilter(""), /room_code\.ilike\."%%"/);
});

test("punctuation-only remote searches stay in literal text fields", () => {
  const filter = buildRoomSearchFilter("(");
  assert.doesNotMatch(filter, /room_code\.ilike\./);
  assert.match(filter, /name\.ilike\."%\(%"/);
  assert.match(filter, /description\.ilike\."%\(%"/);
});

test("bounds room filter terms before URL construction", () => {
  const filter = buildRoomSearchFilter("A".repeat(MAX_SEARCH_QUERY_LENGTH + 20));
  assert.ok(filter.includes(`name.ilike."%${"A".repeat(MAX_SEARCH_QUERY_LENGTH)}%"`));
  assert.equal(filter.includes("A".repeat(MAX_SEARCH_QUERY_LENGTH + 1)), false);
});

test("room search quotes every reserved character in the raw PostgREST logic value", () => {
  const cases = [
    { input: "A,B", escaped: "A,B" },
    { input: "A(B)", escaped: "A(B)" },
    { input: 'A"B', escaped: 'A\\"B' },
    { input: String.raw`A\B`, escaped: `A${"\\".repeat(4)}B` },
    { input: "A%B", escaped: String.raw`A\\%B` },
    { input: "A_B", escaped: String.raw`A\\_B` },
  ];

  for (const { input, escaped } of cases) {
    const filter = buildRoomSearchFilter(input);
    assert.ok(filter.includes(`name.ilike."%${escaped}%"`));
    assert.ok(filter.includes(`description.ilike."%${escaped}%"`));
    assert.match(filter, /room_code\.ilike\./);

    const query = new PostgrestClient("https://example.test")
      .from("rooms")
      .select("id")
      .or(filter);
    const url = (query as unknown as { url: URL }).url;
    assert.equal(url.searchParams.get("or"), `(${filter})`);
  }
});

test("remote wildcard candidates are filtered by the shared room matcher", async () => {
  const rows = [
    { id: "match", facility_id: "facility", room_code: "ABC-123", name: "Science Lab", description: null },
    { id: "false", facility_id: "facility", room_code: "AXB-C-123", name: "Other Lab", description: null },
    { id: "prose", facility_id: "facility", room_code: "ROOM-9", name: "Other Room", description: "ABC 123 Annex" },
    { id: "name", facility_id: "facility", room_code: "ROOM-10", name: "ABC123 Lab", description: null },
  ];
  let remoteFilter = "";
  const queryBuilder = {
    select() {
      return this;
    },
    or(filters: string) {
      remoteFilter = filters;
      return this;
    },
    order() {
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const client = {
    from() {
      return queryBuilder;
    },
  } as never;

  const result = await searchRooms({ term: "ABC123", client });

  assert.match(remoteFilter, /name\.ilike\./);
  assert.deepEqual(result.data?.map((room) => room.id), ["match", "name"]);
});
