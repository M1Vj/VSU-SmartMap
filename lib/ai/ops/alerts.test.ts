import assert from "node:assert/strict";
import test, { mock } from "node:test";

let claimResult: boolean | null = true;
let claimError: Error | null = null;
let notificationError: Error | null = null;
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const notifications: Array<Record<string, unknown>> = [];

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return {
        async rpc(name: string, args: Record<string, unknown>) {
          rpcCalls.push({ name, args });
          if (claimError) throw claimError;
          return { data: claimResult, error: null };
        },
      };
    },
  },
});

mock.module("@/lib/notifications/service", {
  namedExports: {
    async notifyAdmins(input: Record<string, unknown>) {
      notifications.push(input);
      if (notificationError) throw notificationError;
    },
  },
});

const alertsModule = import("./alerts.ts");

function reset() {
  claimResult = true;
  claimError = null;
  notificationError = null;
  rpcCalls.length = 0;
  notifications.length = 0;
}

test.beforeEach(reset);

test("claims one deduplicated safe admin alert", async () => {
  const { notifyChatOpsAlert } = await alertsModule;
  const result = await notifyChatOpsAlert({
    outcome: "error",
    errorClass: "provider_timeout",
    releaseId: "release-123",
    requestId: "iad1::request-123",
    occurredAt: new Date("2026-08-01T04:05:00.000Z"),
    aggregate: {
      affectedTurns: 3,
      fallbackCount: 2,
      prompt: "do not send this transcript",
      response: "do not send this answer",
      ip: "203.0.113.5",
      feedbackToken: "private-feedback-token",
      providerRawError: "provider response body",
    },
  } as never);

  assert.deepEqual(result, { claimed: true, notified: true });
  assert.deepEqual(rpcCalls, [{
    name: "claim_ai_chat_alert",
    args: {
      p_fingerprint: "chat_ops:error:provider_timeout",
      p_occurred_at: "2026-08-01T04:05:00.000Z",
      p_metadata: {
        outcome: "error",
        errorClass: "provider_timeout",
        releaseId: "release-123",
        requestId: "iad1::request-123",
        aggregate: { affectedTurns: 3, fallbackCount: 2 },
      },
    },
  }]);
  assert.deepEqual(notifications, [{
    eventType: "chat_ops_alert",
    subject: "Chat operations alert: error (provider_timeout)",
    text: [
      "Outcome: error",
      "Error class: provider_timeout",
      "Release: release-123",
      "Request ID: iad1::request-123",
      "Aggregate: affectedTurns=3, fallbackCount=2",
    ].join("\n"),
    metadata: {
      outcome: "error",
      errorClass: "provider_timeout",
      releaseId: "release-123",
      requestId: "iad1::request-123",
      aggregate: { affectedTurns: 3, fallbackCount: 2 },
    },
  }]);
  assert.equal(JSON.stringify({ rpcCalls, notifications }).includes("do not send"), false);
  assert.equal(JSON.stringify({ rpcCalls, notifications }).includes("203.0.113.5"), false);
  assert.equal(JSON.stringify({ rpcCalls, notifications }).includes("private-feedback-token"), false);
  assert.equal(JSON.stringify({ rpcCalls, notifications }).includes("provider response body"), false);
});

test("does not notify when the fifteen-minute dedupe claim already exists", async () => {
  claimResult = false;
  const { notifyChatOpsAlert } = await alertsModule;
  const result = await notifyChatOpsAlert({ outcome: "static_fallback" });

  assert.deepEqual(result, { claimed: false, notified: false });
  assert.equal(notifications.length, 0);
});

test("fails open when claiming or delivering an alert fails", async () => {
  const { notifyChatOpsAlert } = await alertsModule;
  claimError = new Error("database unavailable");
  assert.deepEqual(
    await notifyChatOpsAlert({ outcome: "error", errorClass: "provider_error" }),
    { claimed: false, notified: false },
  );

  claimError = null;
  notificationError = new Error("email provider unavailable");
  assert.deepEqual(
    await notifyChatOpsAlert({ outcome: "error", errorClass: "provider_error" }),
    { claimed: true, notified: false },
  );
});
