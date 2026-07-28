import assert from "node:assert/strict";
import test, { mock } from "node:test";

type RoleLookupError = {
  message: string;
};

const user: {
  id: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
} = {
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
};

let roleRows: Array<{ role: string }> = [];
let roleError: RoleLookupError | null = null;
let signOutCalls = 0;

const supabase = {
  auth: {
    async signInWithPassword() {
      return { data: { user }, error: null };
    },
    async signOut() {
      signOutCalls += 1;
    },
  },
  from(table: string) {
    assert.equal(table, "app_user_roles");
    return {
      select() {
        return this;
      },
      async eq(column: string, userId: string) {
        assert.equal(column, "user_id");
        assert.equal(userId, user.id);
        return { data: roleRows, error: roleError };
      },
    };
  },
};

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient() {
      return supabase;
    },
  },
});

mock.module("next/headers", {
  namedExports: {
    async cookies() {
      return {
        getAll() {
          return [];
        },
        set() {},
      };
    },
  },
});

mock.module("next/navigation", {
  namedExports: {
    redirect(pathname: string): never {
      throw new Error(`redirect:${pathname}`);
    },
  },
});

const actionsModule = import("./actions.ts");

function resetLoginState() {
  roleRows = [];
  roleError = null;
  signOutCalls = 0;
  user.id = "user-1";
  user.app_metadata = {};
  user.user_metadata = {};
  delete process.env.BREAK_GLASS_ADMIN_USER_IDS;
}

function createCredentials() {
  const formData = new FormData();
  formData.set("email", "admin@example.test");
  formData.set("password", "not-a-real-secret");
  return formData;
}

test("database admin role redirects to the admin console", async () => {
  resetLoginState();
  roleRows = [{ role: "admin" }];
  const { login } = await actionsModule;

  await assert.rejects(login(createCredentials()), /redirect:\/admin/);
  assert.equal(signOutCalls, 0);
});

test("metadata-only admin is denied and signed out", async () => {
  resetLoginState();
  user.app_metadata = { role: "admin" };
  user.user_metadata = { role: "admin", roles: ["admin"] };
  const { login } = await actionsModule;

  const result = await login(createCredentials());

  assert.deepEqual(result, {
    error: "This account is signed in, but it is not authorized for the admin console.",
  });
  assert.equal(signOutCalls, 1);
});

test("role-query error is denied and signed out", async () => {
  resetLoginState();
  roleError = { message: "role lookup failed" };
  const { login } = await actionsModule;

  const result = await login(createCredentials());

  assert.deepEqual(result, {
    error: "This account is signed in, but it is not authorized for the admin console.",
  });
  assert.equal(signOutCalls, 1);
});

test("exact break-glass user id redirects to the admin console", async () => {
  resetLoginState();
  user.id = "break-glass-user";
  process.env.BREAK_GLASS_ADMIN_USER_IDS = "other-user,break-glass-user";
  const { login } = await actionsModule;

  try {
    await assert.rejects(login(createCredentials()), /redirect:\/admin/);
    assert.equal(signOutCalls, 0);
  } finally {
    delete process.env.BREAK_GLASS_ADMIN_USER_IDS;
  }
});
