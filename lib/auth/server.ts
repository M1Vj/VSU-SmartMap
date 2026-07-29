import { redirect } from "next/navigation";

import {
  canAccessAdminArea,
  canAccessOwnerArea,
  isBreakGlassAdmin,
  mergeAppRoles,
  normalizeAppRoles,
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

export async function getCurrentUserRoles(
  userId: string,
  authenticatedClient?: SupabaseClient,
): Promise<AppRole[]> {
  const breakGlassRoles: AppRole[] = isBreakGlassAdmin(userId) ? ["admin"] : [];
  const roleClient = authenticatedClient ?? await getSupabaseServerClient();
  const { data, error } = await roleClient
    .from("app_user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[auth] Failed to load app roles:", error.message);
    return breakGlassRoles;
  }

  return mergeAppRoles(
    normalizeAppRoles((data as RoleRow[] | null)?.map((row) => row.role)),
    breakGlassRoles,
  );
}

export async function getAuthorizedSession(): Promise<AuthenticatedSession | null> {
  const client = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  const roles = await getCurrentUserRoles(user.id, client);
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
  const session = await getAuthorizedSession();
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
  const session = await getAuthorizedSession();
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
