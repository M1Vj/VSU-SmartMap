import type { ScheduleScope } from "../scope";

export function createReconciliationFocusRestoreController() {
  let requestedScope: ScheduleScope | undefined;
  return {
    request(scope: ScheduleScope): void {
      requestedScope = scope;
    },
    clear(scope: ScheduleScope): void {
      if (requestedScope === scope) requestedScope = undefined;
    },
    consume(currentScope: ScheduleScope): boolean {
      const restore = requestedScope === currentScope;
      requestedScope = undefined;
      return restore;
    },
  };
}
