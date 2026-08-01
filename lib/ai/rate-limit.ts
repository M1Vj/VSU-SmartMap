import { CHAT_REQUEST_MAX_BYTES } from "@/lib/ai/ops/request";
import {
  consumeRateLimit,
  type ConsumeRateLimitInput,
  type ConsumeRateLimitResult,
} from "@/lib/security/rate-limit";

export type ChatRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "minute" | "day"; message: string };

type ChatRateLimiterOptions = {
  now?: () => number;
  minuteLimit?: number;
  dayLimit?: number;
};

type ClientBuckets = {
  minute: number[];
  day: number[];
};

const MINUTE_WINDOW_MS = 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_CHECKS = 256;
const MINUTE_MESSAGE = "You're sending messages too quickly. Please wait a moment.";
const DAY_MESSAGE = "You've reached today's chat limit. Please try again tomorrow.";

export class ChatRateLimiter {
  private readonly now: () => number;
  private readonly minuteLimit: number;
  private readonly dayLimit: number;
  private readonly buckets = new Map<string, ClientBuckets>();
  private checksSinceSweep = 0;

  constructor(options?: ChatRateLimiterOptions) {
    this.now = options?.now ?? Date.now;
    this.minuteLimit = options?.minuteLimit ?? 8;
    this.dayLimit = options?.dayLimit ?? 80;
  }

  check(clientIp: string): ChatRateLimitResult {
    const now = this.now();
    this.checksSinceSweep += 1;
    if (this.checksSinceSweep >= SWEEP_EVERY_CHECKS) {
      this.checksSinceSweep = 0;
      this.sweepIdleClients(now);
    }
    const buckets = this.getBuckets(clientIp);

    buckets.minute = pruneWindow(buckets.minute, now, MINUTE_WINDOW_MS);
    buckets.day = pruneWindow(buckets.day, now, DAY_WINDOW_MS);

    if (buckets.minute.length >= this.minuteLimit) {
      return { allowed: false, reason: "minute", message: MINUTE_MESSAGE };
    }

    if (buckets.day.length >= this.dayLimit) {
      return { allowed: false, reason: "day", message: DAY_MESSAGE };
    }

    buckets.minute.push(now);
    buckets.day.push(now);
    return { allowed: true };
  }

  get trackedClients(): number {
    return this.buckets.size;
  }

  private getBuckets(clientIp: string): ClientBuckets {
    const existing = this.buckets.get(clientIp);
    if (existing) return existing;

    const buckets: ClientBuckets = { minute: [], day: [] };
    this.buckets.set(clientIp, buckets);
    return buckets;
  }

  // Drop clients whose whole day window has expired so the map cannot grow
  // without bound on a long-lived process.
  private sweepIdleClients(now: number) {
    const earliest = now - DAY_WINDOW_MS;
    for (const [clientIp, buckets] of this.buckets) {
      const latest = buckets.day[buckets.day.length - 1];
      if (latest === undefined || latest <= earliest) {
        this.buckets.delete(clientIp);
      }
    }
  }
}

function pruneWindow(timestamps: number[], now: number, windowMs: number): number[] {
  const earliest = now - windowMs;
  return timestamps.filter((timestamp) => timestamp > earliest);
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  return headers.get("x-real-ip")?.trim() || "unknown";
}

export const chatRateLimiter = new ChatRateLimiter();

type RateLimitConsumer = (
  input: ConsumeRateLimitInput,
) => Promise<ConsumeRateLimitResult>;

export type DurableChatRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "minute" | "day";
      message: string;
      retryAfterSeconds: number;
    };

export async function consumeDurableChatRateLimit({
  subject,
  costBytes,
  consume = consumeRateLimit,
}: {
  subject: string;
  costBytes: number;
  consume?: RateLimitConsumer;
}): Promise<DurableChatRateLimitResult> {
  const minute = await consume({
    scope: "chat:minute",
    subject,
    requestLimit: 8,
    byteLimit: 8 * CHAT_REQUEST_MAX_BYTES,
    windowSeconds: 60,
    costBytes,
  });
  if (!minute.allowed) {
    return {
      allowed: false,
      reason: "minute",
      message: MINUTE_MESSAGE,
      retryAfterSeconds: minute.retryAfterSeconds,
    };
  }

  const day = await consume({
    scope: "chat:day",
    subject,
    requestLimit: 80,
    byteLimit: 80 * CHAT_REQUEST_MAX_BYTES,
    windowSeconds: 86_400,
    costBytes,
  });
  if (!day.allowed) {
    return {
      allowed: false,
      reason: "day",
      message: DAY_MESSAGE,
      retryAfterSeconds: day.retryAfterSeconds,
    };
  }

  return { allowed: true };
}

export async function consumeDurableChatFeedbackRateLimit({
  subject,
  costBytes,
  consume = consumeRateLimit,
}: {
  subject: string;
  costBytes: number;
  consume?: RateLimitConsumer;
}): Promise<ConsumeRateLimitResult> {
  return consume({
    scope: "chat:feedback",
    subject,
    requestLimit: 30,
    byteLimit: 30 * 4 * 1024,
    windowSeconds: 15 * 60,
    costBytes,
  });
}
