import assert from "node:assert/strict";
import test from "node:test";
import { CAMPUS_ASSISTANT_PROMPT } from "./campus-assistant.ts";

test("the campus prompt bounds its public guidance and gives verified VSU destinations", () => {
  assert.match(CAMPUS_ASSISTANT_PROMPT, /Main Campus in Visca, Baybay City, Leyte/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /unofficial student-led map/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /https:\/\/www\.vsu\.edu\.ph\/about/);
  assert.doesNotMatch(CAMPUS_ASSISTANT_PROMPT, /vsu\.edu\.ph\/support\/map|location-and-facilities/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /different campus.*do not route.*Baybay/i);
  assert.doesNotMatch(CAMPUS_ASSISTANT_PROMPT, /Third Year|parking is usually available/);
});

test("the prompt keeps exact room lookup, current-status limits and output boundaries", () => {
  assert.match(CAMPUS_ASSISTANT_PROMPT, /never infer.*containing building/i);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /List each requested room code that is not present/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /Do not guess whether gates, parking, or offices are open/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /without requesting an account, student ID, or private schedule/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /Return exactly one JSON object/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /exact facilityId and name, maximum six/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /off-campus rentals, use only matching boarding-house listings/);
});
