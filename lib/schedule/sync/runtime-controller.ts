import type { ScheduleScope } from "../scope";
import type {
  ScheduleSyncCoordinator,
  SyncRunResult,
} from "./coordinator";

type SyncCoordinator = Pick<ScheduleSyncCoordinator, "sync"> &
  Partial<Pick<ScheduleSyncCoordinator, "cancel">>;

type RuntimeOptions = {
  scope: ScheduleScope;
  enabled: boolean;
  authenticated: boolean;
  offlineVerified: boolean;
  consent: boolean;
  reconciled: boolean;
  createCoordinator: () => SyncCoordinator;
  onResult?: (result: SyncRunResult) => void;
  onOnlineChanged?: (online: boolean) => void;
  onSynchronousError?: () => void;
  debounceMs?: number;
  eventTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  documentTarget?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
};

export function createScheduleSyncRuntimeController(options: RuntimeOptions) {
  const active =
    options.enabled &&
    options.authenticated &&
    options.offlineVerified &&
    options.consent &&
    options.reconciled;
  let disposed = false;
  let coordinator: SyncCoordinator | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const activeRuns = new Set<Promise<SyncRunResult>>();
  const gateway = () => (coordinator ??= options.createCoordinator());
  const run = () => {
    if (!active || disposed) return false;
    try {
      const sync = gateway().sync(options.scope);
      activeRuns.add(sync);
      void sync.then((result) => {
        if (disposed) return;
        if (result.kind === "offline") options.onOnlineChanged?.(false);
        options.onResult?.(result);
      }).catch(() => {
        if (!disposed) options.onSynchronousError?.();
      }).finally(() => {
        activeRuns.delete(sync);
      });
      return true;
    } catch {
      options.onSynchronousError?.();
      return false;
    }
  };
  const online = () => {
    options.onOnlineChanged?.(true);
    run();
  };
  const offline = () => options.onOnlineChanged?.(false);
  const visible = () => {
    if (options.documentTarget?.visibilityState === "visible") run();
  };
  const dispose = () => {
    disposed = true;
    coordinator?.cancel?.();
    if (timer) clearTimeout(timer);
    timer = undefined;
    options.eventTarget?.removeEventListener("online", online);
    options.eventTarget?.removeEventListener("offline", offline);
    options.documentTarget?.removeEventListener("visibilitychange", visible);
  };

  return {
    start() {
      if (!active || disposed) return false;
      options.eventTarget?.addEventListener("online", online);
      options.eventTarget?.addEventListener("offline", offline);
      options.documentTarget?.addEventListener("visibilitychange", visible);
      return run();
    },
    syncNow() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      run();
    },
    requestSync() {
      if (!active || disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, options.debounceMs ?? 400);
    },
    dispose() {
      dispose();
    },
    async stopAndDrain() {
      dispose();
      await Promise.allSettled([...activeRuns]);
    },
  };
}

export type ScheduleSyncRuntimeController = ReturnType<
  typeof createScheduleSyncRuntimeController
>;
