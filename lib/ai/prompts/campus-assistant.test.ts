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

test("coursework and personal records have distinct official portal referrals", () => {
  assert.match(CAMPUS_ASSISTANT_PROMPT, /personal class schedules or grades[^\n]*https:\/\/my\.vsu\.edu\.ph\//);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /quizzes, or virtual classrooms[^.]*https:\/\/elearning\.vsu\.edu\.ph\//);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /without guessing private course links or access/);
});

test("reply-language preferences and code-only follow-ups preserve the output contract", () => {
  assert.match(CAMPUS_ASSISTANT_PROMPT, /explicitly requests \(including Cebuano\/Bisaya\).*response text only/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /JSON keys, record values, and grounding and safety rules unchanged/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /only a place name or code, use the language of the latest substantive user turn/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /none to carry over, use plain Taglish/);
});

test("campus clarification is conditional and does not return a destination card", () => {
  assert.match(CAMPUS_ASSISTANT_PROMPT, /asks for a place or destination at a different campus, do not route the visitor to Baybay or suggest a Baybay alternative/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /Leave facilities as \[\].*SmartMap covers only the Main Campus in Baybay/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /different campus mentioned only as the starting point does not rule out a verified Baybay destination/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /Ask which VSU campus they mean only if it is unclear and would change the answer/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /While waiting for clarification, leave facilities as \[\] and do not suggest a destination/);
  assert.match(CAMPUS_ASSISTANT_PROMPT, /clear they mean Main Campus in Baybay, proceed without asking to confirm the campus/);
});
