import type { Instrumentation } from "next";

import { recordLogEvent } from "@/lib/observability/server";

function normalizeError(error: unknown): { message: string; metadata: Record<string, unknown> } {
  if (error instanceof Error) {
    return {
      message: error.message,
      metadata: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown server error",
    metadata: {
      error,
    },
  };
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const normalized = normalizeError(error);

  await recordLogEvent({
    source: "server",
    level: "error",
    eventName: "server.request_error",
    message: normalized.message,
    route: request.path,
    method: request.method,
    requestId: Array.isArray(request.headers["x-request-id"])
      ? request.headers["x-request-id"][0]
      : request.headers["x-request-id"],
    userAgent: Array.isArray(request.headers["user-agent"])
      ? request.headers["user-agent"][0]
      : request.headers["user-agent"],
    metadata: {
      ...normalized.metadata,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
    },
  });
};
