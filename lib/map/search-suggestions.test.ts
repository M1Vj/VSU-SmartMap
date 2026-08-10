import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SEARCH_QUERY_LENGTH,
  boundSearchQuery,
  getRoomMatchedFacilityIds,
  getSearchSuggestions,
} from "./search-suggestions.ts";
import type { Facility } from "@/lib/types/facility";

function facility(overrides: Partial<Facility> & Pick<Facility, "id" | "name">): Facility {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    code: overrides.code,
    description: overrides.description,
    category: overrides.category ?? "academic",
    coordinates: overrides.coordinates ?? { lat: 10.74, lng: 124.79 },
    hasRooms: overrides.hasRooms ?? true,
    createdAt: overrides.createdAt ?? "2026-06-21T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-21T00:00:00.000Z",
  } as Facility;
}

const facilities = [
  facility({ id: "dstat", name: "Department of Statistics", code: "DSTAT" }),
  facility({ id: "library", name: "University Library", code: "ULIB", category: "library" }),
  facility({ id: "admin", name: "Administration Building", code: "ADMIN", category: "administrative" }),
  facility({ id: "math", name: "Department of Mathematics", code: "DMATH" }),
];

test("getSearchSuggestions matches facilities by name", () => {
  const suggestions = getSearchSuggestions({
    facilities,
    query: "library",
  });

  assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["library"]);
  assert.equal(suggestions[0]?.matchType, "name");
});

test("getSearchSuggestions matches facilities by code", () => {
  const suggestions = getSearchSuggestions({
    facilities,
    query: "dstat",
  });

  assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["dstat"]);
  assert.equal(suggestions[0]?.matchType, "code");
});

test("normalizes facility code separators while keeping code ranking exact", () => {
  const suggestions = getSearchSuggestions({
    facilities: [
      facility({ id: "code", name: "Code Hall", code: "ABC-123" }),
      facility({ id: "name", name: "ABC 123 Annex", code: "ANNEX" }),
    ],
    query: "abc 123",
  });

  assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["code", "name"]);
  assert.equal(suggestions[0]?.matchType, "code");
});

test("getSearchSuggestions matches legacy aliases in facility descriptions", () => {
  const suggestions = getSearchSuggestions({
    facilities: [
      facility({
        id: "dfst",
        name: "Department of Food Science and Technology",
        code: "DFST",
        description: "Search aliases: DFST, FT, FoodTech.",
      }),
    ],
    query: "ft",
  });

  assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["dfst"]);
  assert.equal(suggestions[0]?.matchType, "alias");
});

test("getRoomMatchedFacilityIds and getSearchSuggestions match rooms to their facilities", () => {
  const rooms = [
    { facility_id: "dstat", room_code: "DSTAT-201", name: "Statistics Lab" },
    { facility_id: "library", room_code: "LIB-101", name: "Reading Room" },
  ];

  assert.deepEqual([...getRoomMatchedFacilityIds(rooms, "201")], ["dstat"]);

  const suggestions = getSearchSuggestions({
    facilities,
    query: "201",
    rooms,
  });

  assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["dstat"]);
  assert.equal(suggestions[0]?.matchType, "room");
});

test("matches room codes across punctuation, whitespace, and casing variants without matching prose", () => {
  const rooms = [
    { facility_id: "science", room_code: "ABC-123", name: "Science Lab" },
    { facility_id: "prose", room_code: "ROOM-9", name: "ABC and 123 Annex" },
  ];
  const queries = ["ABC-123", "ABC123", "ABC 123", "abc.123", "aBc_123"];

  for (const query of queries) {
    assert.deepEqual([...getRoomMatchedFacilityIds(rooms, query)], ["science"]);

    const suggestions = getSearchSuggestions({
      facilities: [
        facility({ id: "science", name: "Science Hall", code: "SCI" }),
        facility({ id: "prose", name: "Prose Hall", code: "PROSE" }),
      ],
      query,
      rooms,
    });

    assert.deepEqual(suggestions.map((suggestion) => suggestion.facility.id), ["science"]);
    assert.equal(suggestions[0]?.matchType, "room");
    assert.equal(suggestions[0]?.matchedRoomCode, "ABC-123");
  }
});

test("treats punctuation-only queries as literal prose instead of canonical codes", () => {
  const rooms = [
    { facility_id: "code", room_code: "ABC", name: "Plain Room" },
    { facility_id: "name", room_code: "XYZ", name: "Room (Annex)" },
  ];

  assert.deepEqual([...getRoomMatchedFacilityIds(rooms, "(")], ["name"]);
  assert.deepEqual(
    getSearchSuggestions({
      facilities: [
        facility({ id: "code", name: "ABC Hall", code: "ABC" }),
        facility({ id: "name", name: "Room (Annex)", code: "XYZ" }),
      ],
      query: "(",
      rooms,
    }).map((suggestion) => suggestion.facility.id),
    ["name"],
  );
});

test("bounds search terms before matching or building remote requests", () => {
  const query = ` ${"A".repeat(MAX_SEARCH_QUERY_LENGTH + 20)} `;
  assert.equal(boundSearchQuery(query).length, MAX_SEARCH_QUERY_LENGTH);

  const suggestions = getSearchSuggestions({
    facilities: [facility({ id: "long", name: "A".repeat(MAX_SEARCH_QUERY_LENGTH), code: "LONG" })],
    query,
  });
  assert.equal(suggestions.length, 1);
});

test("getSearchSuggestions ranks exact and prefix code matches before name and room matches", () => {
  const suggestions = getSearchSuggestions({
    facilities: [
      facility({ id: "exact", name: "Department of Statistics", code: "DSTAT" }),
      facility({ id: "prefix", name: "Data Station", code: "DSTATX" }),
      facility({ id: "name", name: "DSTAT Annex", code: "ANNEX" }),
      facility({ id: "room", name: "Science Hall", code: "SCI" }),
    ],
    query: "dstat",
    rooms: [{ facility_id: "room", room_code: "DSTAT-101", name: "Classroom" }],
  });

  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.facility.id),
    ["exact", "prefix", "name", "room"],
  );
});

test("getSearchSuggestions caps results at eight", () => {
  const manyFacilities = Array.from({ length: 10 }, (_, index) =>
    facility({
      id: `academic-${index}`,
      name: `Academic Building ${index}`,
      code: `ACAD${index}`,
    }),
  );

  const suggestions = getSearchSuggestions({
    facilities: manyFacilities,
    query: "academic",
  });

  assert.equal(suggestions.length, 8);
});
