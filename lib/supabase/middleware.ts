import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminArea,
  canAccessOwnerArea,
  isBreakGlassAdmin,
  mergeAppRoles,
  normalizeAppRoles,
} from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/roles";
import { decideAdminRouteAccess } from "@/lib/auth/route-access";
import { isSupabasePublicConfigValid } from "@/lib/supabase/public-config";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isOwnerRoute = pathname.startsWith("/owner");
  let supabaseResponse = NextResponse.next({
    request,
  });

  const anonymousResponse = () => {
    const adminDecision = decideAdminRouteAccess({
      pathname,
      isAuthenticated: false,
      hasAdminAccess: false,
    });
    if (adminDecision.redirectTo) {
      const url = request.nextUrl.clone();
      url.pathname = adminDecision.redirectTo;
      return NextResponse.redirect(url);
    }
    if (
      isOwnerRoute &&
      pathname !== "/owner/login" &&
      pathname !== "/owner/apply"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/owner/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isSupabasePublicConfigValid(url, key)) {
    return anonymousResponse();
  }
  const validUrl = url as string;
  const validKey = key as string;

  let supabase: ReturnType<typeof createServerClient>;
  try {
    supabase = createServerClient(
      validUrl,
      validKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
  } catch {
    return anonymousResponse();
  }

  let user;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    return anonymousResponse();
  }

  const roleResult = user && (isAdminRoute || isOwnerRoute)
    ? await supabase
        .from("app_user_roles")
        .select("role")
        .eq("user_id", user.id)
    : null;

  const breakGlassRoles: AppRole[] = isBreakGlassAdmin(user?.id) ? ["admin"] : [];

  const roles = user
    ? mergeAppRoles(
        roleResult?.error
          ? []
          : normalizeAppRoles(
              roleResult?.data?.map((row: { role: unknown }) => row.role),
            ),
        breakGlassRoles,
      )
    : [];

  const adminRouteDecision = decideAdminRouteAccess({
    pathname,
    isAuthenticated: Boolean(user),
    hasAdminAccess: canAccessAdminArea(roles),
  });

  if (adminRouteDecision.redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = adminRouteDecision.redirectTo;
    return NextResponse.redirect(url);
  }

  if (isAdminRoute) {
    return supabaseResponse;
  }

  if (isOwnerRoute) {
    if (pathname === "/owner/login" || pathname === "/owner/apply") {
      if (user && canAccessOwnerArea(roles)) {
        const url = request.nextUrl.clone();
        url.pathname = "/owner";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    if (!user || !canAccessOwnerArea(roles)) {
      const url = request.nextUrl.clone();
      url.pathname = user ? "/owner/apply" : "/owner/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
