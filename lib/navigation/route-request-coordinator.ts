interface RouteRequestCallbacks<Result> {
  clear: (options?: { preservePublishedResult?: boolean }) => void;
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
  onError?: () => void;
  preservePublishedResult?: boolean;
  preserveActiveErrorToast?: boolean;
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
  preserveErrorOnCleanup: boolean;
}

let nextToastId = 0;

export function createRouteRequestCoordinator<Result>(
  callbacks: RouteRequestCallbacks<Result>,
) {
  let active: ActiveRequest | null = null;
  let hasPublishedResult = false;
  let preservedErrorToastId: string | null = null;

  const cancel = (
    request: ActiveRequest,
    { preserveActiveErrorToast = false }: { preserveActiveErrorToast?: boolean } = {},
  ) => {
    request.controller.abort();
    if (request.toastVisible) {
      const preserveSuccess =
        request.toastType === "success" &&
        (request.successToastTracked ||
          (request.sessionId !== undefined && request.isSuccessAnnounced?.() === true));
      const preserveError = preserveActiveErrorToast && request.toastType === "error";
      if (preserveSuccess || preserveError) {
        request.toastVisible = false;
        if (preserveError) preservedErrorToastId = request.id;
        return;
      }

      callbacks.dismiss(request.id);
      request.toastVisible = false;
    }
  };

  return {
    start(options: StartRouteRequest<Result>): () => void {
      if (!options.preserveActiveErrorToast && preservedErrorToastId) {
        callbacks.dismiss(preservedErrorToastId);
        preservedErrorToastId = null;
      }
      if (active) cancel(active, { preserveActiveErrorToast: options.preserveActiveErrorToast });

      const request: ActiveRequest = {
        controller: new AbortController(),
        id: `navigation-status-${++nextToastId}`,
        sessionId: options.sessionId,
        toastVisible: false,
        toastType: null,
        successToastTracked: false,
        isSuccessAnnounced: options.isSuccessAnnounced,
        preserveErrorOnCleanup: options.preservePublishedResult === true && hasPublishedResult,
      };
      active = request;
      const preservePublishedResult =
        hasPublishedResult && (options.resolve !== undefined || options.preservePublishedResult === true);
      callbacks.clear({ preservePublishedResult });
      if (!preservePublishedResult && options.resolve === undefined) {
        hasPublishedResult = false;
      }

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
          hasPublishedResult = true;
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
            options.onError?.();
            callbacks.reportError?.(error);
            callbacks.clear({ preservePublishedResult: hasPublishedResult });
            if (!hasPublishedResult) {
              hasPublishedResult = false;
            }
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
        cancel(request, { preserveActiveErrorToast: request.preserveErrorOnCleanup });
        active = null;
      };
    },
  };
}
