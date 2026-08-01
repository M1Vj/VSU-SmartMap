import { NextResponse } from "next/server";

import {
  FeedbackRequestError,
  parseFeedbackRequest,
  submitChatFeedback,
} from "@/lib/ai/ops/feedback";
import { getTrustedClientIp } from "@/lib/ai/ops/request";
import { consumeDurableChatFeedbackRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "cache-control": "no-store" };
const QUOTA_FAILURE_SECONDS = 15 * 60;

function json(body: Record<string, unknown>, status: number, headers: HeadersInit = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
}

export async function POST(request: Request) {
  let parsed: Awaited<ReturnType<typeof parseFeedbackRequest>>;
  try {
    parsed = await parseFeedbackRequest(request);
  } catch (error) {
    const status = error instanceof FeedbackRequestError ? error.status : 400;
    return json({ error: "Invalid feedback request." }, status);
  }

  let quota: Awaited<ReturnType<typeof consumeDurableChatFeedbackRateLimit>>;
  try {
    quota = await consumeDurableChatFeedbackRateLimit({
      subject: getTrustedClientIp(request.headers),
      costBytes: parsed.byteLength,
    });
  } catch {
    quota = { allowed: false, retryAfterSeconds: QUOTA_FAILURE_SECONDS };
  }
  if (!quota.allowed) {
    return json(
      { error: "Too many feedback requests. Please try again later." },
      429,
      { "retry-after": String(Math.max(1, quota.retryAfterSeconds)) },
    );
  }

  const result = await submitChatFeedback(parsed.data);
  if (result === "accepted") return json({ accepted: true }, 200);
  if (result === "forbidden") return json({ error: "Unable to accept feedback." }, 403);
  return json({ error: "Unable to accept feedback." }, 500);
}

