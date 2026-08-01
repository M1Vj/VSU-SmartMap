import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCATION_RESPONSE_TEXT_MAX_LENGTH,
  validateGroundedLocationResponse,
} from "./grounding.ts";

const context = {
  facilities: [
    { id: "facility-1", name: "University Library" },
    { id: "facility-2", name: "Student Center" },
  ],
  events: [
    {
      id: "event-1",
      title: "Foundation Day",
      startTime: "2026-08-10T01:00:00.000Z",
      endTime: "2026-08-10T09:00:00.000Z",
      locationText: "Lower Campus",
      category: "University",
    },
  ],
  boardingHouses: [{ id: "listing-1", name: "Green House" }],
} as const;

test("passes exact canonical references and deduplicates repeated IDs", () => {
  const facility = { facilityId: "facility-1", name: "University Library" };
  const event = {
    eventId: "event-1",
    title: "Foundation Day",
    startTime: "2026-08-10T01:00:00.000Z",
    endTime: "2026-08-10T09:00:00.000Z",
    locationText: "Lower Campus",
    category: "University",
  };
  const listing = { listingId: "listing-1", name: "Green House" };

  const result = validateGroundedLocationResponse(
    {
      response: "The event is at Lower Campus.",
      facilities: [facility, facility],
      events: [event, event],
      boardingHouses: [listing, listing],
    },
    context,
  );

  assert.equal(result.outcome, "pass");
  assert.deepEqual(result.reasonCodes, []);
  assert.deepEqual(result.response, {
    response: "The event is at Lower Campus.",
    facilities: [facility],
    events: [event],
    boardingHouses: [listing],
  });
});

test("drops fabricated or mismatched references and hard fails with fixed domain reasons", () => {
  const result = validateGroundedLocationResponse(
    {
      response: "Results",
      facilities: [
        { facilityId: "facility-1", name: "Invented Library Name" },
        { facilityId: "facility-404", name: "Nowhere" },
      ],
      events: [
        {
          eventId: "event-1",
          title: "Changed title",
          startTime: "2026-08-10T01:00:00.000Z",
          endTime: "2026-08-10T09:00:00.000Z",
          locationText: "Lower Campus",
          category: "University",
        },
      ],
      boardingHouses: [{ listingId: "listing-1", name: "GreenHaus" }],
    },
    context,
  );

  assert.equal(result.outcome, "fail");
  assert.deepEqual(result.reasonCodes, [
    "FACILITY_REFERENCE_INVALID",
    "EVENT_REFERENCE_INVALID",
    "BOARDING_HOUSE_REFERENCE_INVALID",
  ]);
  assert.deepEqual(result.response.facilities, []);
  assert.deepEqual(result.response.events, []);
  assert.deepEqual(result.response.boardingHouses, []);
});

test("requires every immutable event field to exactly match including optional location", () => {
  const result = validateGroundedLocationResponse(
    {
      response: "Event",
      facilities: [],
      events: [
        {
          eventId: "event-1",
          title: "Foundation Day",
          startTime: "2026-08-10T01:00:00.000Z",
          endTime: "2026-08-10T09:00:00.000Z",
          category: "University",
        },
      ],
    },
    context,
  );

  assert.equal(result.outcome, "fail");
  assert.deepEqual(result.reasonCodes, ["EVENT_REFERENCE_INVALID"]);
  assert.deepEqual(result.response.events, []);
});

test("limits facilities to six and fails a schema-limit violation", () => {
  const facilities = Array.from({ length: 7 }, (_, index) => ({
    id: `f-${index}`,
    name: `Facility ${index}`,
  }));

  const result = validateGroundedLocationResponse(
    {
      response: "Many facilities",
      facilities: facilities.map(({ id, name }) => ({ facilityId: id, name })),
    },
    { facilities, events: [], boardingHouses: [] },
  );

  assert.equal(result.outcome, "fail");
  assert.deepEqual(result.reasonCodes, ["FACILITY_LIMIT_EXCEEDED"]);
  assert.equal(result.response.facilities.length, 6);
});

test("warns for blank response text without judging its semantics", () => {
  const result = validateGroundedLocationResponse(
    { response: "   ", facilities: [] },
    context,
  );

  assert.equal(result.outcome, "warn");
  assert.deepEqual(result.reasonCodes, ["RESPONSE_TEXT_EMPTY"]);
  assert.equal(result.response.response, "");
});

test("truncates response text to the structured-output ceiling and warns", () => {
  const result = validateGroundedLocationResponse(
    { response: "x".repeat(LOCATION_RESPONSE_TEXT_MAX_LENGTH + 5), facilities: [] },
    context,
  );

  assert.equal(result.outcome, "warn");
  assert.deepEqual(result.reasonCodes, ["RESPONSE_TEXT_TRUNCATED"]);
  assert.equal(result.response.response.length, LOCATION_RESPONSE_TEXT_MAX_LENGTH);
});

test("fail outcome takes precedence while retaining response warnings", () => {
  const result = validateGroundedLocationResponse(
    {
      response: "",
      facilities: [{ facilityId: "missing", name: "Missing" }],
    },
    context,
  );

  assert.equal(result.outcome, "fail");
  assert.deepEqual(result.reasonCodes, [
    "RESPONSE_TEXT_EMPTY",
    "FACILITY_REFERENCE_INVALID",
  ]);
});
