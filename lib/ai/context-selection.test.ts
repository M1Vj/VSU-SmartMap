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
