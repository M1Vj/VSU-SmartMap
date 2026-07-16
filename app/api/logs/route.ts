import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { parseClientTelemetryPayload } from "@/lib/observability/client-telemetry";
import { recordClientTelemetryEvents } from "@/lib/observability/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_LIMIT = 60;
const BYTE_LIMIT = 512 * 1024;
const WINDOW_SECONDS = 15 * 60;
const NO_STORE_HEADERS = { "cache-control": "no-store" };

class TelemetryRequestError extends Error {
  constructor(
    readonly status: 400 | 413,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: HeadersInit = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...headers },
  });
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new TelemetryRequestError(413, "Telemetry payload is too large.");
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new TelemetryRequestError(413, "Telemetry payload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

export async function POST(request: Request) {
  let body: Uint8Array;
  try {
    body = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof TelemetryRequestError) {
      return jsonResponse({ error: error.publicMessage }, error.status);
    }
    return jsonResponse({ error: "Invalid telemetry payload." }, 400);
  }

  let quota: { allowed: boolean; retryAfterSeconds: number };
  try {
    quota = await consumeRateLimit({
      scope: "public:client-logs",
      subject: clientAddress(request),
      requestLimit: REQUEST_LIMIT,
      byteLimit: BYTE_LIMIT,
      windowSeconds: WINDOW_SECONDS,
      costBytes: body.byteLength,
    });
  } catch {
    quota = { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
  }
  if (!quota.allowed) {
    return jsonResponse(
      { error: "Too many telemetry requests. Please try again later." },
      429,
      { "retry-after": String(Math.max(1, quota.retryAfterSeconds)) },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return jsonResponse({ error: "Invalid telemetry payload." }, 400);
  }

  const parsed = parseClientTelemetryPayload(payload, {
    requestId: randomUUID(),
    userAgent: request.headers.get("user-agent") ?? undefined,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION,
  });
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  try {
    const result = await recordClientTelemetryEvents(parsed.events);
    if (result.failed > 0) {
      return jsonResponse({ error: "Unable to record telemetry." }, 500);
    }
    return jsonResponse(result, 202);
  } catch {
    return jsonResponse({ error: "Unable to record telemetry." }, 500);
  }
}
