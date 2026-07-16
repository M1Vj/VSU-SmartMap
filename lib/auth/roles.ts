export const APP_ROLES = ["admin", "boarding_house_owner"] as const;

export type AppRole = (typeof APP_ROLES)[number];

type RoleMetadata = Record<string, unknown> | null | undefined;

type MetadataRoleUser = {
  app_metadata?: RoleMetadata;
  user_metadata?: RoleMetadata;
};

type RoleLookupError = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

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

function collectMetadataRoleValues(metadata: RoleMetadata): unknown[] {
  if (!metadata || typeof metadata !== "object") return [];

  return [
    metadata.role,
    ...(Array.isArray(metadata.roles) ? metadata.roles : []),
  ];
}

export function getMetadataAppRoles(
  user: MetadataRoleUser,
  options: { includeUserMetadata?: boolean } = {},
): AppRole[] {
  const values = [
    ...collectMetadataRoleValues(user.app_metadata),
    ...(options.includeUserMetadata
      ? collectMetadataRoleValues(user.user_metadata)
      : []),
  ];

  return normalizeAppRoles(values);
}

export function shouldAllowLegacyUserMetadataRoles(): boolean {
  return process.env.ALLOW_LEGACY_USER_METADATA_ROLES === "true";
}

export function shouldAllowMissingRoleTableAdminFallback(
  env: { allowFallback?: string } = {
    allowFallback: process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK,
  },
): boolean {
  return env.allowFallback === "true";
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

export function isMissingAppRoleTableError(error: RoleLookupError): boolean {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST205" &&
    message.includes("app_user_roles") &&
    message.includes("schema cache")
  );
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
