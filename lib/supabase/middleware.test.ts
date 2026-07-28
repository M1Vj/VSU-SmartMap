import assert from "node:assert/strict";
import test, { mock } from "node:test";

type RoleLookupError = {
  code: string;
  message: string;
};

let currentUserId = "user-1";
let roleError: RoleLookupError | null = null;

const response = {
  kind: "next",
  cookies: { set() {} },
};

mock.module("next/server", {
  namedExports: {
    NextResponse: {
      next() {
        return response;
      },
      redirect(url: URL) {
        return { kind: "redirect", pathname: url.pathname };
      },
    },
  },
});

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient() {
      return {
        auth: {
          async getUser() {
            return {
              data: {
                user: {
                  id: currentUserId,
                  app_metadata: {},
                  user_metadata: { role: "admin", roles: ["admin"] },
                },
              },
            };
          },
        },
        from(table: string) {
          assert.equal(table, "app_user_roles");
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: [], error: roleError };
            },
          };
        },
      };
    },
  },
});

const middlewareModule = import("./middleware.ts");

function createAdminRequest() {
  return {
    cookies: {
      getAll() {
        return [];
      },
      set() {},
    },
    nextUrl: {
      pathname: "/admin",
      clone() {
        return new URL("https://example.test/admin");
      },
    },
  };
}

test("middleware role lookup failure grants no admin role", async () => {
  currentUserId = "user-1";
  roleError = {
    code: "PGRST205",
    message: "Could not find the table 'public.app_user_roles' in the schema cache",
  };
  process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK = "true";
  process.env.ALLOW_LEGACY_USER_METADATA_ROLES = "true";
  const { updateSession } = await middlewareModule;

  try {
    const result = await updateSession(createAdminRequest() as never);
    assert.deepEqual(result, { kind: "redirect", pathname: "/admin/login" });
  } finally {
    delete process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK;
    delete process.env.ALLOW_LEGACY_USER_METADATA_ROLES;
  }
});

test("middleware role lookup failure preserves explicit break-glass admin access", async () => {
  currentUserId = "break-glass-user";
  roleError = {
    code: "PGRST205",
    message: "Could not find the table 'public.app_user_roles' in the schema cache",
  };
  process.env.BREAK_GLASS_ADMIN_USER_IDS = currentUserId;
  const { updateSession } = await middlewareModule;

  try {
    const result = await updateSession(createAdminRequest() as never);
    assert.equal(result, response);
  } finally {
    delete process.env.BREAK_GLASS_ADMIN_USER_IDS;
  }
});
