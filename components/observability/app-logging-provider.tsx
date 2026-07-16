"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  sanitizeLogEventInput,
  type LogBreadcrumb,
  type LogEventInput,
  type LogLevel,
} from "@/lib/observability/logging";

const MAX_QUEUE_SIZE = 20;
const MAX_BATCH_SIZE = 10;
const MAX_RETRY_EVENTS = 5;
const MAX_RETRY_ATTEMPTS = 3;
const FLUSH_DELAY_MS = 1200;
const MAX_RETRY_DELAY_MS = 30_000;
const SESSION_KEY = "smartmap.logSessionId";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

type ClientLogInput = Omit<LogEventInput, "source" | "sessionId" | "breadcrumbs" | "route"> & {
  route?: string;
  breadcrumbs?: LogBreadcrumb[];
};

let externalCapture: ((event: ClientLogInput) => void) | null = null;

function getOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && UUID_PATTERN.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getElementContext(target: EventTarget | null): { tag: string; action: string } {
  if (!(target instanceof Element)) return { tag: "unknown", action: "interact" };

  const interactive = target.closest("button,a,[role='button'],[type='submit'],summary");
  if (!interactive) return { tag: target.tagName.toLowerCase(), action: "interact" };

  const tag = interactive.tagName.toLowerCase();
  const action = tag === "a" ? "navigate" : tag === "summary" ? "toggle" : "activate";
  return { tag, action };
}

function normalizeErrorReason(reason: unknown): { message: string; metadata: Record<string, unknown> } {
  if (reason instanceof Error) {
    return {
      message: `${reason.name || "Error"} captured`,
      metadata: { errorType: reason.name || "Error" },
    };
  }

  return {
    message: "Non-error rejection captured",
    metadata: { errorType: reason === null ? "null" : typeof reason },
  };
}

function privacySafeInput(input: ClientLogInput): ClientLogInput {
  if (!/^(?:browser\.(?:error|unhandledrejection)|next\.(?:global|route)_error|react\.component_error)$/.test(input.eventName)) {
    return input;
  }

  const suppliedType = input.metadata?.errorType ?? input.metadata?.name;
  const errorType = typeof suppliedType === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(suppliedType)
    ? suppliedType
    : "Error";
  return {
    ...input,
    message: `${errorType} captured`,
    metadata: { errorType },
  };
}

export function captureClientLogEvent(event: ClientLogInput): void {
  externalCapture?.(event);
}

export function AppLoggingProvider() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const queueRef = useRef<LogEventInput[]>([]);
  const breadcrumbsRef = useRef<LogBreadcrumb[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const isFlushingRef = useRef(false);
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    if (isLocalHostname(window.location.hostname)) {
      externalCapture = null;
      return;
    }

    sessionIdRef.current = getOrCreateSessionId();

    const addBreadcrumb = (breadcrumb: Omit<LogBreadcrumb, "timestamp">) => {
      breadcrumbsRef.current = [
        ...breadcrumbsRef.current.slice(-24),
        { ...breadcrumb, timestamp: new Date().toISOString() },
      ];
    };

    const flush = async () => {
      if (isFlushingRef.current || queueRef.current.length === 0) return;
      isFlushingRef.current = true;
      const events = queueRef.current.splice(0, MAX_BATCH_SIZE);

      try {
        const response = await fetch("/api/logs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events }),
          keepalive: true,
        });
        if (response.status === 429 || response.status >= 500) {
          throw new Error("Telemetry delivery is temporarily unavailable");
        }
        retryAttemptRef.current = 0;
      } catch {
        retryAttemptRef.current += 1;
        if (retryAttemptRef.current <= MAX_RETRY_ATTEMPTS) {
          queueRef.current = [
            ...events.slice(-MAX_RETRY_EVENTS),
            ...queueRef.current,
          ].slice(0, MAX_QUEUE_SIZE);
        } else {
          retryAttemptRef.current = 0;
        }
      } finally {
        isFlushingRef.current = false;
        if (queueRef.current.length > 0) {
          scheduleFlush(Math.min(
            FLUSH_DELAY_MS * (2 ** retryAttemptRef.current),
            MAX_RETRY_DELAY_MS,
          ));
        }
      }
    };

    const scheduleFlush = (delayMs = FLUSH_DELAY_MS) => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void flush();
      }, delayMs);
    };

    const capture = (input: ClientLogInput) => {
      const safeInput = privacySafeInput(input);
      const event = sanitizeLogEventInput({
        ...safeInput,
        source: "client",
        sessionId: sessionIdRef.current ?? undefined,
        route: safeInput.route ?? window.location.pathname,
        breadcrumbs: safeInput.breadcrumbs ?? breadcrumbsRef.current,
        occurredAt: new Date().toISOString(),
      });

      addBreadcrumb({
        category: event.eventName,
        level: event.level,
        message: event.message ?? event.eventName,
        metadata: {
          route: event.route,
        },
      });

      queueRef.current = [...queueRef.current, event].slice(-MAX_QUEUE_SIZE);
      scheduleFlush();
    };

    externalCapture = capture;

    const onClick = (event: MouseEvent) => {
      const { tag, action } = getElementContext(event.target);
      addBreadcrumb({
        category: "ui.interaction",
        message: `${tag}.${action}`,
        metadata: { tag, action, route: window.location.pathname },
      });
    };

    const onSubmit = (event: SubmitEvent) => {
      const target = event.target instanceof HTMLFormElement ? event.target : null;
      const tag = target?.tagName.toLowerCase() ?? "form";
      const action = "submit";
      addBreadcrumb({
        category: "ui.interaction",
        message: "form.submit",
        metadata: { tag, action, route: window.location.pathname },
      });
    };

    const onError = (event: ErrorEvent) => {
      capture({
        level: "error",
        eventName: "browser.error",
        message: "Browser error captured",
        metadata: {
          errorType: normalizeErrorReason(event.error).metadata.errorType ?? "ErrorEvent",
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeErrorReason(event.reason);
      capture({
        level: "error",
        eventName: "browser.unhandledrejection",
        message: normalized.message,
        metadata: normalized.metadata,
      });
    };

    const onOnline = () => capture({ level: "info", eventName: "browser.online", message: "Browser went online" });
    const onOffline = () => capture({ level: "warn", eventName: "browser.offline", message: "Browser went offline" });

    const originalError = console.error;
    const originalWarn = console.warn;
    const captureConsole = (level: LogLevel, args: unknown[]) => {
      const argumentTypes = args.map((item) => {
        if (item instanceof Error) return `error:${item.name || "Error"}`;
        if (item === null) return "null";
        if (Array.isArray(item)) return "array";
        return typeof item;
      });
      capture({
        level,
        eventName: level === "error" ? "console.error" : "console.warn",
        message: `Console ${level} captured`,
        metadata: {
          argumentCount: args.length,
          argumentTypes,
          errorType: args.find((item) => item instanceof Error) instanceof Error
            ? (args.find((item) => item instanceof Error) as Error).name
            : undefined,
        },
      });
    };

    console.error = (...args: unknown[]) => {
      originalError(...args);
      captureConsole("error", args);
    };
    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      captureConsole("warn", args);
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const onPageHide = () => void flush();
    window.addEventListener("pagehide", onPageHide);

    capture({ level: "info", eventName: "app.logging_started", message: "Client logging started" });

    return () => {
      externalCapture = null;
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      console.error = originalError;
      console.warn = originalWarn;
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, []);

  useEffect(() => {
    captureClientLogEvent({
      level: "info",
      eventName: "page.view",
      message: "Page viewed",
      route: pathname,
      metadata: {},
    });
  }, [pathname]);

  return null;
}
