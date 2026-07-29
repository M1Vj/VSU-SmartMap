import type { ScheduleScope } from "./scope";

export function canRunScheduleScopeAction(
  origin: ScheduleScope,
  current: ScheduleScope,
  loaded: ScheduleScope | undefined,
): boolean {
  return origin === current && loaded === current;
}
