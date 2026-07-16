import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_ROLES,
  canAccessAdminArea,
  canAccessOwnerArea,
  getMetadataAppRoles,
  isBreakGlassAdmin,
  isMissingAppRoleTableError,
  mergeAppRoles,
  normalizeAppRoles,
  shouldAllowMissingRoleTableAdminFallback,
} from "./roles.ts";

test("APP_ROLES keeps admin and boarding_house_owner as protected app roles", () => {
  assert.deepEqual(APP_ROLES, ["admin", "boarding_house_owner"]);
});

test("normalizeAppRoles ignores untrusted or unknown role values", () => {
  assert.deepEqual(
    normalizeAppRoles(["admin", "student", "boarding_house_owner", null, "owner"]),
    ["admin", "boarding_house_owner"],
  );
});

test("getMetadataAppRoles trusts app metadata roles", () => {
  assert.deepEqual(
    getMetadataAppRoles({
      app_metadata: {
        role: "admin",
        roles: ["boarding_house_owner", "student"],
      },
    }),
    ["admin", "boarding_house_owner"],
  );
});

test("getMetadataAppRoles ignores user metadata unless explicitly allowed", () => {
  const user = {
    app_metadata: {},
    user_metadata: {
      role: "admin",
    },
  };

  assert.deepEqual(getMetadataAppRoles(user), []);
  assert.deepEqual(
    getMetadataAppRoles(user, { includeUserMetadata: true }),
    ["admin"],
  );
});

test("mergeAppRoles deduplicates role-table and metadata roles", () => {
  assert.deepEqual(
    mergeAppRoles(["admin"], ["admin", "boarding_house_owner"]),
    ["admin", "boarding_house_owner"],
  );
});

test("isMissingAppRoleTableError detects Supabase schema-cache misses", () => {
  assert.equal(
    isMissingAppRoleTableError({
      code: "PGRST205",
      message: "Could not find the table 'public.app_user_roles' in the schema cache",
    }),
    true,
  );
  assert.equal(isMissingAppRoleTableError({ code: "42501", message: "denied" }), false);
});

test("shouldAllowMissingRoleTableAdminFallback requires explicit env opt-in", () => {
  assert.equal(shouldAllowMissingRoleTableAdminFallback({}), false);
  assert.equal(
    shouldAllowMissingRoleTableAdminFallback({ allowFallback: "true" }),
    true,
  );
});

test("isBreakGlassAdmin only matches allowlisted user ids", () => {
  assert.equal(isBreakGlassAdmin("user-1", "user-1,user-2"), true);
  assert.equal(isBreakGlassAdmin("user-3", "user-1,user-2"), false);
  assert.equal(isBreakGlassAdmin(null, "user-1"), false);
  assert.equal(isBreakGlassAdmin("user-1", ""), false);
});

test("canAccessAdminArea requires the admin role", () => {
  assert.equal(canAccessAdminArea(["boarding_house_owner"]), false);
  assert.equal(canAccessAdminArea(["admin"]), true);
});

test("canAccessOwnerArea allows either owners or admins", () => {
  assert.equal(canAccessOwnerArea([]), false);
  assert.equal(canAccessOwnerArea(["boarding_house_owner"]), true);
  assert.equal(canAccessOwnerArea(["admin"]), true);
});
