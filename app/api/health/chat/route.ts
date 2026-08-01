import { createHash, timingSafeEqual } from "node:crypto";

import { executeFindLocation } from "@/lib/ai/flows/find-location";
import { notifyChatOpsAlert } from "@/lib/ai/ops/alerts";
import { AI_RELEASE_ID } from "@/lib/ai/ops/release";
import { createChatTurnSession, type ChatTurnSession } from "@/lib/ai/ops/trace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = 20_000;
const SYNTHETIC_QUERY =
  "Synthetic health check: reply briefly that the campus assistant is operational without referring to any person, place, event, or listing.";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function safeModel(value: string | undefined): string | undefined {
  return value && /^[a-z0-9._-]{1,120}$/i.test(value) ? value : undefined;
}

async function executeSyntheticGeneration() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    return await executeFindLocation(
      { query: SYNTHETIC_QUERY },
      { abortSignal: controller.signal },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function finalizeSafely(
  session: ChatTurnSession,
  input: Parameters<ChatTurnSession["finalize"]>[0],
) {
  try {
    await session.finalize(input);
  } catch {
  }
}

async function alertSafely(input: Parameters<typeof notifyChatOpsAlert>[0]) {
  try {
    await notifyChatOpsAlert(input);
  } catch {
  }
}

async function recordSyntheticFailure(
  session: ChatTurnSession,
  options: {
    errorClass: "provider_error" | "validation_error";
    validationReasons: string[];
    groundingOutcome: string;
    selectedModel?: string;
    attemptCount?: number;
    retrievedRecordIds?: string[];
  },
) {
  await Promise.all([
    finalizeSafely(session, {
      outcome: "error",
      selectedModel: options.selectedModel,
      attemptCount: options.attemptCount,
      validationStatus: "fail",
      validationReasons: options.validationReasons,
      retrievedRecordIds: options.retrievedRecordIds,
      cacheState: "synthetic_direct",
      errorClass: options.errorClass,
      metadata: { synthetic: true, groundingOutcome: options.groundingOutcome },
    }),
    alertSafely({
      outcome: "error",
      errorClass: options.errorClass,
      releaseId: AI_RELEASE_ID,
      requestId: session.identity.requestId,
      aggregate: { failureCount: 1 },
    }),
  ]);
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CHAT_HEALTH_SECRET;
  if (!expectedSecret) return json({ ok: false, error: "unavailable" }, 503);

  const providedSecret = request.headers.get("x-chat-health-secret") ?? "";
  if (!secretsMatch(providedSecret, expectedSecret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const session = createChatTurnSession({
    requestId: request.headers.get("x-request-id"),
    userMessage: "synthetic_chat_health_check",
    injectionSignals: [],
  });
  const startedAt = performance.now();
  try {
    const result = await executeSyntheticGeneration();
    const selectedModel = safeModel(result.operations.generation?.selectedModel);
    if (!result.output.response.trim()) {
      await recordSyntheticFailure(session, {
        errorClass: "validation_error",
        validationReasons: ["blank_output"],
        groundingOutcome: result.operations.grounding.outcome,
        selectedModel,
        attemptCount: result.operations.generation?.attemptCount,
        retrievedRecordIds: result.operations.retrievedRecordIds,
      });
      return json({ ok: false, error: "generation_failed" }, 503);
    }
    if (result.operations.grounding.outcome === "fail") {
      await recordSyntheticFailure(session, {
        errorClass: "validation_error",
        validationReasons: result.operations.grounding.reasonCodes,
        groundingOutcome: result.operations.grounding.outcome,
        selectedModel,
        attemptCount: result.operations.generation?.attemptCount,
        retrievedRecordIds: result.operations.retrievedRecordIds,
      });
      return json({ ok: false, error: "validation_failed" }, 503);
    }

    await finalizeSafely(session, {
      assistantMessage: result.output.response,
      outcome: "synthetic",
      selectedModel,
      attemptCount: result.operations.generation?.attemptCount,
      validationStatus: "pass",
      validationReasons: [],
      retrievedRecordIds: result.operations.retrievedRecordIds,
      cacheState: "synthetic_direct",
      metadata: { synthetic: true, groundingOutcome: result.operations.grounding.outcome },
    });
    return json({
      ok: true,
      releaseId: AI_RELEASE_ID,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...(selectedModel ? { selectedModel } : {}),
    }, 200);
  } catch {
    await recordSyntheticFailure(session, {
      errorClass: "provider_error",
      validationReasons: ["generation_failed"],
      groundingOutcome: "unavailable",
    });
    return json({ ok: false, error: "generation_failed" }, 503);
  }
}
