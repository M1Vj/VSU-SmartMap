"use client";

import { useEffect, useRef, memo, useMemo } from "react";
import { useTheme } from "next-themes";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { resolveTurnstileSiteKey } from "@/lib/turnstile-config";

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
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current || !resolvedTheme) {
      return;
    }

    let intervalId: NodeJS.Timeout | undefined;
    let cancelled = false;

    const renderWidget = () => {
      if (!window.turnstile || widgetIdRef.current || !containerRef.current || cancelled) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark" | "auto",
          size: "normal",
          appearance: "always",
          retry: "never",
          "refresh-expired": "auto",
          callback: (token) => {
            onVerify({
              token,
              idempotencyKey: generateIdempotencyKey(),
            });
            lastErrorRef.current = null;
          },
          "error-callback": (code) => {
            console.error("Turnstile: verification error", code);
            lastErrorRef.current = code ?? null;
            onError?.(code);
          },
          "expired-callback": () => {
            onExpire?.();
          },
          "timeout-callback": () => {
            onExpire?.();
          },
        });
        widgetIdRef.current = id;
      } catch (e) {
        console.error("Turnstile: render error", e);
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
        } catch (e) {
          console.error("Turnstile: cleanup error", e);
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resolvedTheme, onVerify, onError, onExpire, onReset]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    if (!siteKey) return;
    if (!window.turnstile || !containerRef.current) return;

    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (error) {
        console.error("Turnstile: remove error during reset", error);
      }
      widgetIdRef.current = null;
    }

    try {
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        theme: (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark" | "auto",
        size: "normal",
        appearance: "always",
        retry: "never",
        "refresh-expired": "auto",
        callback: (token) => {
          onVerify({
            token,
            idempotencyKey: generateIdempotencyKey(),
          });
          lastErrorRef.current = null;
        },
        "error-callback": (code) => {
          console.error("Turnstile: verification error", code);
          lastErrorRef.current = code ?? null;
          onError?.(code);
        },
        "expired-callback": () => {
          onExpire?.();
        },
        "timeout-callback": () => {
          onExpire?.();
        },
      });
      widgetIdRef.current = id;
      onReset?.();
    } catch (error) {
      console.error("Turnstile: reset render error", error);
    }
  }, [resetSignal, resolvedTheme, siteKey, onVerify, onError, onExpire, onReset]);

  if (!siteKey) {
    console.warn("TurnstileWidget: NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured");
    return null;
  }

  return (
    <div
      className="min-h-[65px] flex items-center justify-center w-full relative z-[50]"
      ref={containerRef}
    />
  );
});
