import type { ScheduleScope } from "../scope";
import type { ValidatedScheduleReconciliationSnapshot } from "./resolution";

export type FirstReconciliationDisposition =
  | "complete-empty"
  | "review"
  | "blocked";

export function classifyFirstReconciliation(
  snapshot: ValidatedScheduleReconciliationSnapshot,
): FirstReconciliationDisposition {
  if (snapshot.reconciliation.kind === "invalid") return "blocked";
  const empty =
    snapshot.guest.length === 0 &&
    snapshot.accountLocal.length === 0 &&
    snapshot.cloud.length === 0;
  return empty ? "complete-empty" : "review";
}

export function createReconciliationGeneration() {
  let generation = 0;
  let activeScope: ScheduleScope | undefined;
  return {
    begin(scope: ScheduleScope): number {
      activeScope = scope;
      generation += 1;
      return generation;
    },
    isCurrent(token: number, scope: ScheduleScope): boolean {
      return token === generation && scope === activeScope;
    },
    invalidate(): void {
      activeScope = undefined;
      generation += 1;
    },
  };
}
