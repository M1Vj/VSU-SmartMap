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
  sessionId?: number;
  isSuccessAnnounced?: () => boolean;
  shouldAnnounceSuccess?: () => boolean;
  onSuccess?: (id: string) => void;
  resolve?: (signal: AbortSignal) => Promise<Result>;
}

interface ActiveRequest {
  controller: AbortController;
  id: string;
  sessionId?: number;
  toastVisible: boolean;
  toastType: "loading" | "success" | "error" | null;
  successToastTracked: boolean;
  isSuccessAnnounced?: () => boolean;
}

let nextToastId = 0;

export function createRouteRequestCoordinator<Result>(
  callbacks: RouteRequestCallbacks<Result>,
) {
  let active: ActiveRequest | null = null;

  const cancel = (request: ActiveRequest) => {
    request.controller.abort();
    if (request.toastVisible) {
      const preserveSuccess =
        request.toastType === "success" &&
        (request.successToastTracked ||
          (request.sessionId !== undefined && request.isSuccessAnnounced?.() === true));
      if (preserveSuccess) {
        request.toastVisible = false;
        return;
      }

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
        sessionId: options.sessionId,
        toastVisible: false,
        toastType: null,
        successToastTracked: false,
        isSuccessAnnounced: options.isSuccessAnnounced,
      };
      active = request;
      callbacks.clear();

      const isSuccessAnnounced = options.isSuccessAnnounced?.() === true;
      if (options.loadingMessage && !isSuccessAnnounced) {
        callbacks.loading(options.loadingMessage, request.id);
        request.toastVisible = true;
        request.toastType = "loading";
      }

      if (options.resolve) {
        void (async () => {
          await Promise.resolve();
          if (active !== request || request.controller.signal.aborted) return;
          const result = await options.resolve!(request.controller.signal);
          if (active !== request || request.controller.signal.aborted) return;
          callbacks.publish(result);
          if (options.shouldAnnounceSuccess && !options.shouldAnnounceSuccess()) {
            if (request.toastVisible) {
              callbacks.dismiss(request.id);
              request.toastVisible = false;
            }
            return;
          }

          callbacks.success(options.successMessage ?? "Route found!", request.id);
          request.toastVisible = true;
          request.toastType = "success";
          request.successToastTracked = options.onSuccess !== undefined;
          options.onSuccess?.(request.id);
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
            request.toastType = "error";
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
