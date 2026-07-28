export const APP_ROLES = ["admin", "boarding_house_owner"] as const;

export type AppRole = (typeof APP_ROLES)[number];

const APP_ROLE_SET = new Set<string>(APP_ROLES);

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_SET.has(value);
}

export function normalizeAppRoles(values: readonly unknown[] | null | undefined): AppRole[] {
  if (!values) return [];

  const roles: AppRole[] = [];
  for (const value of values) {
    if (isAppRole(value) && !roles.includes(value)) {
      roles.push(value);
    }
  }

  return roles;
}

export function getBreakGlassAdminUserIds(
  raw: string | undefined = process.env.BREAK_GLASS_ADMIN_USER_IDS,
): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isBreakGlassAdmin(
  userId: string | null | undefined,
  raw?: string,
): boolean {
  if (!userId) return false;
  return getBreakGlassAdminUserIds(raw).includes(userId);
}

export function mergeAppRoles(
  primaryRoles: readonly AppRole[],
  fallbackRoles: readonly AppRole[],
): AppRole[] {
  return normalizeAppRoles([...primaryRoles, ...fallbackRoles]);
}

export function canAccessAdminArea(roles: readonly AppRole[]): boolean {
  return roles.includes("admin");
}

export function canAccessOwnerArea(roles: readonly AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("boarding_house_owner");
}
