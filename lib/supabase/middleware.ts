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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isOwnerRoute = pathname.startsWith("/owner");

  const roleResult = user
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
          : normalizeAppRoles(roleResult?.data?.map((row) => row.role)),
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
