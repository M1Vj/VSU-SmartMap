import assert from "node:assert/strict";
import test, { mock } from "node:test";

type RoleLookupError = {
  code?: string;
  message: string;
};

const user = {
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
};

let roleRows: Array<{ role: string }> = [];
let roleError: RoleLookupError | null = null;
let serverClientConstructions = 0;
let serviceClientConstructions = 0;
let authenticatedRoleQueries = 0;
let privilegedRoleQueries = 0;
let timeline: string[] = [];

function createRoleQuery(source: "authenticated" | "service") {
  return {
    select() {
      timeline.push(`${source}:select-roles`);
      return this;
    },
    async eq(column: string, userId: string) {
      timeline.push(`${source}:filter-${column}`);
      assert.equal(userId, user.id);
      if (source === "authenticated") authenticatedRoleQueries += 1;
      else privilegedRoleQueries += 1;
      return { data: roleRows, error: roleError };
    },
  };
}

const authenticatedClient = {
  auth: {
    async getUser() {
      timeline.push("authenticated:get-user");
      return { data: { user }, error: null };
    },
  },
  from(table: string) {
    timeline.push(`authenticated:from-${table}`);
    assert.equal(table, "app_user_roles");
    return createRoleQuery("authenticated");
  },
};

const serviceClient = {
  from(table: string) {
    timeline.push(`service:from-${table}`);
    assert.equal(table, "app_user_roles");
    return createRoleQuery("service");
  },
};

mock.module("next/navigation", {
  namedExports: {
    redirect(pathname: string): never {
      throw new Error(`redirect:${pathname}`);
    },
  },
});

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    async getSupabaseServerClient() {
      serverClientConstructions += 1;
      timeline.push("construct:authenticated-client");
      return authenticatedClient;
    },
    getSupabaseServiceRoleClient() {
      serviceClientConstructions += 1;
      timeline.push("construct:service-client");
      return serviceClient;
    },
  },
});

const serverModule = import("./server.ts");

function resetAuthState(roles: string[] = []) {
  roleRows = roles.map((role) => ({ role }));
  roleError = null;
  serverClientConstructions = 0;
  serviceClientConstructions = 0;
  authenticatedRoleQueries = 0;
  privilegedRoleQueries = 0;
  timeline = [];
}

test("getAuthorizedSession reads roles without constructing a service client", async () => {
  resetAuthState([]);
  const { getAuthorizedSession } = await serverModule;

  const session = await getAuthorizedSession();

  assert.ok(session);
  assert.deepEqual(session.roles, []);
  assert.equal(Object.hasOwn(session, "serviceClient"), false);
  assert.equal(serverClientConstructions, 1);
  assert.equal(authenticatedRoleQueries, 1);
  assert.equal(serviceClientConstructions, 0);
  assert.equal(privilegedRoleQueries, 0);
});

test("assertAdminAction denies an authenticated non-admin before service access", async () => {
  resetAuthState([]);
  const { assertAdminAction } = await serverModule;

  const result = await assertAdminAction();

  assert.deepEqual(result, { error: "Unauthorized" });
  assert.equal(authenticatedRoleQueries, 1);
  assert.equal(serviceClientConstructions, 0);
  assert.equal(privilegedRoleQueries, 0);
});

test("assertAdminAction constructs one service client only after the authenticated role query grants admin", async () => {
  resetAuthState(["admin"]);
  const { assertAdminAction } = await serverModule;

  const result = await assertAdminAction();

  assert.equal("error" in result, false);
  if ("error" in result) return;
  assert.equal(result.serviceClient, serviceClient);
  assert.deepEqual(result.roles, ["admin"]);
  assert.equal(authenticatedRoleQueries, 1);
  assert.equal(serviceClientConstructions, 1);
  assert.equal(privilegedRoleQueries, 0);
  assert.ok(
    timeline.indexOf("authenticated:filter-user_id") <
      timeline.indexOf("construct:service-client"),
  );
});

test("assertOwnerAction preserves owner authorization and delays service access until after the role check", async () => {
  resetAuthState(["boarding_house_owner"]);
  const { assertOwnerAction } = await serverModule;

  const result = await assertOwnerAction();

  assert.equal("error" in result, false);
  if ("error" in result) return;
  assert.equal(result.serviceClient, serviceClient);
  assert.equal(authenticatedRoleQueries, 1);
  assert.equal(serviceClientConstructions, 1);
  assert.equal(privilegedRoleQueries, 0);
});

test("assertAdminAction rejects a missing role table without constructing a service client", async () => {
  resetAuthState([]);
  roleError = {
    code: "PGRST205",
    message: "Could not find the table 'public.app_user_roles' in the schema cache",
  };
  process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK = "true";
  const { assertAdminAction } = await serverModule;

  try {
    const result = await assertAdminAction();

    assert.deepEqual(result, { error: "Unauthorized" });
    assert.equal(authenticatedRoleQueries, 1);
    assert.equal(serviceClientConstructions, 0);
    assert.equal(privilegedRoleQueries, 0);
  } finally {
    delete process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK;
  }
});
