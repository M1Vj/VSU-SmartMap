export function isScheduleAccountSyncEnabled(
  value = process.env.NEXT_PUBLIC_SCHEDULE_ACCOUNT_SYNC_ENABLED,
): boolean {
  return value === "true";
}
