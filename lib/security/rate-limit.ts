import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { createClient } from "@supabase/supabase-js";

const MAX_SUBJECT_LENGTH = 512;
const MAX_REQUEST_LIMIT = 10_000;
const MAX_BYTE_LIMIT = 100_000_000;
const MAX_WINDOW_SECONDS = 86_400;
const DEFAULT_RETRY_AFTER_SECONDS = 60;
const SCOPE_PATTERN = /^[a-z][a-z0-9:_-]{0,63}$/;

export type ConsumeRateLimitInput = {
  scope: string;
  subject: string;
  requestLimit: number;
  byteLimit?: number;
  windowSeconds: number;
  costBytes?: number;
};

export type ConsumeRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitRpcRow = {
  allowed: boolean;
  retry_after_seconds: number;
};

function isBoundedInteger(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function failureResult(windowSeconds: number): ConsumeRateLimitResult {
  return {
    allowed: false,
    retryAfterSeconds: isBoundedInteger(windowSeconds, 1, MAX_WINDOW_SECONDS)
      ? windowSeconds
      : DEFAULT_RETRY_AFTER_SECONDS,
  };
}

function normalizeMappedIpv4(canonicalAddress: string) {
  const match = canonicalAddress.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  );
  if (!match) return canonicalAddress;

  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function normalizeSubject(subject: string) {
  const candidate = subject.trim();
  const version = isIP(candidate);

  if (version === 4) return candidate;
  if (version !== 6) return null;

  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    if (!hostname.startsWith("[") || !hostname.endsWith("]")) return null;

    const canonicalAddress = hostname.slice(1, -1);
    return isIP(canonicalAddress) === 6
      ? normalizeMappedIpv4(canonicalAddress)
      : null;
  } catch {
    return null;
  }
}

export function hashRateLimitSubject(subject: string): string | null {
  const normalizedSubject = normalizeSubject(subject);
  const pepper = process.env.ABUSE_RATE_LIMIT_PEPPER;
  if (!normalizedSubject || !pepper) return null;

  return createHmac("sha256", pepper)
    .update(normalizedSubject)
    .digest("hex");
}

function isValidInput(input: ConsumeRateLimitInput, normalizedSubject: string) {
  return (
    SCOPE_PATTERN.test(input.scope) &&
    normalizedSubject.length > 0 &&
    normalizedSubject.length <= MAX_SUBJECT_LENGTH &&
    isBoundedInteger(input.requestLimit, 1, MAX_REQUEST_LIMIT) &&
    (input.byteLimit === undefined ||
      isBoundedInteger(input.byteLimit, 1, MAX_BYTE_LIMIT)) &&
    isBoundedInteger(input.windowSeconds, 1, MAX_WINDOW_SECONDS) &&
    (input.costBytes === undefined ||
      isBoundedInteger(input.costBytes, 0, MAX_BYTE_LIMIT))
  );
}

export async function consumeRateLimit(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  const failure = failureResult(input.windowSeconds);
  const normalizedSubject =
    typeof input.subject === "string" ? normalizeSubject(input.subject) : null;

  if (!normalizedSubject || !isValidInput(input, normalizedSubject)) return failure;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const subjectHash = hashRateLimitSubject(normalizedSubject);
  if (!subjectHash || !supabaseUrl || !serviceRoleKey) return failure;

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await supabase.rpc("consume_security_rate_limit", {
      p_scope: input.scope,
      p_subject_hash: subjectHash,
      p_request_limit: input.requestLimit,
      p_byte_limit: input.byteLimit ?? null,
      p_window_seconds: input.windowSeconds,
      p_cost_bytes: input.costBytes ?? 0,
    });

    if (error) return failure;

    const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcRow | null;
    if (
      !row ||
      typeof row.allowed !== "boolean" ||
      !isBoundedInteger(row.retry_after_seconds, 0, input.windowSeconds)
    ) {
      return failure;
    }

    return {
      allowed: row.allowed,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch {
    return failure;
  }
}
