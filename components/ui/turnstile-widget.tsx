"use client";

import { useCallback, useEffect, useRef, memo, useMemo } from "react";
import { useTheme } from "next-themes";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { resolveTurnstileSiteKey } from "@/lib/turnstile-config";
import { captureClientLogEvent } from "@/components/observability/app-logging-provider";

interface TurnstileWidgetProps {
  onVerify: (payload: TurnstileToken) => void;
  onError?: (code?: string) => void;
  onExpire?: () => void;
  onReset?: () => void;
  resetSignal?: number;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
          appearance?: "always" | "interaction-only";
          callback?: (token: string) => void;
          "error-callback"?: (code: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          retry?: "auto" | "never";
          "refresh-expired"?: "auto" | "manual" | "never";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

// Cloudflare's transient codes. 600010 is a failed/expired challenge and 300030
// a generic execution error; both usually clear on a second attempt.
const MAX_CHALLENGE_RETRIES = 2;

const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const TurnstileWidget = memo(function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  onReset,
  resetSignal,
}: TurnstileWidgetProps) {
  const { resolvedTheme } = useTheme();
  const siteKey = useMemo(() => {
    return resolveTurnstileSiteKey({
      configuredKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      hostname: typeof window === "undefined" ? undefined : window.location.hostname,
      nodeEnv: process.env.NODE_ENV,
    });
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  // Both render paths - first mount and caller-driven reset - need identical
  // callbacks. They were duplicated, so the recovery below would have had to be
  // written twice and would have drifted.
  const buildRenderOptions = useCallback(() => ({
    sitekey: siteKey as string,
    theme: (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark" | "auto",
    size: "normal" as const,
    appearance: "always" as const,
    retry: "never" as const,
    "refresh-expired": "auto" as const,
    callback: (token: string) => {
      retryCountRef.current = 0;
      onVerify({ token, idempotencyKey: generateIdempotencyKey() });
    },
    "error-callback": (code: string) => {
      const attempt = retryCountRef.current + 1;

      // retry: "never" means Cloudflare will not re-run the challenge itself.
      // Without this the widget sits dead and the form can never be submitted -
      // the user has no control that would recover it short of a page reload.
      if (attempt <= MAX_CHALLENGE_RETRIES && widgetIdRef.current && window.turnstile) {
        retryCountRef.current = attempt;
        try {
          window.turnstile.reset(widgetIdRef.current);
          captureClientLogEvent({
            level: "warn",
            eventName: "turnstile.challenge_retried",
            message: "Turnstile challenge failed and was retried",
            metadata: { code: typeof code === "string" ? code : undefined, attempt },
          });
          return;
        } catch {
          // reset() throws if the widget id is stale; fall through and report.
        }
      }

      // Retries exhausted: the user really is blocked from submitting, which is
      // worth an incident in a way that a single transient failure is not.
      captureClientLogEvent({
        level: "error",
        eventName: "turnstile.verification_unrecoverable",
        message: "Turnstile challenge failed after retries",
        metadata: { code: typeof code === "string" ? code : undefined, attempt },
      });
      onError?.(code);
    },
    "expired-callback": () => {
      onExpire?.();
    },
    "timeout-callback": () => {
      onExpire?.();
    },
  }), [siteKey, resolvedTheme, onVerify, onError, onExpire]);

  useEffect(() => {
    if (!siteKey) {
      captureClientLogEvent({
        level: "warn",
        eventName: "turnstile.site_key_missing",
        message: "Turnstile site key is not configured",
      });
    }
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current || !resolvedTheme) {
      return;
    }

    let intervalId: NodeJS.Timeout | undefined;
    let cancelled = false;

    const renderWidget = () => {
      if (!window.turnstile || widgetIdRef.current || !containerRef.current || cancelled) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, buildRenderOptions());
      } catch (error) {
        captureClientLogEvent({
          level: "error",
          eventName: "turnstile.render_failed",
          message: "Turnstile widget failed to render",
          metadata: { errorType: error instanceof Error ? error.name || "Error" : typeof error },
        });
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          renderWidget();
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // The widget is already gone; nothing to clean up.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resolvedTheme, buildRenderOptions]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    if (!siteKey) return;
    if (!window.turnstile || !containerRef.current) return;

    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // Already removed; continue to a fresh render.
      }
      widgetIdRef.current = null;
    }

    // A caller-driven reset is a new attempt, so the retry budget starts over.
    retryCountRef.current = 0;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, buildRenderOptions());
      onReset?.();
    } catch (error) {
      captureClientLogEvent({
        level: "error",
        eventName: "turnstile.render_failed",
        message: "Turnstile widget failed to render after reset",
        metadata: { errorType: error instanceof Error ? error.name || "Error" : typeof error },
      });
    }
  }, [resetSignal, siteKey, onReset, buildRenderOptions]);

  if (!siteKey) {
    return null;
  }

  return (
    <div
      className="min-h-[65px] flex items-center justify-center w-full relative z-[50]"
      ref={containerRef}
    />
  );
});
