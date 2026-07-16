import test from "node:test";
import assert from "node:assert/strict";

import {
  NOTIFICATION_EVENTS,
  normalizeRecipientEvents,
  recipientReceivesEvent,
  sanitizeRecipientEmail,
} from "./routing.ts";

test("sanitizeRecipientEmail trims and lowercases valid emails", () => {
  assert.equal(sanitizeRecipientEmail("  Admin@Example.COM "), "admin@example.com");
});

test("sanitizeRecipientEmail rejects malformed emails", () => {
  assert.equal(sanitizeRecipientEmail("not-an-email"), null);
  assert.equal(sanitizeRecipientEmail(""), null);
});

test("normalizeRecipientEvents keeps only known events and removes duplicates", () => {
  assert.deepEqual(
    normalizeRecipientEvents([
      "suggestion_submitted",
      "unknown",
      "suggestion_submitted",
      "boarding_house_report_submitted",
    ]),
    ["suggestion_submitted", "boarding_house_report_submitted"],
  );
});

test("normalizeRecipientEvents falls back to every event when no valid events are provided", () => {
  assert.deepEqual(normalizeRecipientEvents(["unknown"]), NOTIFICATION_EVENTS.map((event) => event.value));
});

test("recipientReceivesEvent respects enabled status and event subscriptions", () => {
  assert.equal(
    recipientReceivesEvent(
      { enabled: true, eventTypes: ["suggestion_submitted"] },
      "suggestion_submitted",
    ),
    true,
  );
  assert.equal(
    recipientReceivesEvent(
      { enabled: true, eventTypes: ["suggestion_submitted"] },
      "boarding_house_report_submitted",
    ),
    false,
  );
  assert.equal(
    recipientReceivesEvent(
      { enabled: false, eventTypes: ["suggestion_submitted"] },
      "suggestion_submitted",
    ),
    false,
  );
});
