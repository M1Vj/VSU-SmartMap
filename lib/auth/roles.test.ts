import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_ROLES,
  canAccessAdminArea,
  canAccessOwnerArea,
  isBreakGlassAdmin,
  mergeAppRoles,
  normalizeAppRoles,
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

test("mergeAppRoles deduplicates normalized role sources", () => {
  assert.deepEqual(
    mergeAppRoles(["admin"], ["admin", "boarding_house_owner"]),
    ["admin", "boarding_house_owner"],
  );
});

test("isBreakGlassAdmin only matches allowlisted user ids", () => {
  assert.equal(isBreakGlassAdmin("user-1", "user-1,user-2"), true);
  assert.equal(isBreakGlassAdmin("user-3", "user-1,user-2"), false);
  assert.equal(isBreakGlassAdmin(null, "user-1"), false);
  assert.equal(isBreakGlassAdmin("user-1", ""), false);
});

test("canAccessAdminArea requires the admin role", () => {
  assert.equal(canAccessAdminArea([]), false);
  assert.equal(canAccessAdminArea(["boarding_house_owner"]), false);
  assert.equal(canAccessAdminArea(["admin"]), true);
});

test("canAccessOwnerArea allows either owners or admins", () => {
  assert.equal(canAccessOwnerArea([]), false);
  assert.equal(canAccessOwnerArea(["boarding_house_owner"]), true);
  assert.equal(canAccessOwnerArea(["admin"]), true);
});
