import type { ScheduleScope } from "@/lib/schedule/scope";

export type ReconciliationDialogLifecycle = Readonly<{
  open: boolean;
  scope: ScheduleScope;
  activeScope: ScheduleScope;
  snapshot: object;
}>;

export function shouldResetReconciliationDialog(
  previous: ReconciliationDialogLifecycle,
  next: ReconciliationDialogLifecycle,
): boolean {
  return (
    previous.open !== next.open ||
    previous.scope !== next.scope ||
    previous.activeScope !== next.activeScope ||
    previous.snapshot !== next.snapshot
  );
}
