export const runtime = "nodejs";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { consumeRateLimit, hashRateLimitSubject } from "@/lib/security/rate-limit";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  UploadPolicyError,
  inspectSuggestionImage,
  isSuggestionUploadKind,
  readBoundedRequestBody,
  resolveSuggestionUploadTarget,
} from "@/lib/uploads/policy";

const UPLOAD_WINDOW_SECONDS = 15 * 60;
const UPLOAD_REQUEST_LIMIT = 10;
const UPLOAD_BYTE_LIMIT = 25 * 1024 * 1024;
const UPLOAD_TTL_MS = 30 * 60 * 1000;

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error },
    { status, headers: { "cache-control": "no-store", ...headers } },
  );
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

async function parseBoundedForm(request: Request) {
  const body = await readBoundedRequestBody(request);
  const parsedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: new Blob([Uint8Array.from(body)]),
  });
  return parsedRequest.formData();
}

export async function POST(request: Request) {
  try {
    const formData = await parseBoundedForm(request);
    if (
      formData.has("bucket") ||
      formData.has("path") ||
      formData.has("publicUrl")
    ) {
      return jsonError("Invalid upload payload.", 400);
    }

    const kind = formData.get("kind");
    const tempId = formData.get("tempId");
    const file = formData.get("file");
    const turnstileToken = formData.get("turnstileToken");
    const idempotencyKey = formData.get("idempotencyKey");
    if (
      typeof kind !== "string" ||
      !isSuggestionUploadKind(kind) ||
      typeof tempId !== "string" ||
      !(file instanceof File) ||
      typeof turnstileToken !== "string" ||
      turnstileToken.length < 1 ||
      turnstileToken.length > 4096 ||
      (idempotencyKey !== null && (
        typeof idempotencyKey !== "string" || idempotencyKey.length > 128
      ))
    ) {
      return jsonError("Invalid upload payload.", 400);
    }

    const verification = await verifyTurnstileToken(
      turnstileToken,
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey
        : undefined,
    );
    if (!verification.success) return jsonError("Upload verification failed.", 403);

    const inspected = await inspectSuggestionImage(file);
    const ip = clientIp(request);
    const ownerHash = hashRateLimitSubject(ip);
    if (!ownerHash) return jsonError("Unable to accept upload.", 400);

    const quota = await consumeRateLimit({
      scope: "public:suggestion-upload",
      subject: ip,
      requestLimit: UPLOAD_REQUEST_LIMIT,
      byteLimit: UPLOAD_BYTE_LIMIT,
      windowSeconds: UPLOAD_WINDOW_SECONDS,
      costBytes: inspected.bytes.byteLength,
    });
    if (!quota.allowed) {
      return jsonError("Too many uploads. Please try again later.", 429, {
        "retry-after": String(quota.retryAfterSeconds),
      });
    }

    const uploadId = randomUUID();
    const { bucket, objectPath } = resolveSuggestionUploadTarget(
      kind,
      tempId,
      uploadId,
      inspected.format,
    );
    const now = new Date();
    const supabase = getSupabaseServiceRoleClient();
    const { error: pendingError } = await supabase
      .from("pending_suggestion_uploads")
      .insert({
        id: uploadId,
        kind,
        bucket,
        object_path: objectPath,
        owner_hash: ownerHash,
        bytes: inspected.bytes.byteLength,
        verified_at: now.toISOString(),
        claimed_at: null,
        expires_at: new Date(now.getTime() + UPLOAD_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (pendingError) return jsonError("Unable to store upload.", 500);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, inspected.bytes, {
        upsert: false,
        contentType: inspected.contentType,
        cacheControl: "3600",
      });
    if (uploadError) {
      await supabase.from("pending_suggestion_uploads").delete().eq("id", uploadId);
      return jsonError("Unable to store upload.", 500);
    }

    return NextResponse.json(
      { uploadId, path: objectPath },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof UploadPolicyError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Invalid upload payload.", 400);
  }
}
