import { createHash, randomBytes } from "node:crypto";

import { redactSensitiveText } from "@/lib/observability/logging";

const SECRET_KEY_PATTERN =
  /password|passwd|secret|token|authorization|auth|cookie|session|api[_-]?key|access[_-]?key|refresh/i;
const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 40;
const MAX_METADATA_ITEMS = 25;
const MAX_METADATA_STRING = 500;

function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : value.slice(0, maximum);
}

export function sanitizeChatText(value: string, maximum: number): string {
  const withoutControls = value.replace(UNSAFE_CONTROL_CHARACTERS, "");
  return truncate(redactSensitiveText(withoutControls), maximum);
}

function sanitizeMetadataValue(value: unknown, depth: number, key: string): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (typeof value === "string") return sanitizeChatText(value, MAX_METADATA_STRING);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (value === undefined) return undefined;
  if (depth >= MAX_METADATA_DEPTH) return "[Max depth reached]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ITEMS)
      .map((item) => sanitizeMetadataValue(item, depth + 1, key));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_METADATA_KEYS)
        .flatMap(([nestedKey, nestedValue]) => {
          const sanitized = sanitizeMetadataValue(nestedValue, depth + 1, nestedKey);
          return sanitized === undefined ? [] : [[nestedKey, sanitized]];
        }),
    );
  }

  return sanitizeChatText(String(value), MAX_METADATA_STRING);
}

export function sanitizeTurnMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeMetadataValue(value, 0, "") as Record<string, unknown>;
}

export function hashFeedbackToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createFeedbackCredential(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashFeedbackToken(token) };
}
