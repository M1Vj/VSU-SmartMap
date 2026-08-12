import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRetrievalQuery,
  selectFacilitiesForChatContext,
  tokenizeForRetrieval,
} from "./context-selection.ts";
import type { FacilityChatContext } from "@/lib/supabase/queries/facilities.ts";

const facilities: FacilityChatContext[] = [
  {
    id: "admin",
    name: "Administration Building",
    code: "ADMIN",
    category: "administrative",
    description: "Registrar and central administration offices.",
  },
  {
    id: "dmath",
    name: "Department of Mathematics",
    code: "DMATH",
    category: "academic",
    description: "Mathematics classrooms.",
    rooms: [{ roomCode: "DMath-LecR3", name: "Lecture Room 3" }],
  },
  {
    id: "da",
    name: "Department of Agronomy",
    code: "DA",
    category: "academic",
    description: "Agronomy classrooms.",
    rooms: [{ roomCode: "DA Rm-203 / SMART ROOM", name: "Smart Room" }],
  },
  {
    id: "dpss",
    name: "Department of Pest Science",
    code: "DPSS",
    category: "academic",
    description: "Pest science classrooms.",
    rooms: [{ roomCode: "DPSS-9C", name: "Room 9C" }],
  },
  {
    id: "ict",
    name: "ICT Building",
    code: "ICT",
    category: "academic",
    description: "Computer laboratories and classrooms.",
    rooms: [{ roomCode: "ICT101", name: "Computer Laboratory 1" }],
  },
  {
    id: "food",
    name: "Food Stall",
    category: "dining",
    description: "Meals, snacks, and drinks.",
  },
  {
    id: "utility",
    name: "Public Comfort Room near Gym",
    category: "utility",
    description: "Comfort room and restroom facility.",
  },
];

test("tokenizeForRetrieval expands common campus aliases", () => {
  assert.deepEqual(tokenizeForRetrieval("Saan CR near gym?").sort(), [
    "bathroom",
    "comfort",
    "cr",
    "gym",
    "gymnasium",
    "restroom",
    "sports",
    "toilet",
    "utility",
  ]);
});

test("selectFacilitiesForChatContext prioritizes room-code parent buildings", () => {
  const selected = selectFacilitiesForChatContext(facilities, "Where is ICT101?");

  assert.equal(selected[0].id, "ict");
});

test("exact real room-code shapes select only their canonical parent as strongest context", () => {
  assert.deepEqual(
    selectFacilitiesForChatContext(facilities, "Where is DMath-LecR3?").map(({ id }) => id),
    ["dmath"],
  );
  assert.deepEqual(
    selectFacilitiesForChatContext(facilities, "How do I get to DA Rm-203?").map(({ id }) => id),
    ["da"],
  );
});

test("unknown room codes keep only plausible code context and never substitute a similar room", () => {
  const selected = selectFacilitiesForChatContext(facilities, "Where is DPSS-9D?");
  assert.deepEqual(selected.map(({ id }) => id), ["dpss"]);
  assert.equal(selected[0]?.rooms?.some(({ roomCode }) => roomCode === "DPSS-9D"), false);
});

test("generic location words do not flood context and the default remains bounded", () => {
  assert.deepEqual(tokenizeForRetrieval("Find this VSU campus room building"), []);
  assert.deepEqual(selectFacilitiesForChatContext(facilities, "Find this VSU campus room building"), []);
  const many = Array.from({ length: 20 }, (_, index): FacilityChatContext => ({
    id: `food-${index}`,
    name: `Food Stall ${index}`,
    category: "dining",
    description: "Meals and snacks.",
  }));
  assert.equal(selectFacilitiesForChatContext(many, "canteen").length, 12);
});

test("selectFacilitiesForChatContext includes category matches from local terms", () => {
  const selected = selectFacilitiesForChatContext(facilities, "Asa kainan?");

  assert.equal(selected[0].id, "food");
});

test("buildRetrievalQuery includes recent user turns and summary", () => {
  assert.match(
    buildRetrievalQuery("near there?", {
      conversationHistory: [
        { role: "user", content: "Where is the gym?" },
        { role: "assistant", content: "I found it." },
      ],
      summary: "Earlier: user asked about comfort rooms.",
    }),
    /near there\?.*Where is the gym\?.*comfort rooms/
  );
});
