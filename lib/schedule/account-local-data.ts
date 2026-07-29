import type { VSUDatabase } from "../db";
import { GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "./scope";

export async function removeLocalScheduleAccountData(
  database: VSUDatabase,
  scope: ScheduleScope,
): Promise<void> {
  if (scope === GUEST_SCHEDULE_SCOPE) {
    throw new Error("Guest schedule data cannot be removed as account data.");
  }
  await database.transaction(
    "rw",
    database.schedule_scoped_courses,
    database.schedule_outbox,
    database.schedule_sync_state,
    database.schedule_conflicts,
    async () => {
      await database.schedule_scoped_courses.where("scope").equals(scope).delete();
      await database.schedule_outbox.where("scope").equals(scope).delete();
      await database.schedule_sync_state.delete(scope);
      await database.schedule_conflicts.where("scope").equals(scope).delete();
    },
  );
}
