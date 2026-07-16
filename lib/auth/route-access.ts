export type AdminRouteAccessInput = {
  pathname: string;
  isAuthenticated: boolean;
  hasAdminAccess: boolean;
};

export type RouteAccessDecision = {
  redirectTo: string | null;
};

export function decideAdminRouteAccess({
  pathname,
  isAuthenticated,
  hasAdminAccess,
}: AdminRouteAccessInput): RouteAccessDecision {
  if (!pathname.startsWith("/admin")) {
    return { redirectTo: null };
  }

  if (pathname === "/admin/login") {
    return {
      redirectTo: isAuthenticated && hasAdminAccess ? "/admin" : null,
    };
  }

  return {
    redirectTo: isAuthenticated && hasAdminAccess ? null : "/admin/login",
  };
}
