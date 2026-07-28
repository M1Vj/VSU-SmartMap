interface RouteRequestCallbacks<Result> {
  clear: () => void;
  publish: (result: Result) => void;
  loading: (message: string, id: string) => void;
  success: (message: string, id: string) => void;
  error: (message: string, id: string) => void;
  dismiss: (id: string) => void;
  reportError?: (error: unknown) => void;
}

interface StartRouteRequest<Result> {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  resolve?: (signal: AbortSignal) => Promise<Result>;
}

interface ActiveRequest {
  controller: AbortController;
  id: string;
  toastVisible: boolean;
}

let nextToastId = 0;

export function createRouteRequestCoordinator<Result>(
  callbacks: RouteRequestCallbacks<Result>,
) {
  let active: ActiveRequest | null = null;

  const cancel = (request: ActiveRequest) => {
    request.controller.abort();
    if (request.toastVisible) {
      callbacks.dismiss(request.id);
      request.toastVisible = false;
    }
  };

  return {
    start(options: StartRouteRequest<Result>): () => void {
      if (active) cancel(active);

      const request: ActiveRequest = {
        controller: new AbortController(),
        id: `navigation-status-${++nextToastId}`,
        toastVisible: false,
      };
      active = request;
      callbacks.clear();

      if (options.loadingMessage) {
        callbacks.loading(options.loadingMessage, request.id);
        request.toastVisible = true;
      }

      if (options.resolve) {
        void (async () => {
          await Promise.resolve();
          if (active !== request || request.controller.signal.aborted) return;
          const result = await options.resolve!(request.controller.signal);
          if (active !== request || request.controller.signal.aborted) return;
          callbacks.publish(result);
          callbacks.success(options.successMessage ?? "Route found!", request.id);
          request.toastVisible = true;
        })()
          .catch((error: unknown) => {
            if (active !== request || request.controller.signal.aborted) return;
            callbacks.reportError?.(error);
            callbacks.clear();
            callbacks.error(
              options.errorMessage ?? "No route found. External routing may be unavailable.",
              request.id,
            );
            request.toastVisible = true;
          });
      }

      return () => {
        if (active !== request) return;
        cancel(request);
        active = null;
      };
    },
  };
}
