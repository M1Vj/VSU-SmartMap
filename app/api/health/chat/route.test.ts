import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

let generationResult = {
  output: { response: "Synthetic health response", facilities: [] },
  operations: {
    generation: { selectedModel: "gemini-safe-model", attemptCount: 1 },
    grounding: { outcome: "pass" },
    retrievedRecordIds: [],
  },
};
let generationCalls: unknown[] = [];
let generationError: Error | null = null;
let traceSessions: Array<Record<string, unknown>> = [];
let traceFinalizations: Array<Record<string, unknown>> = [];
let alertCalls: Array<Record<string, unknown>> = [];
let traceError: Error | null = null;
let alertError: Error | null = null;

mock.module("@/lib/ai/flows/find-location", {
  namedExports: {
    async executeFindLocation(input: unknown, options?: { abortSignal?: AbortSignal }) {
      generationCalls.push({ input, hasAbortSignal: options?.abortSignal instanceof AbortSignal });
      if (generationError) throw generationError;
      return generationResult;
    },
  },
});

mock.module("@/lib/ai/ops/trace", {
  namedExports: {
    createChatTurnSession(input: Record<string, unknown>) {
      traceSessions.push(input);
      return {
        identity: {
          turnId: "synthetic-turn-id",
          conversationId: "synthetic-conversation-id",
          requestId: "synthetic-request-id",
          feedbackToken: "must-never-be-returned",
          feedbackTokenHash: "stored-hash",
        },
        markFirstToken() {},
        async finalize(input: Record<string, unknown>) {
          traceFinalizations.push(input);
          if (traceError) throw traceError;
        },
      };
    },
  },
});

mock.module("@/lib/ai/ops/alerts", {
  namedExports: {
    async notifyChatOpsAlert(input: Record<string, unknown>) {
      alertCalls.push(input);
      if (alertError) throw alertError;
      return { claimed: true, notified: true };
    },
  },
});

mock.module("@/lib/ai/ops/release", {
  namedExports: { AI_RELEASE_ID: "ai_test_release" },
});

const routeModule = import("./route.ts");

function request(secret?: string) {
  return new Request("https://example.test/api/health/chat", {
    headers: secret === undefined ? undefined : { "x-chat-health-secret": secret },
  });
}

test.beforeEach(() => {
  process.env.CHAT_HEALTH_SECRET = "server-health-secret";
  generationCalls = [];
  generationError = null;
  traceSessions = [];
  traceFinalizations = [];
  alertCalls = [];
  traceError = null;
  alertError = null;
  generationResult = {
    output: { response: "Synthetic health response", facilities: [] },
    operations: {
      generation: { selectedModel: "gemini-safe-model", attemptCount: 1 },
      grounding: { outcome: "pass" },
      retrievedRecordIds: [],
    },
  };
});

test("health route fails closed when its server secret is unavailable", async () => {
  delete process.env.CHAT_HEALTH_SECRET;
  const { GET } = await routeModule;
  const response = await GET(request("server-health-secret"));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: false, error: "unavailable" });
  assert.equal(generationCalls.length, 0);
});

test("health route rejects missing, wrong, and different-length client secrets", async () => {
  const { GET } = await routeModule;
  for (const secret of [undefined, "wrong-health-secret", "x"]) {
    const response = await GET(request(secret));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
  }
  assert.equal(generationCalls.length, 0);
});

test("health route runs a direct fixed synthetic generation and returns transcript-free metadata", async () => {
  const { GET } = await routeModule;
  const response = await GET(request("server-health-secret"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(generationCalls.length, 1);
  assert.deepEqual(generationCalls[0], {
    input: {
      query: "Synthetic health check: reply briefly that the campus assistant is operational without referring to any person, place, event, or listing.",
    },
    hasAbortSignal: true,
  });
  assert.equal(body.ok, true);
  assert.equal(body.releaseId, "ai_test_release");
  assert.equal(body.selectedModel, "gemini-safe-model");
  assert.equal(typeof body.latencyMs, "number");
  assert.equal(JSON.stringify(body).includes("Synthetic health response"), false);
  assert.deepEqual(Object.keys(body).sort(), ["latencyMs", "ok", "releaseId", "selectedModel"]);
  assert.equal(JSON.stringify(body).includes("must-never-be-returned"), false);
  assert.deepEqual(traceSessions, [{
    requestId: null,
    userMessage: "synthetic_chat_health_check",
    injectionSignals: [],
  }]);
  assert.deepEqual(traceFinalizations, [{
    assistantMessage: "Synthetic health response",
    outcome: "synthetic",
    selectedModel: "gemini-safe-model",
    attemptCount: 1,
    validationStatus: "pass",
    validationReasons: [],
    retrievedRecordIds: [],
    cacheState: "synthetic_direct",
    metadata: { synthetic: true, groundingOutcome: "pass" },
  }]);
  assert.equal(alertCalls.length, 0);
});

test("health route rejects blank or grounding-invalid generated output", async () => {
  const { GET } = await routeModule;
  generationResult.output.response = "   ";
  let response = await GET(request("server-health-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "generation_failed" });

  generationResult.output.response = "Synthetic health response";
  generationResult.operations.grounding.outcome = "fail";
  response = await GET(request("server-health-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "validation_failed" });
  assert.equal(traceFinalizations.at(-1)?.outcome, "error");
  assert.equal(traceFinalizations.at(-1)?.validationStatus, "fail");
  assert.deepEqual(alertCalls.at(-1), {
    outcome: "error",
    errorClass: "validation_error",
    releaseId: "ai_test_release",
    requestId: "synthetic-request-id",
    aggregate: { failureCount: 1 },
  });
  assert.equal(JSON.stringify(alertCalls).includes("Synthetic health response"), false);
});

test("synthetic persistence and alert failures never alter the health result", async () => {
  const { GET } = await routeModule;
  traceError = new Error("private persistence detail");
  let response = await GET(request("server-health-secret"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);

  traceError = null;
  alertError = new Error("private notification detail");
  generationError = new Error("private provider transcript");
  response = await GET(request("server-health-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "generation_failed" });
  assert.equal(JSON.stringify(alertCalls).includes("private provider transcript"), false);
});

test("synthetic workflow and operator configuration keep secrets and transcripts out of logs", async () => {
  const root = new URL("../../../../", import.meta.url);
  const [workflow, environment, runbook, routeSource] = await Promise.all([
    readFile(new URL(".github/workflows/chat-synthetic.yml", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("docs/runbooks/chat-llmops.md", root), "utf8"),
    readFile(new URL("app/api/health/chat/route.ts", root), "utf8"),
  ]);

  assert.match(workflow, /cron:\s*['"]17,47 \* \* \* \*['"]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /vars\.PRODUCTION_URL/);
  assert.match(workflow, /secrets\.CHAT_HEALTH_SECRET/);
  assert.match(workflow, /--max-time 25/);
  assert.match(workflow, /--retry 2/);
  assert.match(workflow, /jq -e ['"]\.ok == true['"]/);
  assert.doesNotMatch(workflow, /echo .*CHAT_HEALTH_SECRET|echo .*response/i);
  assert.match(environment, /^CHAT_HEALTH_SECRET=$/m);
  assert.match(runbook, /CHAT_HEALTH_SECRET/);
  assert.match(runbook, /17 and 47 minutes past each hour/);
  assert.match(routeSource, /timingSafeEqual/);
  assert.match(routeSource, /20_000/);
});
