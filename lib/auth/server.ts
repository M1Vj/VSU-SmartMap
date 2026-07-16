import { redirect } from "next/navigation";

import {
  canAccessAdminArea,
  canAccessOwnerArea,
  getMetadataAppRoles,
  isBreakGlassAdmin,
  isMissingAppRoleTableError,
  mergeAppRoles,
  normalizeAppRoles,
  shouldAllowMissingRoleTableAdminFallback,
  shouldAllowLegacyUserMetadataRoles,
} from "@/lib/auth/roles";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server-client";

import type { AppRole } from "@/lib/auth/roles";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type RoleRow = {
  role: string;
};

export type AuthenticatedSession = {
  user: User;
  roles: AppRole[];
  client: SupabaseClient;
};

export type AuthorizedSession = AuthenticatedSession & {
  serviceClient: SupabaseClient;
};

type CurrentUserRoleOptions = {
  allowMissingRoleTableAdminFallback?: boolean;
};

export async function getCurrentUserRoles(
  userId: string,
  user?: Pick<User, "app_metadata" | "user_metadata">,
  options: CurrentUserRoleOptions = {},
  authenticatedClient?: SupabaseClient,
): Promise<AppRole[]> {
  const breakGlassRoles: AppRole[] = isBreakGlassAdmin(userId) ? ["admin"] : [];
  const roleClient = authenticatedClient ?? await getSupabaseServerClient();
  const { data, error } = await roleClient
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId);

  const metadataRoles = user
    ? getMetadataAppRoles(user, {
        includeUserMetadata: shouldAllowLegacyUserMetadataRoles(),
      })
    : [];

  if (error) {
    if (isMissingAppRoleTableError(error)) {
      if (
        user &&
        options.allowMissingRoleTableAdminFallback &&
        shouldAllowMissingRoleTableAdminFallback()
      ) {
        return mergeAppRoles(["admin"], mergeAppRoles(metadataRoles, breakGlassRoles));
      }

      return mergeAppRoles(metadataRoles, breakGlassRoles);
    }

    console.error("[auth] Failed to load app roles:", error.message);
    return mergeAppRoles(metadataRoles, breakGlassRoles);
  }

  return mergeAppRoles(
    normalizeAppRoles((data as RoleRow[] | null)?.map((row) => row.role)),
    mergeAppRoles(metadataRoles, breakGlassRoles),
  );
}

export async function getAuthorizedSession(
  options: CurrentUserRoleOptions = {},
): Promise<AuthenticatedSession | null> {
  const client = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  const roles = await getCurrentUserRoles(user.id, user, options, client);
  return {
    user,
    roles,
    client,
  };
}

function attachServiceClient(session: AuthenticatedSession): AuthorizedSession {
  return {
    ...session,
    serviceClient: getSupabaseServiceRoleClient(),
  };
}

export async function requireAdminSession(): Promise<AuthorizedSession> {
  const session = await getAuthorizedSession({
    allowMissingRoleTableAdminFallback: true,
  });
  if (!session || !canAccessAdminArea(session.roles)) {
    redirect("/admin/login");
  }
  return attachServiceClient(session);
}

export async function requireOwnerSession(): Promise<AuthorizedSession> {
  const session = await getAuthorizedSession();
  if (!session || !canAccessOwnerArea(session.roles)) {
    redirect("/owner/login");
  }
  return attachServiceClient(session);
}

export async function assertAdminAction(): Promise<AuthorizedSession | { error: string }> {
  const session = await getAuthorizedSession({
    allowMissingRoleTableAdminFallback: true,
  });
  if (!session || !canAccessAdminArea(session.roles)) {
    return { error: "Unauthorized" };
  }
  return attachServiceClient(session);
}

export async function assertOwnerAction(): Promise<AuthorizedSession | { error: string }> {
  const session = await getAuthorizedSession();
  if (!session || !canAccessOwnerArea(session.roles)) {
    return { error: "Unauthorized" };
  }
  return attachServiceClient(session);
}
