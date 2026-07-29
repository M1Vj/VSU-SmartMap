import type { ScheduleScope } from "../scope";
import type {
  ScheduleSyncCoordinator,
  SyncRunResult,
} from "./coordinator";

type SyncCoordinator = Pick<ScheduleSyncCoordinator, "sync">;

type RuntimeOptions = {
  scope: ScheduleScope;
  enabled: boolean;
  authenticated: boolean;
  offlineVerified: boolean;
  consent: boolean;
  reconciled: boolean;
  createCoordinator: () => SyncCoordinator;
  onResult?: (result: SyncRunResult) => void;
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
  const gateway = () => (coordinator ??= options.createCoordinator());
  const run = () => {
    if (!active || disposed) return;
    void gateway().sync(options.scope).then((result) => {
      if (!disposed) options.onResult?.(result);
    });
  };
  const online = () => run();
  const visible = () => {
    if (options.documentTarget?.visibilityState === "visible") run();
  };

  return {
    start() {
      if (!active || disposed) return;
      options.eventTarget?.addEventListener("online", online);
      options.documentTarget?.addEventListener("visibilitychange", visible);
      run();
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
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      options.eventTarget?.removeEventListener("online", online);
      options.documentTarget?.removeEventListener("visibilitychange", visible);
    },
  };
}

export type ScheduleSyncRuntimeController = ReturnType<
  typeof createScheduleSyncRuntimeController
>;
