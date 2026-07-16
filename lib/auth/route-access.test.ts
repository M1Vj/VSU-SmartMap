import assert from "node:assert/strict";
import test from "node:test";

import { decideAdminRouteAccess } from "./route-access.ts";

test("anonymous users are redirected from nested admin routes", () => {
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/events/suggestions/pending",
      isAuthenticated: false,
      hasAdminAccess: false,
    }),
    { redirectTo: "/admin/login" },
  );
});

test("authenticated non-admin users are redirected from nested admin routes", () => {
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/events/suggestions/pending",
      isAuthenticated: true,
      hasAdminAccess: false,
    }),
    { redirectTo: "/admin/login" },
  );
});

test("admins may access nested admin routes", () => {
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/events/suggestions/pending",
      isAuthenticated: true,
      hasAdminAccess: true,
    }),
    { redirectTo: null },
  );
});

test("the admin login page does not redirect anonymous or non-admin users", () => {
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/login",
      isAuthenticated: false,
      hasAdminAccess: false,
    }),
    { redirectTo: null },
  );
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/login",
      isAuthenticated: true,
      hasAdminAccess: false,
    }),
    { redirectTo: null },
  );
});

test("admins visiting the login page are redirected to the admin home", () => {
  assert.deepEqual(
    decideAdminRouteAccess({
      pathname: "/admin/login",
      isAuthenticated: true,
      hasAdminAccess: true,
    }),
    { redirectTo: "/admin" },
  );
});
