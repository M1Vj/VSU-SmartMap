import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatOpsDashboard } from "./chat-ops-dashboard.tsx";

test("ChatOpsDashboard renders operational summaries and sanitized recent activity", () => {
  const html = renderToStaticMarkup(<ChatOpsDashboard data={{
    summary: {
      totalTurns: 1,
      outcomes: { live: 1 },
      latencyP50Ms: 240, latencyP95Ms: 240, ttftP50Ms: 80, ttftP95Ms: 80,
      fallbackRate: 0, errorRate: 0, negativeFeedbackRate: 1,
      cacheHits: 0,
      groundedTurns: 1,
      validationWarnings: 0,
      injectionSignals: { direct_override: 1 },
      models: { "model-b": 1 },
      positiveFeedback: 0,
      negativeFeedback: 1,
    },
    turns: [{
      id: "turn-1",
      createdAt: "2026-08-01T01:00:00.000Z",
      releaseId: "ai_release",
      requestId: "request-1",
      userMessage: "Where is the library?",
      assistantMessage: "Near the administration building.",
      outcome: "live",
      requestedModel: "model-a",
      selectedModel: "model-b",
      latencyMs: 240,
      timeToFirstTokenMs: 80,
      cacheState: "miss",
      retrievedRecordIds: ["facility-1"],
      grounded: true,
      validationStatus: "pass",
      validationReasons: [],
      injectionSignals: ["direct_override"],
      errorClass: null,
      reviewStatus: "unreviewed",
    }],
    feedback: [{
      id: "feedback-1",
      turnId: "turn-1",
      rating: "negative",
      reason: "incorrect",
      comment: "The building moved.",
      reviewStatus: "unreviewed",
      createdAt: "2026-08-01T01:01:00.000Z",
    }],
    page: { limit: 50, offset: 0, hasMoreTurns: false, hasMoreFeedback: false },
    retention: { turnsDays: 90, feedbackDays: 90, alertClaimsDays: 30, alertWindowMinutes: 15 },
  }} />);

  assert.match(html, /Chat outcomes/);
  assert.match(html, /Latency/);
  assert.match(html, /Grounding/);
  assert.match(html, /Prompt-injection signals/);
  assert.match(html, /Recent sanitized turns/);
  assert.match(html, /Feedback/);
  assert.doesNotMatch(html, /token hash|raw metadata/i);
});

test("ChatOpsDashboard renders a useful empty state", () => {
  const html = renderToStaticMarkup(<ChatOpsDashboard data={{
    summary: {
      totalTurns: 0, outcomes: {}, latencyP50Ms: null, latencyP95Ms: null,
      ttftP50Ms: null, ttftP95Ms: null, fallbackRate: 0, errorRate: 0,
      negativeFeedbackRate: 0, cacheHits: 0, groundedTurns: 0,
      validationWarnings: 0, injectionSignals: {}, models: {},
      positiveFeedback: 0, negativeFeedback: 0,
    },
    turns: [], feedback: [],
    page: { limit: 50, offset: 0, hasMoreTurns: false, hasMoreFeedback: false },
    retention: { turnsDays: 90, feedbackDays: 90, alertClaimsDays: 30, alertWindowMinutes: 15 },
  }} />);
  assert.match(html, /No chat operations captured yet/);
});
