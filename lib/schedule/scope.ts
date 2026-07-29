import { isValidScheduleId } from "./validation";

export const GUEST_SCHEDULE_SCOPE = "guest" as const;
export type ScheduleScope =
  | typeof GUEST_SCHEDULE_SCOPE
  | `user:${string}`;

export function accountScheduleScope(userId: string): ScheduleScope {
  if (!isValidScheduleId(userId)) {
    throw new Error("Invalid schedule account identifier.");
  }
  return `user:${userId.trim().toLowerCase()}`;
}
